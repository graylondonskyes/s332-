# JobPing No-Bullshit Fix Pass

This pass tightens the exact places where the product could burn the operator if treated casually.

## Fixed in code

- Public lead capture no longer trusts a raw `accountId`; it requires a hashed public intake token.
- Intake tokens can be rotated, and only the last four characters are stored for reference.
- Public intake now uses a persistent database-backed rate limit instead of only in-memory protection.
- Public SMS lead capture requires explicit SMS consent before automation can text the lead.
- Manual lead entry no longer assumes SMS/email consent just because a phone/email exists.
- Manual consent records are written only when explicit consent is passed.
- Stripe webhook verification now rejects stale signatures outside the tolerance window.
- Stripe webhook handling is idempotent for duplicate provider event IDs.
- Session signature parsing now avoids timing-safe compare length crashes.
- Static proof script added: `npm run proof:static`.
- Runtime env preflight script added: `npm run preflight`.
- Pricing copy no longer uses uncapped messaging language.

## Still impossible to finish inside code only

- Live Stripe dashboard setup.
- Live Twilio number and webhook configuration.
- Live Resend domain/API setup.
- Actual deployed cron execution.
- Production database migration execution.
- Real provider smoke with paid/live credentials.

## Proof performed in this environment

`node scripts/static-proof.mjs` was executed and passed.

## Why this matters

The public intake token fix closes a serious abuse path. Raw account IDs in public forms are not enough protection. The rate limit persistence fix prevents the rate limiter from resetting just because a serverless instance restarts. The consent fix prevents texting manually entered leads without explicit consent. The Stripe replay/idempotency fixes reduce billing mismatch risk.
