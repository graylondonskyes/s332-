# JobPing No-Bullshit Continuation Pass

This pass fixes risk issues that would have burned the operator if they were left as-is.

## Fixed

- SMS consent is checked before automation creates/reserves SMS send events.
- SMS reservations are released if a queued/scheduled event is later blocked by consent, billing, or risk controls.
- Per-lead automated SMS cap now excludes the current message event from the cap count so the configured max is enforced correctly.
- Added `npm run proof:guardrails` and `npm run proof:all` static proof commands.

## Why it matters

Previously, an SMS event could be reserved before the app knew it was legally/contact-safe to send. That could make the usage ledger show committed usage for messages that should never have been sent. This pass closes that operator-cost leak.

## Still not claimed

This does not claim live Stripe, Twilio, Resend, AI, cron, or production database proof. Those remain deploy/live-var proof tasks.
