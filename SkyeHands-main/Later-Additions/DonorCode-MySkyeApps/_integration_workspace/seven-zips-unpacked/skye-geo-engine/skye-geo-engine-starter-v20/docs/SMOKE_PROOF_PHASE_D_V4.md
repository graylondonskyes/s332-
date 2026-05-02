# SMOKE PROOF — PHASE D / V4

As of 2026-04-07 (America/Phoenix)

## Smoke command executed

```bash
npm run smoke
```

## Result

Passed.

## Smoke lanes that passed

### 1) Core API smoke — `scripts/smoke-api.mjs`

Verified:

- workspace create
- project create
- persisted audit run
- persisted content plan
- persisted prompt pack
- deduped source ingest
- article brief generation
- multilingual article draft generation
- tone / CTA controls
- claim-to-source mapping
- FAQ injection
- audit evidence export
- workspace history readback

### 2) Visibility replay smoke — `scripts/smoke-replay.mjs`

Verified:

- replay job creation
- answer parsing
- mention-share scoring
- citation-share scoring
- competitor-overlap scoring
- visibility dashboard summary
- visibility evidence export

### 3) Publish smoke — `scripts/smoke-publish.mjs`

Verified:

- WordPress execution adapter
- Webflow execution adapter
- Shopify execution adapter
- generic webhook publisher
- publish reconciliation ledger
- failed publish retry queue
- scheduled publishing lane
- publish evidence export

### 4) Agency/auth/quota smoke — `scripts/smoke-agency.mjs`

Verified:

- API-key creation
- role-based access control
- 403 denial path for underprivileged key
- white-label branding settings save
- seat creation
- reseller client creation
- usage metering summary
- article-draft quota enforcement
- invoice export generation

### 5) Backlink/distribution smoke — `scripts/smoke-backlinks.mjs`

Verified:

- partner-site registry
- quality policy scoring
- topical relevance scoring
- placement queue creation
- anchor diversity scoring
- rejection / flagging path for low-quality sites
- backlink reconciliation to live status
- network health dashboard summary

### 6) Route scan — `scripts/scan-routes.mjs`

Verified that the Worker entrypoint contains the expected live routes for:

- replay
- publish scheduling
- auth
- agency
- backlinks

### 7) UI scan — `scripts/scan-ui.mjs`

Verified that the operator UI contains live controls and bound paths for:

- scheduled publishing
- auth key creation
- agency branding/seat/client/invoice actions
- backlink site/placement/reconcile/dashboard actions

## Smoke-backed truth from this pass

The following claims are now backed by smoke and therefore eligible for directive checkmarks:

- API-key auth lane
- role-based access control
- white-label branding settings
- seat management
- reseller client management
- usage metering
- plan/quota enforcement
- invoice export lane
- partner-site registry
- site quality policy
- topical relevance scoring
- placement queue
- anchor diversity rules
- backlink reconciliation ledger
- fraud / abuse detection
- network health dashboard
- scheduled publishing lane

## Still not smoke-proven here

- live Neon persistence against a real Neon target
- live remote CMS publish against real external providers
- browser-driven UI automation smoke
