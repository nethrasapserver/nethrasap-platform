# @nethrasap/storefront

Customer-facing storefront (customer / clinician / retailer). **Next.js 14 App
Router** — server-rendered product & category pages for organic search.

## Rules of this app
- **No mock data.** Every page reads from the FastAPI backend via
  `@nethrasap/api-client` (TanStack Query on the client, direct fetch in server
  components). The old Vite SPA's mock adapter was deliberately not carried over.
- Auth is **phone + OTP/password** (no email flows anywhere).
- Realtime (order tracking, stock changes, notifications, chat with sales) comes
  over the backend WebSocket hub.

## Dev
```bash
npm run dev            # :3000, proxies /api/v1/* → localhost:8000
```
Requires the backend running (`make dev` at repo root).

## Porting map (from backups/nethrasap-ecommerce-app-demo/frontend)
The legacy Vite SPA remains in the backups folder as the visual/UX reference.
Port order (Phase 2): shell/nav → home (CMS-driven) → products list → product
detail → cart → checkout (Razorpay) → orders/tracking → auth screens →
enquiries → notifications → chat.

`styles/` and `lib/icons.js`, `lib/images.js` were carried over verbatim so
ported pages keep the existing design language.
