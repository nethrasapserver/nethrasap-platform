# Nethrasap Platform

India's audited healthcare supply platform — production monorepo.
One backend, two frontends, fully realtime. **No mock data anywhere.**

| Path | What | Stack |
|---|---|---|
| [`backend/`](backend/) | API + WebSocket hub + background worker | FastAPI · SQLAlchemy 2 · PostgreSQL 16 · Redis · arq |
| [`apps/storefront/`](apps/storefront/) | Customer storefront (SSR for organic search) | Next.js 14 · TanStack Query |
| [`apps/dashboard/`](apps/dashboard/) | Ops portals: customer / sales / manager / admin / HR | Next.js 14 · TanStack Query |
| [`packages/api-client/`](packages/api-client/) | Shared typed API client, generated from OpenAPI | openapi-typescript |
| [`infra/`](infra/) | Render blueprint, Dockerfile, Cloudflare notes | Render · Cloudflare Pages/R2 |
| [`docs/PLAN.md`](docs/PLAN.md) | Full build plan, phases, acceptance criteria | |

## Quick start (host dev — hot reload)
```bash
cp .env.example .env          # fill DATABASE_URL (Neon) + JWT_SECRET at minimum
make up                       # Redis 7 (+ local Postgres if not using Neon)
make migrate                  # Alembic → head
make dev                      # FastAPI on :8000 (OTPs print here)
npm install                   # workspace deps
make storefront               # Next.js storefront on :3000
make dashboard                # Next.js dashboard on :3001
```

## Quick start (everything in Docker)
```bash
make stack                    # builds + runs api :8000, worker,
                              # storefront :3000, dashboard :3001, redis
make stack-logs               # follow logs (OTP codes appear in api logs)
make stack-down
```

## Ground rules
- **No mocks, no hardcoded data.** CI rejects `NETHRA_DATA`, mock adapters and
  demo credentials in app code. Data enters through the API/admin UI only.
- **Phone-first auth.** No email flows exist on this platform. SMS provider is
  `console` in dev (OTPs print to backend logs).
- **Everything realtime.** State changes publish domain events → Redis → the
  WebSocket hub; both frontends subscribe instead of polling.
- Backend endpoint changes require `make api-types` so frontend types stay in
  lockstep.

The original demos live in `../backups/` as read-only visual/UX references.
