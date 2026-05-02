# API Reference — SkyeRoutexFlow Workforce Command v0.2.0

Base URL: `<runtime-base-url>`

Use `x-skye-session: <session>` for API smoke calls, or browser cookie `skye_session` after login.

## Health / Readiness

GET `/api/health`  
GET `/api/readiness` — public readiness check with production safety checks and integration status.

## Auth

POST `/api/auth/signup`  
POST `/api/auth/login`  
POST `/api/auth/logout`  
POST `/api/auth/accept-invite` — redeems an active admin invite token into a user account. Provider invites require `company_name`. Tokens are single-use and expire.  
GET `/api/me`

## Admin / Users

GET `/api/admin/users` — admin/House Command only. Password hashes are never returned.  
GET `/api/admin/invites` — admin/House Command only. Lists invite metadata without token hashes.  
POST `/api/admin/invites` — admin/House Command only. Creates a single-use invite for `contractor`, `provider`, `crew`, `house_command`, or `ae` and returns the raw token once.  
POST `/api/admin/users/:id/status` — admin/House Command only. Supports `active`, `suspended`, and `disabled`; non-active statuses revoke existing sessions.

## Markets

POST `/api/markets` — admin, house_command, ae  
GET `/api/markets`

## Jobs

POST `/api/jobs` — provider, ae, house_command, admin  
GET `/api/jobs?city=Phoenix&state=Arizona`  
GET `/api/provider/jobs` — provider/operator view with applicant and assignment counts  
GET `/api/jobs/:id`  
POST `/api/jobs/:id/apply` — contractor, crew  
GET `/api/jobs/:id/applicants` — provider/operator  
POST `/api/jobs/:id/accept-applicant` — provider/operator  
POST `/api/jobs/:id/reject-applicant` — provider/operator

## Assignments

GET `/api/assignments` — role-filtered assignment list  
POST `/api/assignments/:id/confirm`  
POST `/api/assignments/:id/on-the-way`  
POST `/api/assignments/:id/check-in`  
POST `/api/assignments/:id/check-out`  
POST `/api/assignments/:id/proof`  
POST `/api/assignments/:id/approve`  
POST `/api/assignments/:id/dispute`

## Payments

GET `/api/payments/ledger`

## Ratings

POST `/api/ratings`

## Provider Roster / Block

POST `/api/provider/roster`  
POST `/api/provider/block`

## Notifications

GET `/api/notifications`

## Autonomous Recommendations

POST `/api/autonomous/recommend/:jobId`

## House Command

GET `/api/house-command/jobs`  
POST `/api/house-command/freeze-payment`  
POST `/api/house-command/resolve-dispute`

## Admin / Audit

GET `/api/admin/audit-events`
GET `/api/admin/audit-integrity` — admin/House Command only. Verifies the local hash-chained audit ledger.

## Integrations

GET `/api/integrations/status` — admin/House Command only. Returns the honest adapter map for database, proof storage, payment provider, notification provider, route intelligence, identity/compliance, and SkyeHands runtime inheritance.
GET `/api/integrations/outbox` — admin/House Command only. Optional query filters: `status=pending|dispatched|failed`, `provider_kind=payment_provider|notification_provider|route_intelligence|identity_compliance|skyehands_runtime`.
POST `/api/integrations/outbox/:id/status` — admin/House Command only. Marks an outbox row `pending`, `dispatched`, or `failed`; failed rows record `last_error`.
GET `/api/runtime/events` — admin/House Command only. Returns local SkyeHands runtime event mirror rows.
GET `/api/compliance/checks` — admin/House Command only. Returns local compliance attestation rows.
GET `/api/providers/webhooks` — admin/House Command only. Lists verified provider callback ledger rows, optionally filtered with `provider=stripe|twilio|checkr`.

Supported non-local provider drivers include `stripe`, `twilio`, `mapbox`, `checkr`, `payment-webhook`, `notification-webhook`, `compliance-webhook`, `skyehands-runtime-webhook`, and `skyehands-runtime-bus`. Missing required credentials fail closed at boot.

## Provider Webhook Intake

POST `/api/providers/stripe/webhook` — verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`, records the callback, and reconciles matching `payment_ledger` rows from PaymentIntent metadata.  
POST `/api/providers/twilio/status` — verifies `X-Twilio-Signature` with `TWILIO_AUTH_TOKEN` and `PUBLIC_BASE_URL`, records the callback, and reconciles matching notification rows by `notification_id` or `MessageSid`.  
POST `/api/providers/checkr/webhook` — verifies `X-Checkr-Signature`/`X-SkyeRoutex-Signature` with `CHECKR_WEBHOOK_SECRET`, records the callback, and reconciles matching compliance rows by candidate/user/check id.

## v0.4.0 Storage and Export Routes

### GET /api/storage/status
Admin/House Command only. Returns active storage driver, database path, local media/export roots for local storage, or object-storage bucket/endpoint/prefix for S3/R2 storage, plus proof-media and export-packet counts.

### GET /api/storage/integrity
Admin/House Command only. Verifies stored proof media byte counts and SHA-256 hashes. Local storage re-reads files; S3/R2 storage uses signed HEAD requests and `x-amz-meta-sha256`.

### GET /api/jobs/:id/export-packet
Exports a job proof packet containing the job, applications, assignments, proof items, proof media records, route jobs/stops, payments, disputes, ratings, and related audit events. Access is limited to the provider, assigned contractor/crew, admin, or House Command. Export packet rows include byte size and SHA-256.

### GET /api/house-command/market-report?city=Phoenix&state=Arizona
Admin/House Command only. Exports a market report packet with job, assignment, payment, dispute, and route-job totals for the selected city/state. Export packet rows include byte size and SHA-256.
