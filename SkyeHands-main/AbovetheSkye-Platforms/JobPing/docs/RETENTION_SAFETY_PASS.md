# JobPing Retention + Safety Pass

This pass adds code-owned features that help JobPing charge responsibly without overselling or exposing the operator to uncontrolled costs.

## Added surfaces

- `/risk-controls` — owner-facing automation safety settings.
- `/value-report` — customer-facing monthly value proof surface.
- App shell links for Risk Controls and Value Report.

## Added safety controls

The Settings model now supports:

- `quietHoursStart`
- `quietHoursEnd`
- `dailyAutomatedSmsLimit`
- `leadCooldownHours`
- `autoPauseFailedSends`

Automated SMS now checks safety controls before queue/send:

- quiet hours block automated SMS;
- daily automated SMS limit blocks runaway usage;
- lead cooldown prevents hammering the same lead;
- existing fair-use and per-lead caps remain active.

## Added retention proof

The value report intentionally uses conservative assumptions. It does not guarantee bookings. It converts logged system activity into an explainable customer retention surface.

## Still live-dependent

- Actual provider sends;
- live billing proof;
- deployed cron;
- migration execution;
- clean install/build/test run;
- live smoke proof.
