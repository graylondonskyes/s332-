# SkyeRoutexFlow Workforce Command v0.4.0

This is the serious build foundation for the SkyeRoutexFlow + House Command autonomous workforce dispatch system.

v0.4.0 keeps the dependency-light local Node/JSON datastore foundation and adds real browser command panels over the API. The browser UI can log in, create users, create city/state markets, post provider jobs, load contractor job boards, apply to jobs, review applicant pools, accept/reject applicants, run assignment actions, submit proof, approve work, open disputes, view payments, freeze payments from House Command, view audit events, inspect integration status, and generate autonomous contractor recommendations.

It is not production SaaS yet. It is a local proof platform with working backend flows and UI panels attached to those flows.

## Run locally

```bash
cp .env.example .env
export SKYE_ADMIN_EMAIL=house-command@internal.invalid
export SKYE_ADMIN_PASSWORD='<strong-password>'
npm run reset
npm start
```

Open:

```txt
<runtime-base-url>
```

Admin bootstrap is env-driven. `npm run reset` only seeds an admin when `SKYE_ADMIN_EMAIL` and `SKYE_ADMIN_PASSWORD` are explicitly configured, so the checked-in datastore can stay blank by default.

## Smoke tests

```bash
npm run smoke:all
```

Individual tests:

```bash
npm run smoke
npm run smoke:browser
npm run smoke:deploy
```

`npm run smoke` proves the end-to-end API path: admin login, market creation, user creation, provider job posting, contractor application, single-acceptance overfill blocking, multi-slot cap blocking, assignment confirmation/check-in/proof/approval, payment-state advancement, ratings, autonomous recommendations, House Command, and audit proof.

`npm run smoke:browser` proves the browser panel files are served and wired to real backend routes. It checks the UI contains the provider, contractor, House Command, assignment, payment, audit, and applicant-pool panels, and verifies the JavaScript routes connect to the live API names instead of placeholder controls.

## SkyeHands inheritance prep

v0.4.0 now includes adapter boundaries for the pieces that should inherit from the larger SkyeHands workspace without breaking the local proof platform:

```txt
DATABASE_DRIVER=local-json
STORAGE_DRIVER=local-json
SKYE_ALLOW_LOCAL_PROOF_SERVICES=1
PAYMENT_PROVIDER=ledger-only
NOTIFICATION_PROVIDER=in-app-ledger
ROUTE_INTELLIGENCE_PROVIDER=route-structure-only
IDENTITY_COMPLIANCE_PROVIDER=local-attestation-ledger
SKYEHANDS_RUNTIME_PROVIDER=standalone-local-events
```

Without `SKYE_ALLOW_LOCAL_PROOF_SERVICES=1`, the app expects configured non-proof providers instead of silently defaulting into local proof lanes.

Use the proof profile above for local smokes and workflow demos. For production shape, start from `.env.production.example` and configure non-proof providers like:

```txt
SKYE_ALLOW_LOCAL_PROOF_SERVICES=0
PAYMENT_PROVIDER=stripe
NOTIFICATION_PROVIDER=twilio
ROUTE_INTELLIGENCE_PROVIDER=mapbox
IDENTITY_COMPLIANCE_PROVIDER=checkr
SKYEHANDS_RUNTIME_PROVIDER=skyehands-runtime-bus
```

S3/R2-compatible proof media and export packet storage is wired through the dependency-free object storage adapter:

```txt
STORAGE_DRIVER=r2
STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
STORAGE_BUCKET=skyeroutex-proof
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<access-key>
STORAGE_SECRET_ACCESS_KEY=<secret-key>
STORAGE_PREFIX=workforce-command
STORAGE_FORCE_PATH_STYLE=1
```

Use `STORAGE_DRIVER=s3-compatible` for non-R2 S3-compatible endpoints. The adapter signs PUT/HEAD requests with SigV4 and records object key, byte count, and SHA-256 metadata for `/api/storage/integrity`. `npm run smoke:storage:s3` proves deterministic signing against a local HTTP receiver.

Webhook-backed external provider adapters are also available for payment, notification, compliance, and SkyeHands runtime dispatch:

```txt
PAYMENT_PROVIDER=payment-webhook
PAYMENT_WEBHOOK_ENDPOINT=https://your-receiver.example/payment
PAYMENT_WEBHOOK_SIGNING_SECRET=<at-least-16-chars>
NOTIFICATION_PROVIDER=notification-webhook
NOTIFICATION_WEBHOOK_ENDPOINT=https://your-receiver.example/notification
NOTIFICATION_WEBHOOK_SIGNING_SECRET=<at-least-16-chars>
IDENTITY_COMPLIANCE_PROVIDER=compliance-webhook
COMPLIANCE_WEBHOOK_ENDPOINT=<compliance-webhook-endpoint>
COMPLIANCE_WEBHOOK_SIGNING_SECRET=<at-least-16-chars>
SKYEHANDS_RUNTIME_PROVIDER=skyehands-runtime-webhook
SKYEHANDS_RUNTIME_WEBHOOK_ENDPOINT=https://your-receiver.example/runtime
SKYEHANDS_RUNTIME_WEBHOOK_SIGNING_SECRET=<at-least-16-chars>
```

