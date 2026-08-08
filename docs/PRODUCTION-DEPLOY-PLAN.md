# Production Deployment Plan — Cloudflare + Render + Supabase

*Rewritten 2026-08-08 for the owner's chosen stack: **Cloudflare** (frontend
edge, R2 storage, DNS/WAF), **Render** (API + worker + Redis), **Supabase**
(PostgreSQL). Supersedes the 2026-07-26 plan, which predates httpOnly-cookie
auth, MinIO/R2 uploads-through-the-API, the CMS, and the production boot guards.*

---

## 0. The constraint that shapes everything

`apps/*/next.config.mjs` carries this, and it is not decoration:

> **LOAD-BEARING in every environment**: all browser REST calls go through the
> same-origin rewrite so the httpOnly auth cookies are first-party.

The browser **never** calls the API directly. It calls `/api/v1/*` on its own
origin; Next proxies that to the API server-side; the API's `Set-Cookie` comes
back through the proxy and lands as a **first-party cookie on the frontend
domain**. Only WebSockets bypass the proxy (absolute `NEXT_PUBLIC_API_BASE`).

Two consequences:

1. Whatever hosts the frontend **must be able to proxy** `/api/v1/*` server-side.
   A pure static/CDN deploy of these apps cannot work.
2. The old "`*.onrender.com` breaks cookies" problem is **gone** — cookies are
   scoped to the frontend origin now, not shared across subdomains. Custom
   domains are still wanted, but they're no longer load-bearing for auth.

---

## 1. Topology

```
                    Cloudflare  (DNS · CDN · WAF · TLS · R2)
   ┌──────────────────────────────────────────────────────────────┐
   │  www.nethrasap.com   →  storefront (Next, SSR + /api proxy)  │
   │  ops.nethrasap.com   →  dashboard  (Next, SSR + /api proxy)  │
   │  api.nethrasap.com   →  Render API   (REST + WebSockets)     │
   │  img.nethrasap.com   →  R2 bucket    (public product images) │
   └──────────────────────────────────────────────────────────────┘
                    │                              │
     REST: browser → frontend → API        WS: browser → api.* directly
                    │
              Render — Singapore
   ┌──────────────────────────────────────────────────────────────┐
   │ nethrasap-api      web (Docker)   FastAPI REST + WS hub      │
   │ nethrasap-worker   worker         arq: SMS, invoices, PDFs   │
   │ nethrasap-redis    Key Value      queue · pub/sub · limits   │
   └──────────────────────────────────────────────────────────────┘
                    │
        Supabase — Singapore · PostgreSQL 16 (session pooler)
```

**Region rule:** API, Redis and Postgres all in **Singapore** (Render's closest
region to India, and Supabase has a matching one). API↔DB latency dominates
request time; colocating them is worth more than anything else on this page.

---

## 2. Database — Supabase, not MongoDB

**MongoDB is not an option here, and this isn't a preference.** The backend is
relational to its foundations: 39 SQLAlchemy models, 17 Alembic migrations,
row-locked stock reservations, a DB trigger maintaining product ratings,
FK-snapshotted order lines, and PostgreSQL 16 as a locked owner decision.
Moving to Mongo is a backend rewrite, not a connection-string swap.

**Supabase is managed PostgreSQL**, so it needs **zero code changes**. Use it
purely as a database — its Auth, Storage, Realtime and Edge Functions stay
unused (the platform has its own phone-first auth, R2 storage, and WS hub).
No lock-in: it's a plain `DATABASE_URL`.

Setup:

- Create the project in **Singapore (ap-southeast-1)** — the region cannot be
  changed later.
- Connect via the **session pooler on port 5432**, *not* the transaction pooler
  (6543). The API keeps its own SQLAlchemy pool; session mode avoids the
  prepared-statement issues transaction pooling causes with asyncpg.
- **Append `?sslmode=require`** — Supabase's copyable URI omits it.
- Free tier for staging; **Pro ($25/mo) before real orders** — the free tier
  pauses on inactivity and has no PITR.

