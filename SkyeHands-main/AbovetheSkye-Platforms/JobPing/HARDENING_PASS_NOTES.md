# JobPing hardening pass — customer portal, webhooks, scheduler

This pass extends the prior live-send + billing build with additional production lanes.

## Added

- Stripe customer portal session route: `POST /api/billing/portal`.
- Billing page now shows a real manage-billing action when a Stripe customer id exists.
- Twilio SMS delivery/status webhook: `POST /api/webhooks/twilio/status`.
- Twilio missed-call ingestion webhook: `POST /api/webhooks/twilio/missed-call`.
- Twilio webhook signature verification helper using `X-Twilio-Signature` and `TWILIO_AUTH_TOKEN`.
- `IngestEvent` Prisma model for raw inbound webhook storage and normalization tracking.
- Internal due-message dispatcher: `POST /api/internal/due-messages`.
- Expanded smoke contract covering billing portal, Twilio status callbacks, missed-call ingestion, and cron-safe due-message dispatch.

## Still honest gaps

- Real provider secrets must be set before live sends or verified webhooks can work.
- Database migration must be generated/applied for the new `IngestEvent` model.
- Twilio public webhook URLs must match deployed app URLs exactly for signature verification.
- Background execution still requires a real cron/worker calling `/api/internal/due-messages` with `x-jobping-internal-secret`.
- Missed-call ingestion now creates a real lead and dispatches automation, but phone-number matching depends on `account.businessPhone` matching the Twilio receiving number.

## No theater rule preserved

Missing provider configuration returns visible failures. Invalid webhooks return unauthorized errors. Scheduled messages are dispatched only through an internal-secret-protected route. No public-facing claim should state carrier-level missed-call automation is live until Twilio is configured and smoke-tested in deployment.
