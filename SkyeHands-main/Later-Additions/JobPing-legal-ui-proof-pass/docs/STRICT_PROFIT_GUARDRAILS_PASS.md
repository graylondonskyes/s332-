# JobPing Strict Profit Guardrails Pass

This pass exists for one purpose: do not let usage silently burn cash.

## What changed

### 1. SMS reservations before provider calls
SMS segments are now reserved before queued/scheduled SMS events are allowed to stand. This means the app counts committed SMS usage, not only messages that already sent.

Without this, 500 scheduled messages could be queued before any usage was posted. That is how SMS cost bleed happens. This pass closes that gap.

Statuses in `UsageLedger`:
- `reserved`: SMS segments are committed for a queued/scheduled send.
- `posted`: provider send succeeded; reservation became real usage.
- `released`: provider failed, lead opted out, or send was canceled before delivery.

### 2. Hard cap now uses committed usage
The fair-use check now evaluates:

`posted SMS + reserved SMS + projected SMS`

This prevents scheduled jobs from slipping past the monthly cap.

### 3. Send route re-checks before provider call
Even if an event was created earlier, `/api/internal/send-message` re-checks:
- billing access
- consent/STOP state
- risk controls
- SMS reservation/fair-use cap

If any check fails, the provider is not called.

### 4. STOP releases reserved usage
When a lead opts out, pending SMS events are canceled and reserved usage is released so the account does not lose included SMS on messages that will not send.

### 5. Canceled queued automations release reservations
Operational safety actions that cancel queued/scheduled sends now release reserved SMS usage.

## Strict business rule

No SMS provider call should happen unless all of these are true:

- account subscription is `trial` or `active`
- lead has valid SMS consent and is not opted out
- quiet hours are not active
- daily automated SMS ceiling has not been hit
- per-lead cooldown has not been hit
- per-lead automated SMS cap has not been hit
- monthly committed SMS usage is under the plan cap, unless explicit overages are enabled and hard stop is off
- a reservation exists or can be created for the message event

## What still must be proven live

Code now enforces the policy, but deployment must still prove it with:

- database migration applied
- provider vars loaded
- Stripe webhook live proof
- Twilio live send proof
- Twilio STOP/START webhook proof
- cron proof for due-message dispatch
- cap test at 500 included SMS segments

## Launch default recommendation

Use these defaults:

- Starter: 500 SMS segments/month
- Overage: off by default
- Hard stop: on by default
- Daily automated SMS cap: 75
- Per-lead automated SMS cap: 4
- Lead cooldown: 18 hours
- Quiet hours: 8 PM to 8 AM local business time

These settings are intentionally conservative. They protect margin and reduce TCPA risk.
