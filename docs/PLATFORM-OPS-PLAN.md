# Platform Ops (DevOps) Dashboard + External Services Plan

**Date:** 2026-08-02
**Owner decisions (2026-08-02):**
1. **Scope:** a super-admin **"Platform Ops"** section inside the *existing* dashboard — reuse
   its auth, RBAC, and design system. Not a separate app.
2. **Secrets:** editable integration keys are **secrets-manager-backed and audited** — the
   dashboard writes to the cloud secret manager, the app reads from there, every change is
   written to `audit_log`. No plaintext secrets in the app DB.
3. **Sequencing:** built as part of **Gate 4** (observability), which it overlaps heavily.

---

## Part A — External services inventory

What to create an account for, what it powers, and lead time. **Two items gate the launch and
have real lead time — start them now: DLT/SMS and the domain.**

| Service | Gate | Purpose | Lead time / cost | Integration |
|---|---|---|---|---|
| **MSG91 / Exotel** | 2 | Real OTP SMS (replaces `console`) | Account hours; **DLT 1–3 wks** | REST API key + sender ID |
| **DLT registration** | 2 | Legally required in India before any transactional SMS (entity + header + template approval) | **Weeks — the long pole** | via MSG91/Exotel DLT console |
| **Domain registrar** | 2 | One registrable domain; mandatory for guest carts (SameSite/PSL) | ~$10/yr | DNS → Cloudflare |
| **Cloudflare (+ R2)** | 2 | DNS, WAF, TLS, R2 object storage (KYC/invoices/images) | Free + R2 ~$0–1/mo | API token (MCP connector available) |
| **Cloud provider** (GCP rec. / Render) | 2 | Compute + managed Postgres + Redis | GCP ₹27k credits/90d | GCP APIs / Render (MCP token in `.mcp.json`) |
| **Sentry** | 2 & 4 | Error tracking (API + both apps) | Free tier | DSN + API |
| **pg_trgm** (Postgres ext) | 3 | Prefix/fuzzy search — **no external service** | Free | enable in-DB |
| **Razorpay** | Post-launch | Online payments (COD-only at launch; **KYC takes days — start early**) | Per-txn | REST + webhook |
| **Uptime monitor** (Better Stack / UptimeRobot) | 4 | Ping 4 hostnames | Free | API |
| **Healthchecks.io** | 4 | Dead-man's-switch for the arq worker | Free | cron ping |
| **Metrics** (Grafana Cloud / provider-native) | 4 | RED metrics, queue depth, DB pool | Free tier | Prometheus scrape |
| **Container registry** (GHCR / Artifact Registry) | 4 | CI builds + pushes deploy images | Free/cheap | GitHub / GCP |
| **Dependabot / gitleaks / Trivy** | 4 | Dependency + secret + image scanning | Free | GitHub Actions |

**Accounts checklist (owner to create):** domain registrar · Cloudflare (+R2) · cloud provider
(+billing) · MSG91/Exotel (+DLT) · Sentry · uptime monitor · Razorpay (KYC now, dormant until enabled).

---

## Part B — Platform Ops dashboard spec

A `super-admin`-only route group in `apps/dashboard` (new permission, e.g. `platform:admin`,
granted only to admins). Reuses the existing sidebar/design; gated by middleware + API RBAC.

### In scope

| Panel | What it does | Data source | Mode |
|---|---|---|---|
| **System status** | Health of api/worker/postgres/redis; arq queue depth; worker last-heartbeat; outbox pending/failed counts | app `/ready` (extended) + a new ops endpoint | read |
| **Error feed** | Recent Sentry issues, counts, links | Sentry API | read |
| **Cost & usage** | Current spend/usage across compute, Cloudflare, R2 | provider + Cloudflare billing APIs | **read-only** |
| **Integrations** | Configure SMS provider + sender ID, Razorpay keys, R2 keys, `PAYMENT_METHODS_ENABLED` | secret manager (write) + `app_settings`/`feature_flags` | write (audited) |
| **Feature flags** | Toggle flags | `feature_flags` table | write (audited) |
| **Audit log viewer** | Filter/search every mutation (already recorded) | `audit_log` | read |
| **Traces** | Request-ID lookup → correlated logs | structured logs (request_id already emitted) | read |

### Explicitly OUT of scope (with the safer path)

- **Rotating infrastructure/server credentials from the UI** — makes the app a privileged
  control plane; one compromised admin session = all infra compromised. → Provider console + IaC.
- **Paying cloud bills from the dashboard** — not a real/safe provider capability; would store a
  payment method. → Show spend (read-only); set auto-pay once in the provider.
- **Reimplementing tracing/metrics** — → embed/link Sentry + Grafana; surface top signals only.

### Secrets model (owner decision)

- The Integrations panel writes to the **cloud secret manager** (GCP Secret Manager / Cloudflare),
  not the app DB. The app reads secrets from there at boot/refresh.
- Every change writes an `audit_log` row (who, what key, when — never the value).
- Non-secret config (sender IDs, flags, `PAYMENT_METHODS_ENABLED`) may live in
  `app_settings`/`feature_flags` as today.
- The existing production-safety config guard (refuses `console` SMS / unconfigured storage in
  prod) stays as the backstop.

### Dependencies

Most of this rides on Gate 4 work (Sentry wiring, extended readiness/metrics, worker heartbeat).
Build the observability plumbing first, then the Platform Ops UI on top.
