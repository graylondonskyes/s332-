# AE Autonomous Store System — Maggie's Branch Directive

Branch: `ae-autonomous-store-system-maggies`

Purpose: turn the Maggie's liquor/smoke website donor into a real autonomous store system inside SkyeHands, using existing AE donor plumbing instead of brochure-only pages.

## Branch Intent

This branch exists to build a standalone AE-linked store system with real plumbing for:
- merchant signup and onboarding
- merchant inventory intake and editing
- public storefront sync from managed inventory state
- delivery booking and recurring delivery windows
- AE command visibility
- SkyeRoutexFlow / routex dispatch handoff
- AI-assisted merchant setup and inventory normalization
- proof-backed smoke and directive tracking

## Required donor lanes from SkyeHands

Use donor patterns from these existing lanes already in repo:
- `platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/source/AE-Central-Command-Pack-CredentialHub-Launcher/Branching Apps/AE-Brain-Command-Site-v8-Additive/`
- `platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/source/AE-Central-Command-Pack-CredentialHub-Launcher/Branching Apps/AE-Brain-Command-Site-v8-Additive/assets/storage.mjs`
- `platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/source/AE-Central-Command-Pack-CredentialHub-Launcher/Branching Apps/AI-Appointment-Setter-Brain-v33/`
- routex donor-intake and donor-merge smoke lanes referenced by `smoke:stage25` and `smoke:stage29`

## Donor input package

Primary public-surface donor input:
- `maggies_liquor_store_and_smoke_shop_with_delivery_page_v2(1).zip`

This zip is not the final system. It is the storefront donor shell to be absorbed into the AE autonomous store system.

## Target system shape

Create a new standalone platform root at:
- `platform/user-platforms/ae-autonomous-store-system-maggies/source/`

Inside that root, build these lanes:

### 1) Public Storefront Lane
- public storefront pages
- inventory listing pages fed by managed inventory data
- delivery booking pages fed by merchant settings
- weekly recurring delivery request flow
- on-demand delivery request flow

### 2) Merchant Admin Lane
- merchant signup
- merchant login shell
- merchant dashboard
- inventory CRUD
- pricing / stock / category / product image fields
- featured inventory toggles
- publish / unpublish controls
- delivery availability settings

### 3) AE Operations Lane
- AE-linked merchant roster
- merchant status pipeline
- store launch readiness dashboard
- merchant notes and operational handoff
- command visibility from AE donor lane patterns

### 4) Routex / Delivery Ops Lane
- route request creation from bookings
- recurring delivery window tracking
- driver dispatch-ready packet generation
- pickup-ready status sent from merchant side
- fulfillment state returned to merchant and AE lanes

### 5) AI Setup Lane
- AI-assisted inventory normalization
- AI-assisted category suggestions
- AI-assisted storefront copy generation under operator control
- AI-assisted merchant onboarding checklist completion support

### 6) Persistence / Sync Lane
- local-first state where useful
- IndexedDB + localStorage donor pattern where appropriate
- remote persistence lane for merchants, inventory, bookings, and route packets
- public storefront rebuild/sync from canonical merchant inventory state

### 7) Proof / Smoke Lane
- smoke for merchant signup surface
- smoke for inventory CRUD
- smoke for publish-to-storefront sync
- smoke for booking submission
- smoke for route packet creation
- smoke for AE visibility
- smoke for directive auto-update only after code-backed proofs

## Implementation rules

- no brochure-only fake lanes
- no dead buttons
- no claim without code path
- preserve donor branding quality where useful, but this is now a systems product, not a flyer site
- keep work additive and branch-local
- treat this as a real system intended to be extended later
- every future completion pass must update this directive only when code and smoke prove it

## Phase ledger

### Phase 1 — Branch foundation
- [ ] create platform root for autonomous store system
- [ ] ingest Maggie's donor public surface into new root
- [ ] add package.json and smoke entrypoint for this platform
- [ ] add branch manifest / platform manifest

### Phase 2 — Merchant admin core
- [ ] merchant auth shell
- [ ] merchant profile data model
- [ ] inventory CRUD model
- [ ] inventory admin UI
- [ ] publish/unpublish flow

### Phase 3 — Storefront sync core
- [ ] public inventory render from managed state
- [ ] featured product rail from managed state
- [ ] category browsing from managed state
- [ ] product detail lane from managed state

### Phase 4 — Delivery ops core
- [ ] booking form -> booking record
- [ ] recurring window model
- [ ] on-demand request model
- [ ] route packet generation
- [ ] pickup-ready / out-for-delivery / completed states

### Phase 5 — AE and Routex linkage
- [ ] AE merchant roster lane
- [ ] merchant launch readiness view
- [ ] routex dispatch intake lane
- [ ] fulfillment return sync to merchant + AE views

### Phase 6 — AI operator lane
- [ ] inventory normalization helper
- [ ] category suggestion helper
- [ ] merchant setup assistant lane
- [ ] controlled copy-generation helpers

### Phase 7 — smoke + directive proof
- [ ] smoke suite for public storefront sync
- [ ] smoke suite for merchant CRUD
- [ ] smoke suite for delivery + route packet flow
- [ ] directive auto-updater for this platform

## Immediate next build target

First concrete target for the next code pass:
1. create `platform/user-platforms/ae-autonomous-store-system-maggies/source/`
2. drop the Maggie's donor site into a `public-storefront/` lane under that root
3. add a new `merchant-admin/` lane with inventory JSON model, CRUD UI shell, and publish-state model
4. add a simple sync lane so storefront product cards render from managed inventory data instead of hardcoded copy
5. add smoke proving the admin inventory write changes the public storefront render source

## Completion standard

This branch is not done until a merchant can sign up, load inventory, publish it, and have the storefront update from that managed state, with delivery bookings flowing into a real record/dispatch lane.
