# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V4

As of 2026-04-07 (America/Phoenix)

## 1) Mission

Build a Cloudflare-first, Neon-backed, multi-tenant AI-search growth platform that can materially outperform BabyLoveGrowth-class products by being deeper, more provable, more operator-controlled, and less dependent on hand-wavy automation claims.

This platform must function as one operating system with these lanes working together:

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
- `src/lib/access.ts`
- `src/lib/db.ts`
- `src/lib/env.ts`
- `src/lib/errors.ts`
- `src/lib/json.ts`
- `src/lib/id.ts`
- `src/lib/platformStore.ts`
- `src/lib/tenant.ts`
- `src/lib/time.ts`
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
- `src/routes/v1/auth.ts`
- `src/routes/v1/agency.ts`
- `src/routes/v1/backlinks.ts`
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
- `scripts/smoke-agency.mjs`
- `scripts/smoke-backlinks.mjs`
- `scripts/scan-routes.mjs`
- `scripts/scan-ui.mjs`
- `docs/SMOKE_PROOF_PHASE_D_V4.md`
- `docs/VALUATION_DELTA_V4.md`

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
- ✅ API-key auth lane exists at `GET/POST /v1/auth/keys`
- ✅ Auth / RBAC exists through API-key role enforcement and smoke-backed 403 denial paths
- ✅ Route-level API smoke suite exists at `scripts/smoke-api.mjs`
- ✅ Agency/backlink smoke suites exist at `scripts/smoke-agency.mjs` and `scripts/smoke-backlinks.mjs`
- ☐ Neon database adapter is smoke-proven against a live Neon target
- ☐ Durable job ledger exists in a live persistent target
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
- ✅ scheduled publishing exists
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

- ✅ partner-site registry exists
- ✅ site quality policy exists in code
- ✅ topical relevance scoring exists
- ✅ placement queue exists
- ✅ anchor diversity rules exist
- ✅ backlink reconciliation ledger exists
- ✅ fraud / abuse detection exists
- ✅ network health dashboard exists

### Agency / reseller lane

- ✅ org/workspace/seat operator UI exists
- ✅ white-label branding exists
- ✅ reseller client management exists
- ✅ usage metering exists
- ✅ plan / quota enforcement exists
- ✅ invoice / export lane exists
- ✅ role-based access control exists

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

- added API-key auth creation and listing routes
- added role-based access control with smoke-proven denial for underprivileged keys
- added org branding settings with white-label fields for display name, primary color, logo URL, and custom domain
- added seat management lane with role/status tracking
- added reseller client management lane with slug and brand fields
- added usage metering and monthly summary aggregation
- added quota enforcement on draft generation, replay execution, and publish execution lanes
- added invoice export generation from stored usage totals and pricing settings
- added scheduled publishing execution for due runs
- added backlink partner-site registry with quality scoring and policy flags
- added placement queue generation with topical relevance scoring and anchor diversity scoring
- added backlink reconciliation and network health dashboard
- updated operator UI with auth, agency, scheduled publish, and backlink controls
- expanded route and UI scanners to prove the new controls and paths
- expanded smoke suite so agency/reseller/auth/quota and backlink operations are exercised end to end

## 6) Build order from here

Do not skip ahead. Build in this order.

### Phase E — Live Neon proof

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

### Phase F — Live provider publish proof

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

- provider-target smoke must hit a real endpoint and read back the reconciled ledger row

### Phase G — Remaining provider adapters

Goal: close the CMS-surface parity gap.

Required work:

- add Wix payload / execute adapter
- add Ghost payload / execute adapter
- add smoke fixtures for both adapters

Acceptance:

- both adapters can create payloads
- both adapters are smoke-exercised end to end against stubs

Smoke requirement:

- dedicated adapter smoke covering create, execute, response parse, and retry behavior if applicable

### Phase H — Real browser UI automation

Goal: move beyond route/UI scanners into browser-driven surface proof.

Required work:

- add a browser automation harness that loads `/app`
- create workspaces/projects through the visible controls
- execute at least one run for audit, brief, draft, publish, auth/agency, and backlink flows
- fail if a visible control is dead or a response never renders

Acceptance:

- the browser automation suite runs headlessly and passes
- the suite fails on dead controls or missing result panes

Smoke requirement:

- browser-driven smoke artifact saved alongside the proof doc

## 7) Completion truth right now

The repo is materially deeper than V3 and the code-backed build is now in the high-completeness zone, but it is not finished.

Current honest completion estimate:

- **about 84% complete**

What is still meaningfully open on my side:

- live Neon smoke proof
- live persistent job/history proof
- Wix adapter
- Ghost adapter
- live remote CMS publish proof
- real browser UI automation smoke

Everything else moved in this directive is backed by code and smoke, not by planning language.