Webhook payloads are JSON signed with `x-skyeroutex-signature: sha256=<hmac>` over `<x-skyeroutex-timestamp>.<raw-body>`. Missing endpoints, invalid endpoint protocols, or weak/missing signing secrets fail closed at boot. `npm run smoke:webhooks` starts a local HTTP receiver and proves signed dispatch plus matching local ledger/outbox rows.

Native provider adapters are also wired for real provider APIs:

```txt
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>

NOTIFICATION_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<twilio-account-sid>
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_FROM_NUMBER=<from-number>
TWILIO_DEFAULT_TO=<recipient-number>

ROUTE_INTELLIGENCE_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=<mapbox-access-token>

IDENTITY_COMPLIANCE_PROVIDER=checkr
CHECKR_API_KEY=<checkr-api-key>
CHECKR_PACKAGE=<checkr-package>
CHECKR_WEBHOOK_SECRET=<checkr-webhook-secret>
```

`npm run smoke:native-providers` proves the native request contracts for Stripe PaymentIntents, Twilio Messages, Mapbox Directions, and Checkr Invitations, plus fail-closed credential guards. The proof intercepts outbound HTTP to verify exact provider contracts; the adapters default to the real provider API hosts when live credentials are supplied.

Provider callback reconciliation is covered by:

```txt
POST /api/providers/stripe/webhook
POST /api/providers/twilio/status
POST /api/providers/checkr/webhook
GET /api/providers/webhooks
npm run smoke:provider-webhooks
```

That proof sends signed callbacks, rejects a bad Stripe signature, updates payment/notification/compliance state, and writes provider webhook ledger rows.

The native SkyeHands platform bus adapter is also wired:

```txt
SKYEHANDS_RUNTIME_PROVIDER=skyehands-runtime-bus
SKYEHANDS_RUNTIME_BUS_DIR=/path/to/skyehands_runtime_control/.skyequanta
SKYEHANDS_RUNTIME_SOURCE_PLATFORM=skyeroutex-workforce-command
SKYEHANDS_RUNTIME_WORKSPACE_ID=skyeroutex-workforce-command
```

`npm run smoke:runtime-bus` proves runtime events are persisted locally, published into the canonical SkyeHands bus queue, hash-addressed in the bus envelope, and written to the bus audit ledger.

Admin/House Command can inspect the current truth with:

```txt
GET /api/integrations/status
```

The local provider lanes are wired into workflow code: payment ledger transitions, notification delivery rows, route metadata, compliance attestations, local runtime event mirrors, and durable integration outbox rows are all generated during normal job/assignment actions. `npm run smoke:integrations` proves those lanes directly, `npm run smoke:webhooks` proves the external webhook adapters, `npm run smoke:native-providers` proves native provider request contracts, and `npm run smoke:guards` proves missing credentials or unsupported providers fail hard instead of pretending to be connected.

Admin/House Command can inspect and reconcile provider handoff rows with `GET /api/integrations/outbox`, then mark rows `pending`, `dispatched`, or `failed` with `POST /api/integrations/outbox/:id/status`.

Proof media and export packets carry byte counts plus SHA-256 hashes, and House Command can verify local proof media with `GET /api/storage/integrity`.

The production SQL handoff lives at `schema/workforce-command.sql`. A dependency-free Postgres path is wired through the `psql` CLI:

```txt
DATABASE_DRIVER=postgres
DATABASE_URL=postgres://user:password@host:5432/skyeroutex
PSQL_BIN=psql
WORKFORCE_DOCUMENT_ID=default
```

Run `npm run migrate` before booting with `DATABASE_DRIVER=postgres`. The migration applies `schema/workforce-command.sql`, creates a transactional `workforce_app_documents` JSONB store for the current app document, and records `schema_migrations` metadata. The server refuses to boot the Postgres adapter when the URL is missing, and migrations refuse to run when `psql` or the URL is missing.

Local migration/readiness for that handoff is covered by:

```txt
npm run migrate
npm run migrate -- --check
npm run smoke:migrations
```

