# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V11

As of 2026-04-08 (America/Phoenix)

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
- workspace backup / restore / clone portability
- client / investor / operator report sites
- workspace proof matrix and walkthrough completion
- runtime-aware readiness, claim catalog, and contract-truth exports

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
- Walkthroughs and report sites must explain only what the platform can actually do right now.
- Readiness and contract-truth surfaces must separate locally proved capability from live-runtime blockers.

### Proof standards

- A feature is not done until a smoke proves it end to end.
- Checkmarks are allowed only for code paths that already exist and can be exercised.
- Blank boxes remain blank until the smoke is real.
- Never mark work complete because it is designed, scaffolded, or easy to add later.

### Strategic standards

- Winning is not just article generation.
- The moat is the combination of audit depth, publishing automation, replayable visibility evidence, distribution, multi-tenant controls, portability / proof retention, and report-grade explainability.
- Source provenance must be first-class.
- Publish logs must be first-class.
- Visibility logs must be first-class.
- Backlink / distribution quality must be first-class.
- Workspace state must be exportable, restorable, and cloneable without ID collisions.
- Report sites, walkthrough completion, proof matrices, readiness maps, and claim catalogs must be generated from the live workspace ledger and the real capability graph.

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
- `src/lib/reporting.ts`
- `src/lib/readiness.ts`
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
- `src/routes/v1/bundles.ts`
- `src/routes/v1/capabilities.ts`
- `src/routes/v1/reporting.ts`
- `src/routes/v1/readiness.ts`
- `src/routes/v1/strategy.ts`
- `src/lib/research/fetchUrl.ts`
- `src/lib/research/extractText.ts`
- `src/lib/research/normalizeSource.ts`
- `src/lib/research/sourceLedger.ts`
- `src/lib/articles/brief.ts`
- `src/lib/articles/draft.ts`
- `src/lib/publish/wordpress.ts`
- `src/lib/publish/webflow.ts`
- `src/lib/publish/shopify.ts`
- `src/lib/publish/wix.ts`
- `src/lib/publish/ghost.ts`
- `src/lib/publish/generic.ts`
- `src/lib/publish/reconcile.ts`
- `src/lib/visibility/replay.ts`
- `src/lib/capabilities.ts`
- `sql/001_init.sql`
- `sql/002_core_tables.sql`
- `sql/003_indexes.sql`
- `sql/004_rls_or_tenant_guards.sql`
- `sql/005_growth_lanes.sql`
- `sql/006_growth_indexes.sql`
- `scripts/helpers/test-server.mjs`
- `scripts/helpers/persistent-test-server.mjs`
- `scripts/helpers/run-test-server.mjs`
- `scripts/smoke-api.mjs`
- `scripts/smoke-replay.mjs`
- `scripts/smoke-publish.mjs`
- `scripts/smoke-agency.mjs`
- `scripts/smoke-backlinks.mjs`
- `scripts/smoke-bundles.mjs`
- `scripts/smoke-truth.mjs`
- `scripts/smoke-readiness.mjs`
- `scripts/smoke-strategy.mjs`
- `scripts/smoke-reporting.mjs`
- `scripts/smoke-neon-transport.mjs`
- `scripts/smoke-durable-ledger.mjs`
- `scripts/smoke-browser-ui.mjs`
- `scripts/smoke-real-browser.py`
- `scripts/scan-routes.mjs`
- `scripts/scan-ui.mjs`
- `docs/SKYE_GEO_ENGINE_CATEGORY_OF_ONE_DIRECTIVE_V9.md`
- `docs/SMOKE_PROOF_PHASE_I_V9.md`
- `docs/VALUATION_DELTA_V9.md`
- `docs/SKYE_GEO_ENGINE_CATEGORY_OF_ONE_DIRECTIVE_V11.md`
- `docs/SMOKE_PROOF_PHASE_K_V11.md`
- `docs/VALUATION_DELTA_V11.md`

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
- ✅ Neon transport smoke exists at `scripts/smoke-neon-transport.mjs`
- ✅ Headless DOM UI smoke exists at `scripts/smoke-browser-ui.mjs`
- ✅ Capability registry exists at `src/lib/capabilities.ts`
- ✅ Product-purpose endpoint exists at `GET /v1/capabilities`
- ✅ Walkthrough endpoint exists at `GET /v1/walkthroughs`
- ✅ No-theater validator endpoint exists at `POST /v1/truth/validate`
- ✅ Purpose / walkthrough / truth-validator UI exists in `src/ui/app.ts`
- ☐ Neon database adapter is smoke-proven against a live Neon target
- ✅ Durable job ledger exists in a live persistent target
- ✅ Real browser UI smoke suite exists
- ✅ Runtime-aware readiness routes exist at `GET /v1/readiness/runs`, `POST /v1/readiness/run`, `GET /v1/claims/catalog`, and `POST /v1/contracts/export`
- ✅ Competitive strategy routes exist at `GET /v1/strategy/scorecard`, `GET /v1/strategy/actions`, and `POST /v1/strategy/export`

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
- ✅ Wix publish adapter is smoke-exercised
- ✅ Ghost publish adapter is smoke-exercised
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

### Purpose / walkthrough / truth lane

