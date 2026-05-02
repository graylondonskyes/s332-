# SkyeGateFS13 Live Variable Blockers

These are the remaining blockers that cannot be closed purely with local code edits.

## Gate deployment blockers
- `JWT_SECRET`
- `ADMIN_PASSWORD`
- `DB_ENCRYPTION_KEY`
- `KEY_PEPPER`
- attached Netlify DB / `NETLIFY_DATABASE_URL`

## Runtime-to-gate blockers
- `SKYGATEFS13_ORIGIN`
- `SKYGATEFS13_GATE_TOKEN`
- `SKYGATE_EVENT_MIRROR_SECRET` or `SKYGATEFS13_EVENT_MIRROR_SECRET`

## Vendor / provider blockers
- whichever provider keys you want the gate to serve as house credentials
- whichever push/deploy credentials you want the gate to own

## Billing blockers
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- callback URLs

## What local code already covers
- route surfaces
- dashboards
- env contract
- pricing transparency
- runtime env aliasing
- platform event ingest
- gate/user/admin endpoint scaffolding

## What still needs live proof after vars are filled
- real auth signup/login/me
- real user dashboard session flow
- real admin dashboard auth flow
- real runtime-to-gate launch proof
- real platform-event mirroring proof
- real provider billing proof