Alternative if preferred: **Neon** (also Postgres, Singapore, already known to
`db.py`'s `-pooler` handling). Either works; pick one.

---

## 3. Storage — Cloudflare R2

Uploads now go **browser → API → R2** (server-side `put_object`), not
browser→storage. The API is the only thing holding storage credentials.

- One bucket, e.g. `nethrasap`. Prefixes: `products/`, `categories/`, `cms/`
  (public reads) and `kyc/`, `invoices/`, `payslips/` (private, served via
  short-lived presigned GETs).
- Public reads via a **custom domain** `img.nethrasap.com` bound to the bucket →
  set as `STORAGE_PUBLIC_BASE_URL`. Cloudflare caches it at the edge; R2 has
  **zero egress fees**.
- Create an **R2 API token** (Object Read & Write, scoped to the bucket) →
  `STORAGE_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`),
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`.
- Add `img.nethrasap.com` to the storefront's `images.remotePatterns` (it
  currently only allows `images.unsplash.com`).

⚠️ **The API refuses to boot in production without storage configured** —
`config.py` raises rather than let the stub silently discard uploads. Set these
before the first deploy.

---

## 4. Backend — Render

`render.yaml` already defines the services; it needs amending for this topology.

| Service | Type | Plan | Notes |
|---|---|---|---|
| nethrasap-api | web (Docker) | Starter $7 | health `/api/v1/health`; preDeploy runs `alembic upgrade head && seed_rbac && bootstrap_admin` |
| nethrasap-worker | worker (Docker) | Starter $7 | same image, `arq app.worker.WorkerSettings` |
| nethrasap-redis | Key Value | Starter $10 | persistence on — the free 25MB tier drops queued jobs on restart |

**Amendments needed:**
- `CORS_ORIGINS` → `https://www.nethrasap.com,https://ops.nethrasap.com`
  (needed for the WebSocket handshake, since WS bypasses the proxy).
- Remove the two frontend services **if** frontends move to Cloudflare (Option A
  below); keep them for Option B.

---

## 5. Frontend — the one real decision

Both apps are `output: "standalone"` (a Node server) and **must proxy
`/api/v1/*`**. There are two honest ways to get Cloudflare in front.

### Option A — Next.js *on* Cloudflare Workers (OpenNext)

Run the apps as Workers via `@opennextjs/cloudflare`.

- **Work required:** add the OpenNext adapter + `wrangler.toml` per app, enable
  `nodejs_compat`, switch the build from `output: "standalone"` to the adapter,
  set up two Workers projects with build pipelines, and re-verify SSR, the
  `/api/v1` rewrite, cookie flow, and the auth/checkout journeys end-to-end.
- **In our favour:** no `next/image` anywhere (plain `<img>`), so the image
  optimizer isn't a blocker; rewrites and SSR are supported by the adapter.
- **Risks:** the adapter is comparatively young; Worker bundle-size limits;
  the Docker images we've verified for weeks stop being what ships. Budget
  ~1–2 days including verification, and expect some surprises.
- **Gain:** ~$14/mo of Render services saved; static assets served at the edge.

### Option B — Next.js on Render, Cloudflare in front (recommended for launch)

Keep the two Docker frontends on Render exactly as they run today, and put
Cloudflare in front as **proxied DNS** (orange cloud): DNS, CDN, WAF, TLS,
caching, bot protection — plus R2.

- **Work required:** DNS records + custom domains. Essentially zero code risk.
- **Gain:** ships now, on images already verified end-to-end.
- **Cost:** the $14/mo Option A would save.

**Recommendation: launch on Option B, treat Option A as a later optimization.**
Cloudflare is in the stack either way — the difference is whether it *executes*
the frontend or *fronts* it. Doing the OpenNext migration during a launch, on
the surface that carries auth and checkout, is risk taken for $14/mo.

---

## 6. Environment variables (Render env group `nethrasap-shared`)