`npm run migrate` validates that every local JSON collection has a matching SQL handoff table. With `local-json`, it records `schema_migrations` metadata in the local JSON DB. With `postgres`, it applies the SQL handoff through `psql`, creates the document table, and records the migration in Postgres.

Security/readiness closure is also wired:

```txt
GET /api/readiness
npm run smoke:security
```

The server now applies security headers, CSP on HTML, body-size limits, rate limiting, stricter session cookies, CSRF protection for cookie-authenticated state changes, and a production boot gate that refuses unsafe defaults.

Data integrity closure is covered by:

```txt
npm run smoke:integrity
```

The server rejects malformed signup/job/rating/roster/dispute inputs and blocks illegal assignment state jumps.

Real browser click proof is covered by:

```txt
npm run smoke:browser-clicks
```

It uses a local Playwright/Chromium install when available and drives the UI through login, market creation, account creation, job posting, application, applicant acceptance, assignment actions, proof submission, approval, integration status, and backend state verification.

Audit tamper-evidence is covered by:

```txt
GET /api/admin/audit-integrity
npm run smoke:audit-chain
```

Audit events are hash-chained and the smoke mutates an event copy to prove tamper detection catches it.

Auth/session control is covered by:

```txt
npm run smoke:auth-control
```

It proves weak passwords are rejected, logout revokes sessions, admin user lists hide password hashes, and suspended users lose active sessions and cannot log back in.

Admin invite control is covered by:

```txt
npm run smoke:admin-invites
```

It proves only admin/House Command can create invites, invalid invite roles are rejected, raw invite tokens are returned once while stored as hashes, provider invite redemption requires company profile data, accepted invites create login-capable users/profiles, token reuse is blocked, duplicate user invites are blocked, and the lifecycle is audited.

Reset/seed integrity is covered by:

```txt
npm run smoke:reset
```

It proves `npm run reset` only creates the admin seed when explicit bootstrap env vars are present, records the hash-chained `admin_seeded` audit event, and leaves the datastore blank otherwise. It also proves external database reset drivers fail closed until their own migration/reset command exists.

Deployment readiness is covered by:

```txt
.env.production.example
deploy/skyeroutex-workforce-command.service
scripts/run-production.sh
docs/DEPLOYMENT.md
npm run smoke:deploy
```

The deploy smoke starts an isolated production-mode server, proves `/api/health`, `/api/readiness`, secure session cookie flags, and separately proves unsafe production defaults are rejected by the boot gate.

SkyeHands workspace mounting is covered by:

```txt
Dynasty-Versions/platform/user-platforms/skyeroutex-workforce-command/skyehands.platform.json
npm run smoke:mount
```

The mount smoke proves the main SkyeHands user-platform registry points to this app, the manifest resolves back to this source folder, and the launch/smoke profiles are ready.

See `docs/SKYEHANDS_INTEGRATION_BLUEPRINT.md` for the production adapter path.

## Current proven scope

✅ Auth and roles foundation
✅ City/state market creation and filtering
✅ Provider browser panel
✅ Contractor browser panel
✅ House Command browser panel
✅ Provider job posting from UI/API
✅ Contractor job feed and applications from UI/API
✅ Applicant pool review from UI/API
✅ Backend-enforced single-acceptance lock
✅ Backend-enforced multi-slot cap
✅ Assignment confirmation / on-way / check-in / check-out
✅ Proof submission
✅ Provider approval
✅ Payment ledger state advancement to `payout_eligible`
✅ Dispute opens and payment hold behavior
✅ Ratings foundation
✅ Provider roster/block routes
✅ House Command job/payment/audit surfaces
✅ Autonomous recommendation scoring
✅ Browser-panel smoke proof
✅ Real Chromium browser-click smoke proof
✅ End-to-end API smoke proof
✅ Security/readiness smoke proof
✅ Data integrity and assignment-transition guards
✅ Audit hash-chain tamper detection
✅ Auth logout/suspension/session revocation proof
✅ Admin-created single-use invite proof
✅ Local JSON migration metadata and SQL handoff coverage proof
✅ Durable integration outbox and dispatch status proof
✅ Native Stripe/Twilio/Mapbox/Checkr request-contract proof
✅ Signed provider callback reconciliation proof
✅ SkyeHands runtime bus queue/audit proof
✅ Reset seed audit-chain proof
✅ Deployment env, process runner, systemd unit, runbook, and production boot-gate smoke proof
✅ SkyeHands user-platform registry mount proof

## Still not production-complete

✅ Native Stripe payment intent adapter and signed callback reconciliation
✅ Dependency-free Postgres adapter/migration runner through `psql`
✅ Real S3/R2-compatible object storage for proof media and export packets
☐ Live account verification with real provider credentials
☐ Legal classification/compliance finalization