- ✅ product-purpose narrative is generated from a real capability registry
- ✅ module-by-module walkthroughs exist and enumerate routes, controls, outputs, and operator steps
- ✅ no-theater validator exists and checks capability claims against the shipped UI surface
- ✅ purpose, walkthrough, and truth validation are smoke-backed through API smoke and UI smoke

### Readiness / contract-truth lane

- ✅ runtime-aware readiness map exists
- ✅ persisted readiness evidence exists
- ✅ claim catalog exists and maps claims to routes, controls, smoke scripts, and blockers
- ✅ contract-truth export exists
- ✅ readiness / claim-catalog UI exists in the shipped operator surface
- ✅ readiness routes are smoke-backed through API, DOM-driven UI, and real-browser smoke


### Strategy / command-center lane

- ✅ competitive scorecard exists at `GET /v1/strategy/scorecard`
- ✅ prioritized operator action plan exists at `GET /v1/strategy/actions`
- ✅ persisted strategy-pack export exists at `POST /v1/strategy/export`
- ✅ strategy controls exist in the shipped operator UI
- ✅ strategy routes are smoke-backed through API, DOM-driven UI, and real-browser smoke

### Reporting / explainability lane

- ✅ workspace proof matrix exists at `GET /v1/proof/matrix`
- ✅ workspace walkthrough completion exists at `GET /v1/walkthrough-runs`
- ✅ report summary endpoint exists at `GET /v1/reports/summary`
- ✅ client / investor / operator report-site generation exists at `POST /v1/reports/site`
- ✅ report-site evidence export exists at `POST /v1/reports/export`
- ✅ report, proof-matrix, and walkthrough-completion controls exist in the shipped operator UI
- ✅ report sites include readiness summary and claim-catalog sample data generated from the live runtime and workspace ledger
- ✅ reporting routes are smoke-backed through API, DOM-driven UI, and real-browser smoke

### Proof + portability lane

- ✅ smoke CLI exists
- ✅ replay CLI exists
- ✅ smoke proof doc exists
- ✅ valuation-delta doc exists
- ✅ audit evidence export exists
- ✅ publish evidence export exists
- ✅ visibility evidence export exists
- ✅ route scanner exists for dead-nav detection
- ✅ UI scanner exists for fake-button detection
- ✅ workspace bundle export exists
- ✅ workspace bundle import / restore exists
- ✅ workspace clone with child-record remap exists
- ✅ operator-surface auto-smoke runner exists behind `?smoke=1` in `src/ui/app.ts`
- ✅ inline UI newline parsing bug in `splitLines()` is fixed and smoke-backed
- ✅ truth smoke suite exists at `scripts/smoke-truth.mjs`
- ✅ reporting smoke suite exists at `scripts/smoke-reporting.mjs`

## 5) What was code-implemented in this pass

- added `src/lib/strategy.ts` to generate a BabyLoveGrowth-class competitive scorecard, prioritized operator action queue, and a weekly runbook from the live workspace ledger plus the readiness / claim-catalog truth layer
- added `src/routes/v1/strategy.ts` and wired `GET /v1/strategy/scorecard`, `GET /v1/strategy/actions`, and `POST /v1/strategy/export`
- updated `src/index.ts` so the strategy / command-center routes are part of the shipped Worker surface
- updated `src/lib/capabilities.ts` so strategy / command center is now a real module in the purpose graph and walkthrough graph
- updated `src/lib/reporting.ts` and `src/routes/v1/reporting.ts` so report summaries and report-site generation now include competitive-strategy summary data sourced from the live workspace ledger
- updated `src/ui/app.ts` so the operator surface now has real controls for scorecard loading, action-plan loading, and strategy-pack export
- added `scripts/smoke-strategy.mjs` so strategy generation and strategy-pack export are directly smoke-backed
- updated `scripts/scan-routes.mjs`, `scripts/scan-ui.mjs`, `scripts/smoke-browser-ui.mjs`, `scripts/smoke-real-browser.py`, and `package.json` so strategy / command center is scanned, smoke-backed, and included in the full proof chain

## 6) Build order from here

Nothing else materially code-based is left blank inside the shipped module graph. The remaining blanks are live-target proof items.

Do not skip ahead. Build in this order.

### Phase L — Live Neon target proof

Goal: make the Neon lane pass end to end against a real Neon target instead of transport-only proof.

Required work:

- set `DB_MODE=neon-http`
- point `NEON_SQL_URL` at the real SQL bridge / endpoint used by deployment
- run the current smoke flow end to end against Neon
- save a proof doc with returned IDs and row reads

Acceptance:

- the existing smoke chain passes through a real Neon target
- returned IDs are read back from Neon-backed history
- directive can move the live-Neon blank to checked

### Phase M — Live remote CMS publish proof

Goal: prove at least one real external CMS target end to end instead of adapter-only/local-target proof.

Required work:

- run a real publish execute against a real provider target
- capture the provider response, remote id, and live URL
- confirm the publish ledger reads the live response back correctly
- save a proof doc with the provider response and final state

Acceptance:

- one or more real remote CMS targets are proven end to end
- publish reconciliation reads back the true remote result
- directive can move the live-provider blank to checked
