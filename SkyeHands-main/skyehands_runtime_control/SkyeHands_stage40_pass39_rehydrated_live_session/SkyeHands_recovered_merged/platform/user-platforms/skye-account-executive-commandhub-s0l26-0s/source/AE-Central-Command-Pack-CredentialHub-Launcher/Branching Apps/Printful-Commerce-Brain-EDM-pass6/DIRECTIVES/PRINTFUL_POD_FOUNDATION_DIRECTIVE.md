# PRINTFUL POD FOUNDATION DIRECTIVE

## Purpose
This package is now split into four real operating lanes:

1. **Intake lane (works immediately on Netlify)**  
   Customers can choose a product, upload a logo for an on-page visual proof, adjust placement, add design notes, see company-controlled retail pricing, and submit an order request from your site into Netlify Forms.

2. **Packet lane (works immediately on Netlify)**  
   The server can now validate the storefront selection and generate an order packet JSON that bundles product, pricing, customer, and artwork instructions into one reusable ops artifact.

3. **Cart bundle lane (works immediately on Netlify)**  
   Multiple configured items can now be staged into a cart, aggregated under company pricing, and exported as one approval bundle or submitted as one intake request.

4. **Live fulfillment lane (activates after your Printful account exists)**  
   The same product selector and pricing lane can boot Printful Embedded Design Maker, save designs, generate real mockups from saved templates, and create draft or confirmed Printful orders from your website.

This means the repo is no longer blocked at the UI layer by missing Printful setup. It already has a working intake system, a real internal proof/packet system, and a direct upgrade path to full fulfillment.

## Major implementations added in this directive pass

### 1) Company-controlled storefront manifest expanded
A shared storefront manifest now drives:
- allowed products
- allowed variants
- retail quantity tiers
- allowed print methods
- shipping fee estimates
- deposit logic
- tax estimate logic
- local preview image + placement presets
- turnaround windows

Primary file:
- `site/printful-pod/config/storefront-products.json`

This is the single source of truth for product availability and your markup strategy.

### 2) Server-side quote engine upgraded
The quote function now calculates:
- tier-adjusted unit retail
- subtotal
- setup fee
- additional logo fee
- method fee
- digitize fee
- rush fee
- shipping estimate
- estimated tax
- deposit due
- balance due
- turnaround label

Files:
- `netlify/functions/_storefront.js`
- `netlify/functions/printful-quote.js`

### 3) Local proof builder upgraded
The frontend now supports proof controls that work before Printful exists:
- logo upload
- placement preset selection
- top/left/width/rotation sliders
- headline + subline overlays
- text color control
- design notes field

Files:
- `site/printful-pod/partials/designer-shell.html`
- `site/printful-pod/assets/css/printful-edm.css`
- `site/printful-pod/assets/js/printful-edm.js`

### 4) Packet export lane added
A new Netlify function validates the order state and returns a structured packet JSON for admin review or CRM ingestion.

File:
- `netlify/functions/printful-build-order-packet.js`

### 5) Saved draft/session behavior upgraded
The page now persists more than IDs. It stores and restores:
- selected product
- selected variant
- selected print method
- placement preset
- proof transform
- design text
- design notes
- saved template id
- quote total

File:
- `site/printful-pod/assets/js/printful-edm.js`

### 6) Embedded designer lane preserved
The page still supports:
- secure nonce generation
- live designer boot
- template save callback handling
- real mockup task generation
- mockup polling
- gallery rendering
- live order creation

Files:
- `netlify/functions/printful-create-nonce.js`
- `netlify/functions/printful-create-mockup-task.js`
- `netlify/functions/printful-get-mockup-task.js`
- `netlify/functions/printful-create-order.js`
- `site/printful-pod/assets/js/printful-edm.js`

## What must still be done by the operator
These items are outside code-only control and require your live business setup:

1. Create the Printful account.
2. Request Embedded Design Maker access.
3. Create the proper private token with Embedded Design Maker extension.
4. Add your domain in Printful.
5. Set Netlify env vars:
   - `PRINTFUL_API_TOKEN`
   - `PRINTFUL_STORE_ID`
   - `PRINTFUL_ALLOWED_ORIGIN`
   - `PRINTFUL_ORDER_CONFIRM_DEFAULT`
   - `PRINTFUL_BIND_NONCE_TO_REQUEST`
6. Replace starter product IDs and variant IDs inside the storefront manifest with your real catalog values.

## Deployment instructions
Drop these folders into your repo:
- `netlify/functions/`
- `site/printful-pod/`
- `DIRECTIVES/`

Then:
1. mount `/printful-pod/` into your site routing
2. deploy to Netlify
3. confirm intake mode works immediately
4. export a packet JSON
5. wire Printful later to unlock EDM + mockups + direct order creation

## Honest current state
- Intake mode: implemented and usable now on Netlify
- Company pricing control: implemented
- Local proof builder: implemented
- Packet export lane: implemented
- EDM integration lane: implemented but inactive until Printful is configured
- Direct Printful fulfillment: inactive until account/token/store data exist

