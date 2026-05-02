# SkyeRoutex Workforce Command Deployment

This app is dependency-light Node and boots directly from `src/server.js`. Production readiness is enforced at boot by the app's existing safety gate.

## Production Env

Start from the checked-in template:

```bash
cp .env.production.example .env.production
```

Required production values:

```txt
NODE_ENV=production
SKYE_ALLOW_LOCAL_PROOF_SERVICES=0
SKYE_ADMIN_EMAIL=house-command@internal.invalid
SKYE_ADMIN_PASSWORD=<long unique password, not UseStrongSecret123!>
SKYE_REQUIRE_CSRF=1
COOKIE_SECURE=1
MAX_BODY_BYTES=1048576
RATE_LIMIT_MAX=240
RATE_LIMIT_WINDOW_MS=60000
```

Replace the internal-only bootstrap email before real operator handoff if your deployment needs a routable mailbox.

For the local JSON database lane, keep the database path on persistent disk:

```txt
DATABASE_DRIVER=local-json
DATABASE_PATH=/var/lib/skyeroutex-workforce-command/skyeroutex-db.json
```

For local proof media/export packets, keep local storage on persistent disk:

```txt
STORAGE_DRIVER=local-json
MEDIA_ROOT=/var/lib/skyeroutex-workforce-command/proof-media
EXPORT_ROOT=/var/lib/skyeroutex-workforce-command/exports
```

For S3/R2-compatible proof media/export packet storage:

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

Use `STORAGE_DRIVER=s3-compatible` for non-R2 endpoints. Missing endpoint, bucket, region, access key, or secret fails closed at boot.

The concrete dependency-free production database lane is Postgres through the `psql` CLI:

```txt
DATABASE_DRIVER=postgres
DATABASE_URL=postgres://user:password@host:5432/skyeroutex
PSQL_BIN=psql
WORKFORCE_DOCUMENT_ID=default
```

Before first boot:

```bash
DATABASE_DRIVER=postgres DATABASE_URL=postgres://user:password@host:5432/skyeroutex npm run migrate
```

The Postgres migration applies `schema/workforce-command.sql`, creates `workforce_app_documents` for the current app document JSONB store, and writes `schema_migrations`. Missing `DATABASE_URL`/`POSTGRES_URL` or missing `psql` fails closed with explicit errors.

Native provider adapters are available for Stripe, Twilio, Mapbox, and Checkr-style compliance invitations:

```txt
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
STRIPE_CURRENCY=usd
STRIPE_CAPTURE_METHOD=manual

NOTIFICATION_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<twilio-account-sid>
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_FROM_NUMBER=<from-number>
TWILIO_DEFAULT_TO=<recipient-number>

ROUTE_INTELLIGENCE_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=<mapbox-access-token>
MAPBOX_PROFILE=driving

IDENTITY_COMPLIANCE_PROVIDER=checkr
CHECKR_API_KEY=<checkr-api-key>
CHECKR_PACKAGE=<checkr-package>
CHECKR_WORK_LOCATION=US
CHECKR_WEBHOOK_SECRET=<checkr-webhook-secret>
```

Missing provider credentials fail closed at boot. `npm run smoke:native-providers` verifies outbound HTTP request contracts and credential guards without marking any live provider as contacted.

This native/webhook set is the documented production shape. The proof-only provider lanes remain available for local smoke coverage, but they are no longer the default production profile.

Set `PUBLIC_BASE_URL` to the public HTTPS origin used by Twilio status callbacks. Provider callback intake is available at `/api/providers/stripe/webhook`, `/api/providers/twilio/status`, and `/api/providers/checkr/webhook`; `npm run smoke:provider-webhooks` proves signed callback verification and local ledger reconciliation.

Payment, notification, identity/compliance, and SkyeHands runtime can also use dependency-free webhook adapters when the endpoint and signing secret env vars are present:

```txt
PAYMENT_PROVIDER=payment-webhook
PAYMENT_WEBHOOK_ENDPOINT=https://your-receiver.example/payment
PAYMENT_WEBHOOK_SIGNING_SECRET=<long random secret>
NOTIFICATION_PROVIDER=notification-webhook
NOTIFICATION_WEBHOOK_ENDPOINT=https://your-receiver.example/notification
NOTIFICATION_WEBHOOK_SIGNING_SECRET=<long random secret>
IDENTITY_COMPLIANCE_PROVIDER=compliance-webhook
COMPLIANCE_WEBHOOK_ENDPOINT=<compliance-webhook-endpoint>
COMPLIANCE_WEBHOOK_SIGNING_SECRET=<long random secret>
SKYEHANDS_RUNTIME_PROVIDER=skyehands-runtime-webhook
SKYEHANDS_RUNTIME_WEBHOOK_ENDPOINT=https://your-receiver.example/runtime
SKYEHANDS_RUNTIME_WEBHOOK_SIGNING_SECRET=<long random secret>
```

For the repo-native SkyeHands platform bus, use:

```txt
SKYEHANDS_RUNTIME_PROVIDER=skyehands-runtime-bus
SKYEHANDS_RUNTIME_BUS_DIR=../../skyehands_runtime_control/.skyequanta
SKYEHANDS_RUNTIME_SOURCE_PLATFORM=skyeroutex-workforce-command
SKYEHANDS_RUNTIME_WORKSPACE_ID=skyeroutex-workforce-command
```

Each webhook request is JSON with `x-skyeroutex-provider-kind`, `x-skyeroutex-driver`, `x-skyeroutex-timestamp`, and `x-skyeroutex-signature`. Verify the HMAC-SHA256 signature against `<timestamp>.<raw-body>` before accepting the event.

## Process Runner

For a direct process run:

```bash
scripts/run-production.sh .env.production
```

For systemd:

```bash
sudo useradd --system --home /var/lib/skyeroutex-workforce-command --shell /usr/sbin/nologin skyeroutex
sudo mkdir -p /opt/skyeroutex-workforce-command /etc/skyeroutex-workforce-command /var/lib/skyeroutex-workforce-command
sudo chown -R skyeroutex:skyeroutex /var/lib/skyeroutex-workforce-command
sudo cp .env.production.example /etc/skyeroutex-workforce-command/production.env
sudo cp deploy/skyeroutex-workforce-command.service /etc/systemd/system/skyeroutex-workforce-command.service
```

After copying the app into `/opt/skyeroutex-workforce-command` and replacing the env placeholders:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now skyeroutex-workforce-command
sudo systemctl status skyeroutex-workforce-command
```

## Health And Readiness

Live checks:

```bash
curl -fsS <runtime-base-url>/api/health
curl -fsS <runtime-base-url>/api/readiness
```

Deploy smoke:

```bash
npm run smoke:deploy
```

That smoke starts an isolated production-mode server, proves `/api/health`, `/api/readiness`, secure session cookie flags, and then separately proves unsafe production defaults are rejected by the boot gate.

Object-storage smoke:

```bash
npm run smoke:storage:s3
```

That smoke uses a local HTTP receiver to prove SigV4 PUT/HEAD behavior without requiring live cloud credentials.

Database migration smoke:

```bash
npm run smoke:db
```

That smoke proves SQL coverage, local JSON migration idempotency, Postgres missing-config and missing-`psql` guards, and a recording `psql` Postgres schema/document-store round trip.
