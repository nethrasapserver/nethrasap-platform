# Production Deployment Plan — Render + Cloudflare + Supabase

*Prepared 2026-07-26; revised same day after the owner chose the managed path:
**Render (compute) + Cloudflare (edge/storage) + Supabase (Postgres)**.
The earlier VPS-in-Mumbai option is archived in §10 as the future exit path.
MongoDB was considered and rejected — the backend is deeply relational
(39 SQLAlchemy models, 17 Alembic migrations, row-locked inventory, triggers)
and PostgreSQL 16 is a locked owner decision; Supabase IS managed Postgres,
so it needs zero code changes.*

---

## 1. Architecture

```
                    Cloudflare (free plan)
      DNS · CDN · WAF · TLS · R2 object storage
   ┌───────────────────────────────────────────────┐
   │ www.nethrasap.com   → Render storefront        │
   │ ops.nethrasap.com   → Render dashboard         │
   │ api.nethrasap.com   → Render API (REST + WS)   │
   │ img.nethrasap.com   → R2 bucket (public files) │
   └───────────────────────────────────────────────┘
                          │
              Render — Singapore region
   ┌────────────────────────────────────────────────┐
   │ nethrasap-api        web (Docker)  REST + WS   │
   │ nethrasap-worker     worker        arq jobs    │
   │ nethrasap-redis      Key Value     queue/pubsub│
   │ nethrasap-storefront web (Docker)  Next SSR    │
   │ nethrasap-dashboard  web (Docker)  Next SSR    │
   └────────────────────────────────────────────────┘
                          │
        Supabase — Singapore (ap-southeast-1)
              PostgreSQL 16, session pooler
```

**Region rule:** everything computes in Singapore (Render's closest region to
India) and the DB **must** be Supabase Singapore so API↔DB hops stay ~1ms.
Indian users reach the edge via Cloudflare's Indian PoPs; dynamic requests pay
~70–100ms to Singapore. Accepted trade-off of the managed path.

**Custom domains are mandatory, not cosmetic.** The guest-cart cookie is
`SameSite=Lax`; `*.onrender.com` subdomains are different *sites* (Public
Suffix List), so on default URLs the cookie is never sent and guest carts
silently fail. `www.` / `ops.` / `api.nethrasap.com` share one registrable
domain → same-site → cookies flow. Never test on the onrender.com URLs and
assume cart behaviour is real.

## 2. Database — Supabase (as plain Postgres)

- Create the project in **Singapore (ap-southeast-1)** — same region as Render.
- Use **only** the Postgres database. Supabase Auth/Storage/Realtime/Edge
  Functions are unused — the platform has its own auth (phone-first JWT),
  storage (R2), and realtime (WS hub). No lock-in.
- Connect via the **session pooler (port 5432)**, not the transaction pooler
  (6543): the API holds its own SQLAlchemy pool (10+20), and `db.py`'s
  statement-cache workaround only auto-detects Neon-style `-pooler` hostnames.
  Session mode sidesteps the issue entirely.
- `DATABASE_URL` = Supabase session-pooler string; `db.py` normalises the rest
  (asyncpg dialect, sslmode) as-is.
- Plan: free tier for staging; **Pro ($25/mo) at go-live** — the free tier
  pauses on inactivity and has no PITR; a store taking orders needs backups.
- Alternative already in hand: the existing **Neon** project (also Singapore-
  capable, already provisioned, `-pooler` quirk already handled in code).
  Either is fine; pick one and put it in the env group.

## 3. Render services (existing render.yaml, amended)

| Service | Type | Plan | Notes |
|---|---|---|---|
| nethrasap-api | web, Docker | Starter $7 | `healthCheckPath /api/v1/health`; preDeploy `alembic upgrade head && python -m scripts.seed_rbac` |
| nethrasap-worker | worker, Docker | Starter $7 | same image, `arq app.worker.WorkerSettings` |
| nethrasap-redis | Key Value | Starter $10 | persistence on; queue + pub/sub + rate limits (free 25MB tier loses queued jobs on restart — not for prod) |
| nethrasap-storefront | web, Docker | Starter $7 | `APP=storefront` |
| nethrasap-dashboard | web, Docker | Starter $7 | `APP=dashboard` |

**render.yaml amendments needed:**
- `NEXT_PUBLIC_API_BASE=https://api.nethrasap.com` on both frontends
  (build-time bake — set BEFORE first deploy of the frontends).
- `CORS_ORIGINS=https://www.nethrasap.com,https://ops.nethrasap.com` on the API.
- `NEXT_PUBLIC_DASHBOARD_URL=https://ops.nethrasap.com` on the storefront.
- Free web services sleep after idle (~50s cold start) → production is paid;
  a parallel free copy of the blueprint can serve as staging.

## 4. Cloudflare setup

1. Zone `nethrasap.com` on the Free plan; registrar nameservers → Cloudflare.
2. DNS: CNAME `www`, `ops`, `api` → the Render services' `.onrender.com`
   hosts, **proxied** (orange cloud). Add the domains in Render so it mints
   certs; SSL mode **Full (strict)**.
