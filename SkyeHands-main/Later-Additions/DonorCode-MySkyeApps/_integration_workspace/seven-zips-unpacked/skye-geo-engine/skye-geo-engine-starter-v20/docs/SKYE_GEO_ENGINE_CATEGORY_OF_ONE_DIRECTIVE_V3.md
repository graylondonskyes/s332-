# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V3

As of 2026-04-07 (America/Phoenix)

## 1) Mission

Build a Cloudflare-first, Neon-backed, multi-tenant AI-search growth platform that can materially outperform BabyLoveGrowth-class products by being deeper, more provable, more operator-controlled, and less dependent on hand-wavy automation claims.

This platform must become a full growth operating system with these lanes working together:

- intake and workspace creation
- technical GEO / SEO audit
- research and source harvesting
- article brief generation
- long-form article generation with claim-to-source mapping
- schema / internal link / FAQ enrichment
- CMS publishing and reconciliation
- visibility replay against AI answer surfaces
- backlink / distribution network operations
- tenant / agency / reseller controls
- proof ops / smoke / replay / audit evidence

The platform only earns a checkmark when the feature is backed by real code and a real smoke path. No theater. No fake controls. No “coming soon” dressed up as done.

## 2) Locked standards

### Product standards

- Cloudflare is the default runtime.
- Neon is the default persistent data layer.
- Every visible control in the UI must do something real.
- Every major claim must have a smoke path.
- Every smoke must verify real routes and real state transitions, not just file existence.
- Fail loud when configuration is missing.
- Use one naming system throughout the product.
- No legacy residue, no orphan routes, no dead navigation.
- Client-facing surfaces stay client-facing only.

### Proof standards

- A feature is not done until a smoke proves it end to end.
- Checkmarks are allowed only for code paths that already exist and can be exercised.
- Blank boxes remain blank until the smoke is real.
- Never mark work complete because it is designed, scaffolded, or easy to add later.

### Strategic standards

- Winning is not just article generation.
- The moat is the combination of audit depth, publishing automation, replayable visibility evidence, distribution, and multi-tenant controls.
- Source provenance must be first-class.
- Publish logs must be first-class.
- Visibility logs must be first-class.
- Backlink / distribution quality must be first-class.

## 3) Current repo truth

The following paths exist in the current repo and are part of the real implemented surface now:

- `src/index.ts`
- `src/ui/app.ts`
- `src/lib/db.ts`
- `src/lib/env.ts`
- `src/lib/errors.ts`
- `src/lib/json.ts`
- `src/lib/id.ts`
- `src/lib/time.ts`
- `src/lib/tenant.ts`
- `src/routes/v1/workspaces.ts`
- `src/routes/v1/projects.ts`
- `src/routes/v1/jobs.ts`
- `src/routes/v1/audit.ts`
- `src/routes/v1/content.ts`
- `src/routes/v1/research.ts`
- `src/routes/v1/articles.ts`
- `src/routes/v1/publish.ts`
- `src/routes/v1/visibility.ts`
- `src/routes/v1/evidence.ts`
- `src/lib/research/fetchUrl.ts`
- `src/lib/research/extractText.ts`
- `src/lib/research/normalizeSource.ts`
- `src/lib/research/sourceLedger.ts`
- `src/lib/articles/brief.ts`
- `src/lib/articles/draft.ts`
- `src/lib/publish/wordpress.ts`
- `src/lib/publish/webflow.ts`
- `src/lib/publish/shopify.ts`
- `src/lib/publish/generic.ts`
- `src/lib/publish/reconcile.ts`
- `src/lib/visibility/replay.ts`
- `sql/001_init.sql`
- `sql/002_core_tables.sql`
- `sql/003_indexes.sql`
- `sql/004_rls_or_tenant_guards.sql`
- `sql/005_growth_lanes.sql`
- `sql/006_growth_indexes.sql`
- `scripts/smoke-api.mjs`
- `scripts/smoke-replay.mjs`
- `scripts/smoke-publish.mjs`
- `scripts/scan-routes.mjs`
- `scripts/scan-ui.mjs`
- `docs/SMOKE_PROOF_PHASE_C_V3.md`
- `docs/VALUATION_DELTA_V3.md`

## 4) Status ledger

Only use checkmarks and blanks.

### Foundation lane

- ✅ Cloudflare Worker entrypoint exists at `src/index.ts`
- ✅ Operator UI exists at `src/ui/app.ts`
- ✅ Workspace CRUD exists at `GET/POST /v1/workspaces`
- ✅ Project CRUD exists at `GET/POST /v1/projects`
- ✅ Workspace history ledger exists at `GET /v1/history`
- ✅ Live audit lane exists at `POST /v1/audit/site`
- ✅ 30-day content-plan lane exists at `POST /v1/content/plan`
- ✅ Visibility prompt-pack lane exists at `GET/POST /v1/visibility/prompt-pack`
- ✅ CMS payload mapping lane exists at `GET/POST /v1/publish/payload`
- ✅ Initial SQL bootstrap exists at `sql/001_init.sql`
- ✅ Core table pack exists at `sql/002_core_tables.sql`
- ✅ Index pack exists at `sql/003_indexes.sql`
- ✅ Tenant-guard SQL exists at `sql/004_rls_or_tenant_guards.sql`
- ✅ Org/workspace scope guards exist in route flow
- ✅ Route-level API smoke suite exists at `scripts/smoke-api.mjs`
- ☐ Neon database adapter is smoke-proven against a live Neon target
- ☐ Durable job ledger exists in a live persistent target
- ☐ Auth / RBAC exists
- ☐ Real browser UI smoke suite exists

### Research and writing lane

