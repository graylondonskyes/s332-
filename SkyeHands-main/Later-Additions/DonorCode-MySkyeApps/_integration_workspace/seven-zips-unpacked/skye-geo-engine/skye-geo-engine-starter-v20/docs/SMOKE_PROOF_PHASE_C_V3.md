# SMOKE PROOF — PHASE C / V3

As of 2026-04-07 (America/Phoenix)

## Commands run

- `npm run check`
- `npm run smoke:api`
- `npm run smoke:replay`
- `npm run smoke:publish`
- `npm run scan:routes`
- `npm run scan:ui`

## Smoke proof summary

### 1) API flow smoke

Verified:

- workspace create/list
- project create/list
- persisted audit run
- persisted content plan
- persisted prompt pack
- persisted research ledger and dedupe
- article brief creation
- multilingual article draft generation
- tone/CTA controls
- claim-to-source mapping
- FAQ injection
- infographic brief generation
- audit evidence export

### 2) Visibility replay smoke

Verified:

- replay prompt pack storage
- provider replay job creation
- answer parsing
- mention-share scoring
- citation-share scoring
- competitor-overlap scoring
- visibility dashboard aggregation
- visibility evidence export

### 3) Publish execution smoke

Verified:

- WordPress publish adapter path
- Webflow publish adapter path
- Shopify publish adapter path
- generic webhook/API publisher path
- publish reconciliation persistence
- failed publish detection
- retry queue behavior
- successful retry path
- publish evidence export

### 4) Static proof scans

Verified:

- route scanner found the new replay/publish/evidence routes
- UI scanner found the new live controls that hit those routes

## Notes on proof scope

The current proof is real code-path proof using controlled smoke targets and fetch stubs. That is enough to validate the implementation depth and state transitions inside the repo. It is not the same as live-provider proof against real external credentials and production endpoints. That remains blank and must stay blank until executed.

## Result

V3 earned new checkmarks only for the code that is now backed by the smoke suite listed above.
