# Printful Embedded Design Maker Drop-In for Netlify Repos

This package now ships with four working lanes instead of one.

## Lane 1: intake mode
Works immediately on Netlify even before you have a Printful account.

What intake mode does:
- customer picks a product
- customer picks an allowed variant and print method
- customer uploads a logo for an on-page visual proof
- customer adjusts proof placement, text overlay, and notes
- your site computes a server-side quote from your pricing rules
- your site can export a validated order packet JSON
- customer submits an order request into Netlify Forms under your brand

## Lane 2: live Printful mode
Activates after you set up Printful EDM access and env vars.

What live mode does:
- boots Embedded Design Maker inside your site
- saves templates
- generates real mockups from saved templates
- creates draft or confirmed Printful orders
- uses your company-controlled pricing manifest

## Lane 3: cart builder + approval bundle lane
Works now without Printful and lets you stage multiple configured items before submission.

What the cart lane does:
- stages multiple configured items locally
- aggregates cart totals under your pricing rules
- exports one multi-item approval bundle JSON
- can submit one intake request for the whole cart
- is already wired for one live multi-item Printful order once templates exist

## Lane 4: order packet + proof lane
Works now without Printful and gives you stronger internal ops control.

What the packet lane does:
- validates product + pricing on the server
- packages customer, artwork, logistics, and pricing into one JSON packet
- gives you a download-ready handoff artifact for admin review or CRM ingestion

## Major code included

### Netlify Functions
- `_printful.js`
- `_storefront.js`
- `printful-runtime-status.js`
- `printful-quote.js`
- `printful-build-order-packet.js`
- `printful-build-cart-packet.js`
- `printful-admin-lock-order.js`
- `printful-admin-promote-order.js`
- `_order.js`
- `printful-create-nonce.js`
- `printful-get-template.js`
- `printful-stores.js`
- `printful-catalog-proxy.js`
- `printful-create-order.js`
- `printful-create-mockup-task.js`
- `printful-get-mockup-task.js`

### Site files
- `site/printful-pod/index.html`
- `site/printful-pod/admin.html`
- `site/printful-pod/partials/designer-shell.html`
- `site/printful-pod/partials/admin-shell.html`
- `site/printful-pod/config/storefront-products.json`
- `site/printful-pod/assets/css/printful-edm.css`
- `site/printful-pod/assets/js/printful-edm.js`
- `site/printful-pod/assets/js/printful-admin.js`
- `site/printful-pod/assets/js/printful-edm-config.js`
- `site/printful-pod/assets/js/partial-loader.js`
- `site/printful-pod/assets/img/tee-placeholder.svg`
- `site/printful-pod/assets/img/mug-placeholder.svg`
- `site/printful-pod/manifest.webmanifest`
- `site/printful-pod/sw.js`

### Directive
- `DIRECTIVES/PRINTFUL_POD_FOUNDATION_DIRECTIVE.md`

## What you edit first

### 1) Branding
Edit:
- `site/printful-pod/assets/js/printful-edm-config.js`

### 2) Products + pricing
Edit:
- `site/printful-pod/config/storefront-products.json`

This file now controls:
- product availability
- variant availability
- retail pricing tiers
- setup fees
- extra logo fees
- rush fees
- shipping fees
- tax estimate rate
- deposit percent
- method fees for print vs embroidery
- preview image + placement presets
- turnaround windows

### 3) Netlify env vars
Add these when you are ready for live Printful mode:

```env
PRINTFUL_API_TOKEN=pf_xxxxxxxxxxxxxxxxx
PRINTFUL_STORE_ID=1234567
PRINTFUL_ALLOWED_ORIGIN=https://www.yoursite.com
PRINTFUL_ORDER_CONFIRM_DEFAULT=false
PRINTFUL_BIND_NONCE_TO_REQUEST=true
```

## Honest limitation
Direct fulfillment cannot go live until you create the Printful account, request Embedded Design Maker access, create the correct token, and replace the starter catalog IDs with your real product and variant IDs.

## Quick startup path

1. Copy `netlify/functions/`, `site/printful-pod/`, and `DIRECTIVES/` into your repo.
2. Deploy to Netlify.
3. Open `/printful-pod/`.
4. Confirm intake mode loads.
5. Submit a test intake request.
6. Export a sample order packet.
7. Later connect Printful and switch the same page into live designer mode.

## Best next move
Use the included directive file as your repo handoff note, then wire your first real Printful product into `storefront-products.json`.


## New in this implementation pass

- multi-item cart builder in the browser
- cart totals and staged-line review UI
- multi-item cart bundle export
- multi-item intake submission path
- multi-item live order creation path for when Printful is wired


## New in this implementation pass

- internal admin review board at `site/printful-pod/admin.html`
- local inbox handoff from builder to admin board
- server-side price lock function with discount, shipping, tax, deposit, expiry, and workflow status controls
- locked approval artifacts stored locally for operator reuse
- live promotion function for approved locked orders
- shared order normalization helper extracted into `_order.js`

## New in this implementation pass

- client approval page at `site/printful-pod/approve.html`
- customer-safe status tracker page at `site/printful-pod/status.html`
- server-side client package builder with invoice + deposit request artifact lane
- server-side tracker updater for approval, payment, production, and fulfillment status changes
- stronger admin board with queue search/filtering, client package generation, invoice download, approval-link copy, and tracker history
- local package storage shared across admin, approval, and status pages for same-device workflow while you remain pre-backend


## Lane 5: backend vault + dashboard lane
Works now and adds a real server-side record layer for artifacts, locked orders, and client packages.

What the vault lane does:
- saves incoming artifacts to a backend state store
- saves locked orders and client packages server-side
- lets approval and status pages load packages by id
- gives you a dashboard page for queue, revenue, and status visibility
- uses Netlify Blobs automatically when `@netlify/blobs` is installed, otherwise falls back to a filesystem store for local/dev-friendly operation

### New backend state files
- `netlify/functions/_state-store.js`
- `netlify/functions/printful-state-save.js`
- `netlify/functions/printful-state-get.js`
- `netlify/functions/printful-state-list.js`
- `netlify/functions/printful-state-delete.js`

### New dashboard files
- `site/printful-pod/dashboard.html`
- `site/printful-pod/partials/dashboard-shell.html`
- `site/printful-pod/assets/js/printful-dashboard.js`
