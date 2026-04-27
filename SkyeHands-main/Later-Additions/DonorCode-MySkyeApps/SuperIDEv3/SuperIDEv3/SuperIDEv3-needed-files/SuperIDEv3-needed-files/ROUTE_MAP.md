# SuperIDEv3 Route Map

Purpose: define the final intended app routes and API routes before code merge. A route is complete only when code exists and smoke verifies it.

## App Routes

☐ `/` final SuperIDEv3 command home.
☐ `/workspace` unified SuperIDE workspace shell.
☐ `/neural-space-pro` restored Neural Space Pro.
☐ `/skyechat` restored SkyeChat.
☐ `/skydocx` restored SkyeDocxPro rich document editor.
☐ `/skyeblog` restored SkyeBlog.
☐ `/skydex` restored SkyDex4.6 surface.
☐ `/sovereign-variables` restored SovereignVariables surface.
☐ `/publishing` 3.3.0 publishing control plane.
☐ `/publishing/packages` package generation outputs.
☐ `/publishing/binaries` manuscript/binary output lane.
☐ `/catalog` multi-title catalog.
☐ `/commerce` direct sale checkout and owned-library lane.
☐ `/submissions` submission job control plane.
☐ `/submissions/portal` portal workflow boundary screen.
☐ `/release-history` release history and analytics.
☐ `/evidence` evidence dashboard.
☐ `/settings` operator settings.

## API Routes

☐ `POST /api/auth/login`.
☐ `GET /api/auth/verify`.
☐ `POST /api/auth/refresh`.
☐ `POST /api/auth/logout`.
☐ `POST /api/payments/checkout/session`.
☐ `POST /api/payments/webhook/stripe`.
☐ `POST /api/payments/session/reconcile`.
☐ `GET /api/commerce/library`.
☐ `POST /api/commerce/fulfillment-token`.
☐ `GET /api/catalog/titles`.
☐ `POST /api/catalog/titles`.
☐ `GET /api/release-history`.
☐ `POST /api/publishing/package`.
☐ `POST /api/publishing/binaries`.
☐ `GET /api/publishing/packages`.
☐ `POST /api/submissions/jobs`.
☐ `GET /api/submissions/jobs`.
☐ `POST /api/submissions/dispatch`.
☐ `POST /api/submissions/status`.
☐ `POST /api/submissions/cancel`.
☐ `GET /api/evidence/smoke`.
☐ `GET /api/evidence/release-gates`.
☐ `GET /api/evidence/artifacts`.

## Route Binding Rules

☐ Every app route must be reachable through navigation.
☐ Every app route must render without blank screen failure.
☐ Every app route must preserve the donor lane’s core behavior.
☐ Every API route must return typed JSON.
☐ Every protected API route must enforce auth.
☐ Every API route must have smoke coverage.
☐ Every UI control that calls an API route must show success and failure states.
☐ Every missing environment variable must fail loudly with a useful operator message.
