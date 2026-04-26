# SkyeCommerce Status

Version: 1.24.0 runtime bullshit-removal build.

Current posture: production-only commerce platform foundation with runtime-wired public checkout, signed public order recovery, honest connection-health provider validation, runtime OAuth install completion, deeper warehouse/Routex operational routes, and POS terminal closeout that lands in real order/cart/payment state. The remaining boundary is external credentials and deployed account validation, not fake local rails.

New in v1.24:

- Provider preview route removed from the production surface as a usable runtime feature; it now hard-404s.
- Provider validation wording and audit mode renamed to `connection_health` so the evidence matches what is actually being proven.
- OAuth install-session flow now persists state and completes through a real callback route.
- POS terminal payments now create a pending order shell plus transaction and finalize into paid/failed/voided/canceled runtime state.
- Merchant Command wording cleaned so it does not overclaim full live validation.
- Added runtime tests for OAuth completion and POS terminal closeout.

Proof run in this package:

- `node --check src/index.js`
- `node --check public/assets/js/merchant.js`
- `npm test` → 140/140 passing
- `npm run smoke` → passing
- `npm run smoke:providers` → 7/7 passing
- `npm run smoke:platform` → passing
- `npm run smoke:warehouse` → passing
- `npm run smoke:closure` → passing

Live-provider boundary: merchant traffic still requires real Stripe, PayPal, UPS, Cloudflare, Resend, Routex, warehouse, tax, fraud, receipt printer, and channel credentials, then `npm run verify:live` plus deployed webhook validation.
