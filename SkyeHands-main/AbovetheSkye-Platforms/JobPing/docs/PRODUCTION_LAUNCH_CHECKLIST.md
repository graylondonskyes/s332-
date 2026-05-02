# JobPing production launch checklist

## Code-complete without secrets
- Prisma schema includes consent, opt-out, retry, billing, automation, message, timeline, and tenant-scoped records.
- SMS STOP/START webhook exists and cancels pending SMS sends after opt-out.
- Send lane blocks inactive subscriptions and opted-out leads before provider calls.
- Retry lane creates a new queued message event instead of mutating failed history.
- Twilio delivery status webhook maps delivered, failed, undelivered, sent, queued, accepted, and sending states.
- Missed-call webhook creates a lead only after signed Twilio verification.
- Due-message dispatcher is protected by INTERNAL_CRON_SECRET.

## Required live variables
DATABASE_URL
SESSION_SECRET
SESSION_COOKIE_NAME
INTERNAL_CRON_SECRET
NEXT_PUBLIC_APP_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
STRIPE_PORTAL_RETURN_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
RESEND_API_KEY
RESEND_FROM_EMAIL

## Provider setup
- Apply Prisma migration against production Postgres.
- Configure Stripe product, price, checkout success/cancel URLs, webhook endpoint, and customer portal.
- Configure Twilio status callback URL: `/api/webhooks/twilio/status`.
- Configure Twilio inbound SMS URL: `/api/webhooks/twilio/inbound-sms`.
- Configure Twilio voice/missed-call webhook URL: `/api/webhooks/twilio/missed-call`.
- Configure cron to POST `/api/internal/due-messages` with `x-jobping-internal-secret`.

## Final proof before selling
- Run `npm install`.
- Run `npm run prisma:generate`.
- Run `npx prisma migrate deploy`.
- Run `npm run test`.
- Run `npm run build`.
- Run `npm run smoke:contract` against the deployed URL.
- Send one live SMS and one live email to owned test contacts.
- Trigger STOP from the test phone and confirm future sends are canceled.
- Complete a Stripe test checkout and confirm subscription state updates.
