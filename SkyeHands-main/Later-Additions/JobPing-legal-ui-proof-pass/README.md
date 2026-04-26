# JobPing

JobPing is a focused paid SaaS for home-service businesses: lead intake, instant reply automation, scheduled follow-up, missed-call lead capture, review-request automation, billing enforcement, message logging, consent/opt-out handling, and retry/audit lanes.

## Current status

This package is code-complete for the non-secret application layer. The remaining requirements should be live environment variables, provider dashboard setup, database migration execution, deployment, and live smoke proof.

## What is implemented

- Next.js app-router SaaS shell.
- Prisma/Postgres schema with tenants, users, subscriptions, leads, notes, message templates, automation rules, message events, timelines, settings, billing events, ingest events, and consent records.
- Account-scoped lead creation, lead detail, notes, timeline, status changes, and dashboard summaries.
- Automation queueing for welcome replies, follow-ups, missed-call leads, and review requests.
- Provider adapters for Twilio SMS and Resend email with explicit missing-config failures.
- Stripe checkout, webhook verification, subscription state persistence, and customer portal route.
- Internal send and due-message dispatcher routes protected by `INTERNAL_CRON_SECRET`.
- Twilio signed status webhook.
- Twilio signed missed-call webhook.
- Twilio signed inbound-SMS webhook with STOP/START handling.
- Consent/opt-out blocking before sends.
- Pending SMS cancellation when a lead opts out.
- Retry route for failed/skipped message events.
- Billing gating before operational sends.
- Legal pages for Terms, Privacy, and SMS Terms.
- Smoke contract and tests for template, consent, and tenant-scope helper behavior.

## Install

```bash
npm install
cp .env.example .env
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

## Test and proof commands

```bash
npm run test
npm run build
npm run smoke:contract
```

## Seed login

Email: `owner@jobping.local`
Password: `Password123!`

## Required live variables

See `.env.example` and `docs/PRODUCTION_LAUNCH_CHECKLIST.md`.

## Truth boundary

The code paths exist. Live delivery and billing cannot be truthfully called complete until Twilio, Resend, Stripe, cron, and production Postgres are configured and smoke-tested in the deployed environment.

## Charge-ready code pass additions

This package includes the code-owned work required to move the product closer to charging customers:

- `/admin` support console guarded by `JOBPING_ADMIN_EMAILS`.
- Admin account diagnostics, failed-send review, provider/billing event monitoring, billing status override, and queued-send cancellation.
- Premium public landing/pricing/signup/login UI pass.
- Premium authenticated shell and shared UI components.
- Niche template packs for plumbing, HVAC, cleaning, and mobile detailing.
- Onboarding and Templates screens can install/reinstall niche packs.

The only remaining launch blockers should be environment/deployment work: real provider vars, Stripe/Twilio/Resend dashboard setup, Postgres migration execution, cron setup, and live smoke proof.