3. WebSockets are proxied on the free plan — `wss://api.nethrasap.com/api/v1/ws`
   works through Cloudflare unchanged.
4. **R2**: one bucket `nethrasap` — public prefix `products/` (catalogue
   images) exposed via custom domain `img.nethrasap.com`; private prefixes
   `kyc/`, `invoices/`, `payslips/` reachable only via presigned URLs
   (already implemented in `integrations/storage.py`). R2 has zero egress
   fees; Cloudflare caches `img.` at the edge. Free: 10GB storage.
5. WAF: default managed rules; rate-limit rule on `/api/v1/auth/*` as a
   second layer above the app's Redis limiter.
6. Cache rule: bypass cache for `api.` (except let R2/img cache normally);
   Next static assets get long-cache by default via `/_next/static`.

## 5. Code fixes required before this deploy

| # | Fix | Why |
|---|---|---|
| 1 | **Commit + push everything** (work since 2026-07-12 is working-tree only) | Render deploys from GitHub |
| 2 | Serializers return `storage.public_url(key)` instead of raw `image_key` (catalogue, categories, saved-items) | real R2 uploads otherwise render broken `<img>`; dev only works because seeds store absolute Unsplash URLs |
| 3 | SMS provider (MSG91/Exotel) + **DLT registration** (client's entity docs; days–weeks lead time) | OTP login is console-only today — hard launch blocker |
| 4 | Invoice/payslip PDF bytes (reportlab already a dep) | stubs store nothing in R2 |
| 5 | Uvicorn flags in Dockerfile.backend: `--proxy-headers --forwarded-allow-ips '*'` (behind Cloudflare+Render proxies) | correct client IPs in audit log |
| 6 | Security-headers middleware; consider gating `/docs` in prod | W0 hardening minimum |
| 7 | (soon after launch) refresh token localStorage → httpOnly cookie | discovery W1 |

## 6. Environment variables (Render env group `nethrasap-shared`)

| Var | Value |
|---|---|
| ENVIRONMENT | production |
| DATABASE_URL | Supabase session-pooler string (Singapore) |
| JWT_SECRET | Render `generateValue` (≥32 chars — boot check enforces) |
| REDIS_URL | wired from Key Value service |
| CORS_ORIGINS | https://www.nethrasap.com,https://ops.nethrasap.com |
| SMS_PROVIDER / SMS_API_KEY / SMS_SENDER_ID | msg91 + key + DLT-approved ID |
| STORAGE_ENDPOINT | R2 S3 endpoint (account-scoped) |
| STORAGE_BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY | R2 credentials |
| STORAGE_PUBLIC_BASE_URL | https://img.nethrasap.com |
| PAYMENT_METHODS_ENABLED | cod |
| RAZORPAY_* | empty until owner enables gateway payments |

## 7. Accounts checklist (owner-owned unless noted)

domain registrar · Cloudflare (zone + R2) · Supabase · Render (dev may own,
transfer later) · MSG91 + DLT · GitHub (exists) · Sentry (free) · uptime
monitor (free) · Razorpay (create + KYC now, dormant until enabled).

## 8. Go-live sequence

| # | Step |
|---|---|
| 0 | Commit + push all pending work (logical commits) |
| 1 | Start DLT registration + MSG91 account (longest lead time) |
| 2 | Land code fixes §5 (2, 4, 5, 6) |
| 3 | Cloudflare zone + R2 bucket + `img.` domain; Supabase project (Singapore) |
| 4 | Amend render.yaml (§3) → deploy blueprint → attach custom domains |
| 5 | Staging pass: full journey — OTP signup → KYC upload to R2 → quote → convert → COD order → invoice PDF from R2 → realtime updates on ops. |
| 6 | Verify guest cart on the real domains (the SameSite fix) + WS through Cloudflare |
| 7 | Supabase → Pro; backup/PITR confirmed; restore drill |
| 8 | Sentry + uptime monitors; Cloudflare WAF rate rules |
| 9 | Real catalogue via admin/CSV; DNS already live → launch |

## 9. Cost

| Item | $/mo |
|---|---|
| Render (4 services + Key Value, Starter) | ~38 |
| Supabase Pro (at launch; free until then) | 25 |
| Cloudflare + R2 | ~0–1 |
| MSG91 | pay-per-SMS (~₹0.20/OTP) + one-time DLT |
| Domain | ~$1 (amortised) |
| **Total** | **~$64/mo at launch; ~$39 pre-launch** |

## 10. Exit path (kept for the record)

If latency or cost bites later: one 4GB VPS in Mumbai (Vultr/DO/Lightsail)
running the same Docker images behind Caddy, Postgres moved via pg_dump to a
Mumbai-region managed instance. Everything is containerised and env-driven,
so the move is an evening's work, not a rebuild. Nothing in this plan
forecloses it.