| Var | Value |
|---|---|
| ENVIRONMENT | `production` |
| DATABASE_URL | Supabase session-pooler URI + `?sslmode=require` |
| JWT_SECRET | Render `generateValue` (≥32 chars; boot refuses placeholders) |
| REDIS_URL | wired from the Key Value service |
| CORS_ORIGINS | `https://www.nethrasap.com,https://ops.nethrasap.com` |
| STORAGE_ENDPOINT | `https://<account-id>.r2.cloudflarestorage.com` |
| STORAGE_BUCKET | `nethrasap` |
| STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY | R2 API token pair |
| STORAGE_PUBLIC_BASE_URL | `https://img.nethrasap.com` |
| SMS_PROVIDER / SMS_API_KEY / SMS_SENDER_ID | `msg91` + key + DLT-approved ID |
| OTP_ENABLED | `true` once DLT clears — see §7 |
| BOOTSTRAP_ADMIN_PHONE / BOOTSTRAP_ADMIN_PASSWORD | first ops login; remove after rotating |
| PAYMENT_METHODS_ENABLED | `cod` |
| RAZORPAY_* | empty until gateway payments are enabled |

Frontend build/runtime vars (both apps):

| Var | Value |
|---|---|
| API_PROXY_TARGET | the API's URL — **load-bearing**, the proxy destination |
| NEXT_PUBLIC_API_BASE | `https://api.nethrasap.com` — used for **WebSockets only** |
| NEXT_PUBLIC_STOREFRONT_URL / NEXT_PUBLIC_DASHBOARD_URL | cross-links between apps |

---

## 7. Launch blocker: OTP / SMS

`config.py` **refuses to start in production** with `SMS_PROVIDER=console` while
OTP is enabled — console mode would print OTPs into production logs. So one of
these must be true before go-live:

- **MSG91 (or Exotel) live + DLT registration approved** → real OTP login; or
- **`OTP_ENABLED=false`** → launch password-only, switch OTP on when DLT clears.

**DLT registration (sender ID + template approval) takes days to weeks and needs
the client's GST/PAN entity documents.** It is the single longest-lead item in
this plan and should be started before anything else here.

---

## 8. Go-live sequence

| # | Step | Owner |
|---|---|---|
| 1 | Start **MSG91 + DLT registration** (longest lead) | client |
| 2 | Buy the domain; add the zone to **Cloudflare** | client |
| 3 | Create **Supabase** project (Singapore) → grab session-pooler URI | client |
| 4 | Create **R2** bucket + API token + `img.` custom domain | client |
| 5 | Amend `render.yaml` (CORS, frontend decision), deploy the blueprint | me |
| 6 | Fill env vars in Render; first deploy runs migrations + RBAC seed + admin bootstrap | client + me |
| 7 | DNS: `www` / `ops` / `api` → proxied records; attach custom domains | me |
| 8 | Add `img.nethrasap.com` to storefront `images.remotePatterns` | me |
| 9 | **Staging walkthrough**: signup → KYC upload → verify → quote → order → dispatch → invoice PDF → realtime | me |
| 10 | Supabase → Pro; confirm backups/PITR; restore drill | me |
| 11 | Sentry + uptime monitors; Cloudflare WAF rate rules on `/api/v1/auth/*` | me |
| 12 | Load the real catalogue (admin UI / CSV); publish CMS surfaces | client |

---

## 9. Cost

| Item | $/mo |
|---|---|
| Render — api + worker + Redis | ~24 |
| Render — 2 frontends (Option B only) | ~14 |
| Supabase Pro | 25 |
| Cloudflare (DNS/CDN/WAF) + R2 (<10GB) | ~0–1 |
| **Total** | **~$50 (Option A) · ~$64 (Option B)** |

Plus per-SMS (~₹0.20/OTP) and the domain. Razorpay only when gateway payments
are switched on.

---

## 10. Known gaps to close before/after launch

- **Payslip PDFs** are still stubbed (invoices are real).
- **Schedule (H/H1/X)** was removed from the product form (owner decision) — if
  scheduled medicines are ever listed, the field must come back before launch;
  the DB column is retained and defaulted.
- Analytics "Prescription items" tiles now always read 0 (same reason).
- The **staff-list pagination / coupon race / centralized exception handler**
  items from `DISCOVERY.md` W0 remain open; none block launch.
