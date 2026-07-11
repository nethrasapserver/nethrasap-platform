# Infrastructure

## Topology
| Piece | Where | Notes |
|---|---|---|
| FastAPI API + WebSocket hub | **Render** web service (Docker) | `render.yaml` (repo root); **see [DEPLOY.md](DEPLOY.md)** |
| arq background worker | **Render** worker | same image, different command |
| PostgreSQL 16 | **Neon** (external) | migrations via pre-deploy `alembic upgrade head` |
| Redis (pub/sub, jobs, rate limits) | **Render Key Value** | internal-only |
| Storefront (Next.js, SSR) | **Cloudflare Pages** (`@cloudflare/next-on-pages`) | SSR needed for organic search |
| Dashboard (Next.js) | **Cloudflare Pages** | server runtime for auth middleware |
| Object storage (KYC docs, images, PDFs) | **Cloudflare R2** | S3-compatible API |
| DNS / CDN / WAF | **Cloudflare** | `api.` → Render, apex + `app.` → Pages |

## Cloudflare Pages setup (per app)
- Build command: `npx @cloudflare/next-on-pages` with root dir `apps/storefront` (resp. `apps/dashboard`).
- Env vars: `NEXT_PUBLIC_API_BASE=https://api.<domain>`, `NEXT_PUBLIC_WS_BASE=wss://api.<domain>`.
- If `next-on-pages` limitations bite (Node APIs in server components), fallback:
  deploy the two Next.js apps as additional Render web services instead —
  everything else is unchanged.

## WebSockets
Render web services support WebSockets natively; Cloudflare proxies them —
no special config beyond keeping `api.` proxied (orange cloud).

## Local dev
`docker compose up -d` at repo root gives Postgres 16 + Redis 7 with the same
versions as production.
