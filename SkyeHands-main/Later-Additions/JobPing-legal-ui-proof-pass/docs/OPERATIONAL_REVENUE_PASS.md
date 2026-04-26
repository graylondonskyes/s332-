# JobPing Operational Revenue Pass

This pass adds code-owned hardening and charge-readiness features that do not require live provider secrets.

## Added

- Support ticket console and `/api/support/tickets`.
- Owner/admin alert email configuration through account settings.
- Notification event ledger for support and test alerts.
- Tenant-scoped portable JSON backup export and export history.
- Saved lead views for repeat operating filters.
- Website lead-capture embed snippet and public intake endpoint.
- Public intake rate limiting, billing-state guard, duplicate detection, consent capture, timeline logging, and automation dispatch.
- Trust Center page with operational transparency metrics and readiness checklist.
- Settings fields for notification email, owner alert email, failed-send alerts, and digest/report preferences.
- Prisma migration SQL for the new operational tables.

## Still live-environment dependent

- Running `npm install`, Prisma generate, migrations, and production build.
- Stripe/Twilio/Resend provider dashboard configuration.
- Real cron worker invocation.
- Live smoke proving checkout, SMS, email, webhooks, opt-out, and scheduled sends.

## No oversell boundary

The app can now be presented as a lead response, follow-up, review request, usage-limited messaging, and support-accountability SaaS. Do not claim full CRM, call-center, guaranteed booking, or unlimited messaging capability.