- ✅ URL research fetcher exists
- ✅ Raw-text ingest exists
- ✅ Source normalization exists
- ✅ Source dedupe ledger exists
- ✅ Persisted source store exists
- ✅ Outline engine exists through brief generation
- ✅ Article brief engine exists
- ✅ Article draft engine exists
- ✅ Brief-to-source linkage exists
- ✅ Draft citations are stored with the article record
- ✅ claim-to-source mapping exists at sentence/claim granularity
- ✅ rewrite / tone / CTA controls exist
- ✅ FAQ injection exists
- ✅ infographic prompt / asset lane exists
- ✅ multilingual generation lane exists

### Publishing lane

- ✅ WordPress publish-payload adapter exists and is smoke-exercised
- ✅ publish payload persistence ledger exists
- ✅ Webflow publish adapter is smoke-exercised
- ✅ Shopify publish adapter is smoke-exercised
- ☐ Wix publish adapter exists
- ☐ Ghost publish adapter exists
- ✅ Generic webhook / API publisher is smoke-exercised
- ✅ publish reconciliation ledger exists beyond payload storage
- ✅ failed publish retry queue exists
- ☐ scheduled publishing exists
- ☐ live remote CMS publish exists

### Visibility lane

- ✅ saved prompt sets exist
- ✅ provider replay jobs exist
- ✅ answer parsing exists
- ✅ mention-share scoring exists
- ✅ citation-share scoring exists
- ✅ competitor-overlap scoring exists
- ✅ time-series visibility dashboard exists
- ✅ replay evidence export exists

### Backlink / distribution lane

- ☐ partner-site registry exists
- ☐ site quality policy exists in code
- ☐ topical relevance scoring exists
- ☐ placement queue exists
- ☐ anchor diversity rules exist
- ☐ backlink reconciliation ledger exists
- ☐ fraud / abuse detection exists
- ☐ network health dashboard exists

### Agency / reseller lane

- ☐ orgs / workspaces / seats UI exists
- ☐ white-label branding exists
- ☐ reseller client management exists
- ☐ usage metering exists
- ☐ plan / quota enforcement exists
- ☐ invoice / export lane exists
- ☐ role-based access control exists

### Proof ops lane

- ✅ smoke CLI exists
- ✅ replay CLI exists
- ✅ smoke proof doc exists
- ✅ valuation-delta doc exists
- ✅ audit evidence export exists
- ✅ publish evidence export exists
- ✅ visibility evidence export exists
- ✅ route scanner exists for dead-nav detection
- ✅ UI scanner exists for fake-button detection

## 5) What was code-implemented in this pass

- expanded article records to store language, tone, CTA, infographic prompt, claim maps, and FAQ items
- upgraded article draft generation so it can output multilingual drafts with explicit claim-to-source mapping and FAQ blocks
- added publish execution adapters for WordPress, Webflow, Shopify, and generic webhook/API targets
- added publish reconciliation parsing and persisted publish status, remote ids, response excerpts, attempt counts, and retry paths
- added visibility replay evaluation with mention-share, citation-share, competitor-overlap scoring, and stored run history
- added visibility dashboard aggregation
- added audit/publish/visibility evidence export lanes
- added route scanner and UI scanner CLIs to prove the new live controls and endpoint coverage
- updated operator UI so the new controls hit real routes
- added SQL migrations for the new growth lanes and indexes

## 6) Build order from here

Do not skip ahead. Build in this order.

### Phase D — Live Neon proof

Goal: make the adapter-backed persistence lane smoke-proven against a real Neon target instead of memory-only smoke.

Required work:

- set `DB_MODE=neon-http`
- point `NEON_SQL_URL` at the real SQL bridge / endpoint used by deployment
- run the current smoke flow end to end against Neon
- save a proof doc with returned IDs and row reads

Acceptance:

- the same smoke flow passes against Neon
- workspace history reads back from Neon
- job history survives process restarts

Smoke requirement:

- duplicate the current smoke flow with live Neon config
- capture inserted IDs and read them back in a second process pass

### Phase E — Live provider publish proof

Goal: move from smoke-backed adapter execution into live remote targets.

Required work:

- point WordPress / Webflow / Shopify / generic adapters at real targets
- capture remote identifiers and success/failure states
- prove a retry against a real failure condition
- retain reconciliation data in the publish ledger

Acceptance:

- at least one real provider target publishes successfully
- a real failed publish can be retried and reconciled
- publish evidence export contains a real remote id

Smoke requirement:

- run `scripts/smoke-publish.mjs` against live credentials or a provider sandbox target
- prove the same run in a second process readback

### Phase F — Backlink / distribution moat

Goal: build the lane that actually differentiates the platform from thin content tools.

Required work:

- partner-site registry
- quality policy
- placement queue
- anchor diversity rules
- backlink reconciliation
- fraud / abuse checks

Acceptance:

- placements can be queued, scored, and tracked
- low-quality or duplicate placements are rejected
- the network has its own operator dashboard

### Phase G — Agency / reseller controls

Goal: make the product multi-tenant enough to sell cleanly.

Required work:

- role-based access control
- plan / quota enforcement
- usage metering
- invoice / export lane
- white-label branding and reseller client management

Acceptance:

- an org owner can manage users and workspaces
- quotas are enforced
- exports and usage ledgers are tied to plan state

## 7) Completion read

This repo is materially further along than V2, but it is not complete.

The code-backed state is now strong in these areas:

- source-ledger research flow
- article composition depth
- publish adapter depth
- replay and scoring depth
- evidence / proof depth

The real remaining heavy gaps are:

- live Neon proof
- live provider publish proof
- backlink/distribution moat
- agency / reseller lane
- auth / RBAC
- real browser automation smoke
