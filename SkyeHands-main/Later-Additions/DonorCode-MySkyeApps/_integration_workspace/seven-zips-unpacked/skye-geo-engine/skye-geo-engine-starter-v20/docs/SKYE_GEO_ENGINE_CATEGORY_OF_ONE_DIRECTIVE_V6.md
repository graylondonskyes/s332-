# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V6

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
- workspace backup / restore / clone portability

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
- The moat is the combination of audit depth, publishing automation, replayable visibility evidence, distribution, multi-tenant controls, and portability / proof retention.
- Source provenance must be first-class.
- Publish logs must be first-class.
- Visibility logs must be first-class.
- Backlink / distribution quality must be first-class.
- Workspace state must be exportable, restorable, and cloneable without ID collisions.

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
- `src/routes/v1/bundles.ts`
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
- `sql/001_init.sql`
- `sql/002_core_tables.sql`
- `sql/003_indexes.sql`
- `sql/004_rls_or_tenant_guards.sql`
- `sql/005_growth_lanes.sql`
- `sql/006_growth_indexes.sql`
- `scripts/helpers/test-server.mjs`
- `scripts/smoke-api.mjs`
- `scripts/smoke-replay.mjs`
- `scripts/smoke-publish.mjs`
- `scripts/smoke-agency.mjs`
- `scripts/smoke-backlinks.mjs`
- `scripts/smoke-bundles.mjs`
- `scripts/smoke-neon-transport.mjs`
- `scripts/smoke-browser-ui.mjs`
- `scripts/scan-routes.mjs`
- `scripts/scan-ui.mjs`
- `docs/SKYE_GEO_ENGINE_CATEGORY_OF_ONE_DIRECTIVE_V6.md`
- `docs/SMOKE_PROOF_PHASE_F_V6.md`
- `docs/VALUATION_DELTA_V6.md`

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

## 5) What was code-implemented in this pass

- added `scripts/helpers/test-server.mjs` for deterministic operator-surface smoke targets
- added `scripts/smoke-neon-transport.mjs` to prove the Neon HTTP adapter path, auth header, parameterized SQL bridge usage, and read-after-write history flow without claiming a live Neon target
- added `scripts/smoke-browser-ui.mjs` as a headless DOM-driven UI automation harness that runs the real operator script, not a string-only scan
- added an auto-smoke runner in `src/ui/app.ts` behind `?smoke=1` so the operator surface can self-drive workspace create, project create, audit, research, brief, draft, publish, export, import, clone, and history flows
- fixed the operator UI inline script bug where `splitLines()` rendered an invalid newline literal into the shipped page script
- updated `package.json` so the new smoke lanes are part of the main smoke command

## 6) Build order from here

Do not skip ahead. Build in this order.

### Phase G — Live Neon proof

Goal: make the adapter-backed persistence lane smoke-proven against a real Neon target instead of transport-only smoke.

Required work:

- set `DB_MODE=neon-http`
- point `NEON_SQL_URL` at the real SQL bridge / endpoint used by deployment
- run the current smoke flow end to end against Neon
- save a proof doc with returned IDs and row reads

Acceptance:

- the same smoke flow passes against Neon
- workspace history reads back from Neon
- job history survives process restarts
- bundle export from Neon and re-import from bundle both pass

Smoke requirement:

- duplicate the current smoke flow with live Neon config
- capture inserted IDs and read them back in a second process pass

### Phase H — Live provider publish proof

Goal: prove real external publish success against live provider targets, not only mocked provider responses.

Required work:

- execute WordPress publish against a live target
- execute Webflow publish against a live target
- execute Shopify publish against a live target
- execute Wix publish against a live target
- execute Ghost publish against a live target
- save reconciliation evidence for each provider

Acceptance:

- every provider returns a real remote ID
- every provider records a reconciliation row
- publish export contains live provider evidence

Smoke requirement:

- provider-specific live smoke suite with one success case per provider

### Phase I — Real browser UI automation smoke

Goal: prove the operator UI in a real browser automation harness rather than DOM-driven execution only.

Required work:

- drive `/app` through a real browser automation harness
- create a workspace from the UI
- create a project from the UI
- run bundle export / import / clone from the UI
- run at least one publish path from the UI

Acceptance:

- browser automation passes against the real operator surface
- visible controls are verified by interaction, not static scan only

Smoke requirement:

- one browser automation command that fails loud on broken controls or dead request flow