## Completion map
### In control and now done
- local proof builder
- packet export lane
- richer pricing logic
- shipping/tax/deposit quote logic
- saved session restore depth
- product filtering and method selection

### Outside code-only control
- live Printful account creation
- EDM approval
- token/store/domain wiring
- real catalog IDs

## Next recommended operator move
Stand up the Printful account, then replace the sample catalog IDs in the storefront manifest. Once that is done, this package becomes a live white-label custom merch builder under your company brand.


## Major implementations added in the latest pass

### 7) Multi-item cart lane added
The storefront now supports staging multiple configured items before submission.

Files:
- `site/printful-pod/partials/designer-shell.html`
- `site/printful-pod/assets/css/printful-edm.css`
- `site/printful-pod/assets/js/printful-edm.js`
- `netlify/functions/printful-build-cart-packet.js`

### 8) Multi-item live order path added
The live order function now accepts an `items` array and can promote a staged cart into one Printful order once templates or external product IDs exist for each line.

File:
- `netlify/functions/printful-create-order.js`


## Major implementations added in the latest pass

### 9) Internal admin review board added
The repo now ships with a second branded page for operators. It can load packets and cart bundles from local storage, import JSON artifacts, review customer + line item scope, and manage approvals from one internal dashboard.

Files:
- `site/printful-pod/admin.html`
- `site/printful-pod/partials/admin-shell.html`
- `site/printful-pod/assets/js/printful-admin.js`
- `site/printful-pod/assets/css/printful-edm.css`

### 10) Builder-to-admin handoff lane added
Whenever a packet or cart bundle is created in the storefront, it is now stored into a shared local admin inbox so the operator dashboard can immediately review it. Manual queue buttons were also added to the builder UI.

Files:
- `site/printful-pod/assets/js/printful-edm.js`
- `site/printful-pod/partials/designer-shell.html`

### 11) Server-side price lock + approval artifact lane added
A new function now validates packets or bundles, recalculates controlled pricing, applies allowed operator overrides, and returns a locked approval artifact with workflow state and summary lines.

Files:
- `netlify/functions/printful-admin-lock-order.js`
- `netlify/functions/_order.js`

### 12) Locked-order promotion lane added
Approved locked artifacts can now be promoted into a live Printful order using the same normalized line-item rules as the storefront order path.

Files:
- `netlify/functions/printful-admin-promote-order.js`
- `netlify/functions/printful-create-order.js`
- `netlify/functions/_order.js`


## Major implementations added in the latest pass

### 13) Client approval page added
A new branded approval page now exists for customer-safe quote review. It can load a generated package, show quote and deposit details, and capture approval locally plus through Netlify Forms when deployed.

Files:
- `site/printful-pod/approve.html`
- `site/printful-pod/partials/approval-shell.html`
- `site/printful-pod/assets/js/printful-approve.js`

### 14) Branded invoice + payment-request artifact lane added
Locked approvals can now be transformed into a client package that includes invoice identifiers, deposit request data, payment instructions, approval URLs, and tracker URLs.

Files:
- `netlify/functions/printful-admin-build-client-package.js`
- `site/printful-pod/assets/js/printful-admin.js`
- `site/printful-pod/assets/js/printful-approve.js`

### 15) Customer-safe status tracker page added
A second public-facing page now renders tracker history, approval state, payment state, production updates, and fulfillment/tracking data from the generated client package.

Files:
- `site/printful-pod/status.html`
- `site/printful-pod/partials/status-shell.html`
- `site/printful-pod/assets/js/printful-status.js`
- `netlify/functions/printful-admin-update-status.js`

### 16) Admin board search, filter, package, and history upgrades added
The internal board now supports queue filtering, client-package generation, invoice export, approval-link copy, tracker updates, and timeline history review from the same operator surface.

Files:
- `site/printful-pod/partials/admin-shell.html`
- `site/printful-pod/assets/js/printful-admin.js`
- `site/printful-pod/assets/css/printful-edm.css`

## Updated completion map
### In control and now done
- local proof builder
- packet export lane
- cart bundle lane
- internal admin board
- client approval page
- invoice / deposit request artifact lane
- customer-safe status tracker page
- queue filtering/search/history

### Still mainly outside code-only control
- live Printful account creation
- EDM approval
- token/store/domain wiring
- real catalog IDs
- actual payment processor connection if you want automatic card capture instead of branded invoice/request flow


## Backend vault lane added
A new server-side state layer now exists for this package.

What changed:
- incoming artifacts can be saved to a backend state collection
- locked approvals auto-save server-side after lock
- client approval packages auto-save server-side when built or updated
- approval and tracker pages can now resolve a package by `id` instead of relying only on same-device local storage
- a dashboard page now surfaces queue totals, package totals, status distribution, and recent activity from the saved backend records

Storage behavior:
- if `@netlify/blobs` is present, the package uses a site-wide Netlify Blobs store
- if it is not present, the package falls back to a filesystem-backed local store for development and same-runtime testing

This moves the repo closer to a real operator workflow instead of a same-browser-only flow.
