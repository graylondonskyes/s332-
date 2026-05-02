# JobPing Charge-Ready Code Pass

This pass closes the code-owned launch gaps that were not dependent on live secrets.

## Added in this pass

- Internal admin/support console at `/admin`.
- Admin account list with billing status, lead count, message count, and consent count.
- Admin manual subscription-state override for launch support.
- Admin safety action to cancel queued/scheduled/retrying sends for an account.
- Admin failed/skipped send monitor with lead links and failure reasons.
- Admin provider/billing event monitor.
- Premium public landing page and pricing page copy/design.
- Premium signup/login surfaces.
- Premium authenticated shell/cards/buttons/status badges.
- Niche template packs for plumbing, HVAC, cleaning, and mobile detailing.
- Onboarding template-pack installer.
- Template page one-click pack re-application.
- `JOBPING_ADMIN_EMAILS` env allowlist.

## Still not code-completable without live environment

- Real Stripe product/price/portal/webhook dashboard configuration.
- Real Twilio number/webhook/status callback configuration.
- Real Resend domain/API configuration.
- Real Postgres migration execution.
- Real cron scheduler calling `/api/internal/due-messages`.
- Live smoke proof using production URLs and real provider events.

## Launch positioning

JobPing can now be sold as a focused lead-response and review automation SaaS for home-service businesses once live vars, migration, provider config, cron, and smoke proof are completed.
