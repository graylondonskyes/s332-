# SkyeHands Integration Blueprint

Version: v0.4.1-local-provider-closure  
Status: Local providers are wired and smoke-proven; external enterprise providers still require concrete adapters.

## What Changed

The local proof platform now has named adapter boundaries for the pieces that must inherit from the broader SkyeHands repo:

- `src/adapters/workforce-db.js` owns the workforce datastore contract.
- `src/adapters/proof-storage.js` owns proof media and export packet storage.
- `src/adapters/platform-services.js` owns payment, notification, route intelligence, compliance, and SkyeHands runtime provider contracts.
- `src/adapters/integration-registry.js` reports what is local proof, connected, or not configured.
- `GET /api/integrations/status` gives House Command/admin users an honest integration map.

The default behavior remains local and smoke-testable:

```txt
DATABASE_DRIVER=local-json
STORAGE_DRIVER=local-json
PAYMENT_PROVIDER=ledger-only
NOTIFICATION_PROVIDER=in-app-ledger
ROUTE_INTELLIGENCE_PROVIDER=route-structure-only
IDENTITY_COMPLIANCE_PROVIDER=local-attestation-ledger
SKYEHANDS_RUNTIME_PROVIDER=standalone-local-events
```

## Wired Local Providers

The closure build has real local provider drivers, not only environment names:

- Payment provider: `ledger-only` writes/stamps authorization, work-pending, approval-pending, held, and payout-eligible ledger rows.
- Notification provider: `in-app-ledger` writes stored delivery rows.
- Route intelligence provider: `route-structure-only` writes route-provider metadata, planned stop ETA placeholders, and late-risk labels.
- Compliance provider: `local-attestation-ledger` writes user and assignment attestation rows.
- SkyeHands runtime provider: `standalone-local-events` mirrors audit events into `runtime_events`.

These are still local proof providers. They prove integration contracts and state participation; they do not claim live money movement, SMS/email/push, live maps, KYC, background checks, tax handling, or SkyeHands runtime-bus connection.

## No Fake Enterprise Claims

Non-local database/storage drivers intentionally fail hard at boot until real adapters exist. This prevents accidental claims that Postgres, D1, R2, S3, Stripe, KYC, route intelligence, or SkyeHands runtime proof are connected when they are not.

`npm run smoke:guards` proves those hard failures for unimplemented external drivers.

## SQL Handoff

The production persistence contract is captured in:

```txt
schema/workforce-command.sql
```

It mirrors the local JSON state graph, including provider evidence tables: `payment_ledger`, `notifications`, `route_jobs`, `route_stops`, `runtime_events`, and `compliance_checks`.

## Inheritance Targets

### Database

Current: JSON file adapter.

Next real adapters:

- `postgres` or `neon-postgres`
- `cloudflare-d1`
- `skyehands-workspace-db`

The adapter must preserve the current state machine semantics around applicant acceptance, slot caps, assignment lifecycle, proof, dispute holds, audit events, and export records.

### Proof Storage

Current: local proof media and export files.

Next real adapters:

- `cloudflare-r2`
- `s3`
- `skyehands-proof-vault`

The adapter must return tamper-auditable media/export records and keep paths/URLs safe to expose in proof packets.

### Payments

Current: internal payment-state ledger only.

Next real adapters:

- authorization intent
- hold/freeze
- payout eligibility
- payout execution
- dispute hold/release

Do not convert `payout_eligible` into real money movement without a configured payment provider and explicit audit events.

### Notifications

Current: in-app notification rows only.

Next real adapters:

- email
- SMS
- push
- operator escalation channel

### Route Intelligence

Current: route jobs and stops only.

Next real adapters:

- geocoding
- ETA/distance
- late-risk scoring
- route proof packet enrichment

### SkyeHands Runtime

Current: standalone server.

Next real adapters:

- runtime bus event emission
- proof-chain export
- workspace/provider binding
- deployment readiness reporting

## Next Closure Pass

1. Implement one production database adapter against `schema/workforce-command.sql`.
2. Add migration/reset commands for that driver.
3. Implement R2/S3 proof storage.
4. Add provider health checks to `/api/integrations/status`.
5. Only then wire live payments, notifications, route intelligence, and SkyeHands runtime proof.
