# SuperIDEv3 Route Map

Purpose: record target route inventory and route acceptance rules only.

Canonical status owner:
- `SuperIDEv3-integration.md`

This file should not carry overall completion claims, merge order, or release status.

## App Routes

☐ `/`
☐ `/workspace`
☐ `/neural-space-pro`
☐ `/skyechat`
☐ `/skydocxmax`
☐ `/skydocx`
✅ `/SkyeDocxMax/index.html`
✅ `/SkyeDocxMax/homepage.html`
☐ `/skyeblog`
☐ `/skydex`
☐ `/sovereign-variables`
☐ `/publishing`
☐ `/publishing/packages`
☐ `/publishing/binaries`
☐ `/catalog`
☐ `/commerce`
☐ `/submissions`
☐ `/submissions/portal`
☐ `/release-history`
☐ `/evidence`
☐ `/settings`

## API Routes

☐ `POST /api/auth/login`
☐ `GET /api/auth/verify`
☐ `POST /api/auth/refresh`
☐ `POST /api/auth/logout`
☐ `POST /api/payments/checkout/session`
☐ `POST /api/payments/webhook/stripe`
☐ `POST /api/payments/session/reconcile`
☐ `GET /api/commerce/library`
☐ `POST /api/commerce/fulfillment-token`
☐ `GET /api/catalog/titles`
☐ `POST /api/catalog/titles`
☐ `GET /api/release-history`
☐ `GET /api/skydocxmax/documents`
☐ `POST /api/skydocxmax/documents`
☐ `POST /api/skydocxmax/export`
☐ `POST /api/skydocxmax/import`
☐ `POST /api/skydocxmax/publish`
☐ `POST /api/skydocxmax/share`
☐ `POST /api/publishing/package`
☐ `POST /api/publishing/binaries`
☐ `GET /api/publishing/packages`
☐ `POST /api/submissions/jobs`
☐ `GET /api/submissions/jobs`
☐ `POST /api/submissions/dispatch`
☐ `POST /api/submissions/status`
☐ `POST /api/submissions/cancel`
☐ `GET /api/evidence/smoke`
☐ `GET /api/evidence/release-gates`
☐ `GET /api/evidence/artifacts`

## Route Acceptance Rules

☐ Every app route is reachable through navigation.
☐ Every app route renders without blank-screen failure.
☐ Every app route preserves its donor lane’s core behavior.
☐ Every API route returns typed JSON.
☐ Every protected API route enforces auth.
☐ Every API route has smoke coverage.
☐ Every UI control calling an API route shows success and failure states.
☐ Missing environment variables fail loudly with operator-readable messages.
☐ Standalone and embedded `SkyeDocxMax` share one document contract, auth contract, persistence contract, export/import contract, and evidence contract.
