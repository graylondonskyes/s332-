# SkyeCommerce Shopify Replacement Foundation v1.24.0

Cloudflare-native merchant commerce platform foundation with production-only runtime behavior. This pass removes more of the remaining bullshit by wiring OAuth completion, making POS terminal flow close into real order state, deleting preview-route behavior from the production surface, and renaming provider checks honestly as connection-health validation rather than pretending they are full live-lane proofs.

## v1.24.0 runtime fixes

- Provider preview route no longer behaves like a lingering production feature. `POST /api/provider-connections/preview` now returns `404` with a removal message instead of shipping a fake-but-blocked preview surface.
- Provider validation wording and recorded mode now state `connection_health`, which is what the code actually proves.
- OAuth install flow is now runtime-complete: `POST /api/apps/:id/oauth/install-session` persists state, and `GET /api/app-installations/oauth/callback` finalizes the installation state and redirects back to Merchant Command.
- POS terminal flow is now end-to-end in runtime routes. `POST /api/pos/terminal-payments` creates a pending order shell and linked transaction, and `POST /api/pos/terminal-payments/:id/finalize` closes the loop into paid/failed/voided/canceled state, updates the cart, updates the order, writes audit events, and allocates inventory only on successful completion.
- Merchant UI wording now says connection-health checks instead of overstating them as full live validation.

## Required production bindings and secrets

At minimum, production use requires Cloudflare D1 binding `DB`, `SESSION_SECRET`, `PROVIDER_CONFIG_ENCRYPTION_KEY`, CSRF/rate-limit settings, and real provider credentials for the lanes enabled by a merchant: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, UPS credentials, Resend credentials, Routex/warehouse/fulfillment endpoints, receipt-printer endpoint/secret, tax provider endpoint/secret, fraud provider endpoint/secret, and any active channel provider secrets.

## Commands

```bash
npm test
npm run smoke
npm run smoke:providers
npm run smoke:platform
npm run smoke:warehouse
npm run smoke:closure
npm run verify:live
```

`npm run verify:live` intentionally requires real Stripe, PayPal, and UPS credentials. The other smoke scripts prove route wiring, request construction, fail-closed policies, signing, and subsystem logic without pretending to be live provider traffic.

## Honest boundary

This package is no longer pretending that connection-health checks are full provider-action proof, and it no longer leaves OAuth callback or POS terminal closeout half-wired. The remaining external boundary is still real deployed Cloudflare bindings, real provider credentials, real merchant/provider accounts, legal/compliance review, and live account validation before merchant traffic.
