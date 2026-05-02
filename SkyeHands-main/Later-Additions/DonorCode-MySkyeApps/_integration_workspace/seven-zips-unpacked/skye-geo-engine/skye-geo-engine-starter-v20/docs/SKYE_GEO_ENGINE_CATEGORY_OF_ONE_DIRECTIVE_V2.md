# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V2

As of 2026-04-07 (America/Phoenix)

## 1) Mission

Build a Cloudflare-first, Neon-backed, multi-tenant AI-search growth platform that can materially outperform BabyLoveGrowth-class products by being deeper, more provable, more operator-controlled, and less dependent on hand-wavy automation claims.

This platform must not be a toy content generator. It must become a full growth operating system with these real lanes working together:

- intake and workspace creation
- technical GEO / SEO audit
- research and source harvesting
- article brief generation
- long-form article generation with source ledger
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
- `src/routes/v1/visibility.ts`
- `src/routes/v1/research.ts`
- `src/routes/v1/articles.ts`
- `src/routes/v1/publish.ts`
- `src/lib/research/fetchUrl.ts`
- `src/lib/research/extractText.ts`
- `src/lib/research/normalizeSource.ts`
- `src/lib/research/sourceLedger.ts`
- `src/lib/articles/brief.ts`
- `src/lib/articles/draft.ts`
- `sql/001_init.sql`
- `sql/002_core_tables.sql`
- `sql/003_indexes.sql`
- `sql/004_rls_or_tenant_guards.sql`
- `scripts/smoke-api.mjs`
- `docs/SMOKE_PROOF_PHASE_A_B_V2.md`
- `docs/VALUATION_DELTA_V2.md`

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
- ☐ Real UI smoke suite exists

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
- ☐ claim-to-source mapping exists at sentence/claim granularity
- ☐ rewrite / tone / CTA controls exist
- ☐ FAQ injection exists
- ☐ infographic prompt / asset lane exists
- ☐ multilingual generation lane exists

### Publishing lane

- ✅ WordPress publish-payload adapter exists and is smoke-exercised
- ✅ publish payload persistence ledger exists
- ☐ Webflow publish adapter is smoke-exercised
- ☐ Shopify publish adapter is smoke-exercised
- ☐ Wix publish adapter exists
- ☐ Ghost publish adapter exists
- ☐ Generic webhook / API publisher is smoke-exercised
- ☐ publish reconciliation ledger exists beyond payload storage
- ☐ failed publish retry queue exists
- ☐ scheduled publishing exists
- ☐ live remote CMS publish exists

### Visibility lane

- ✅ saved prompt sets exist
- ☐ provider replay jobs exist
- ☐ answer parsing exists
- ☐ mention-share scoring exists
- ☐ citation-share scoring exists
- ☐ competitor-overlap scoring exists
- ☐ time-series visibility dashboard exists
- ☐ replay evidence export exists

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
- ✅ smoke proof doc exists
- ✅ valuation-delta doc exists
- ☐ replay CLI exists
- ☐ audit evidence export exists
- ☐ publish evidence export exists
- ☐ visibility evidence export exists
- ☐ route scanner exists for dead-nav detection
- ☐ UI scanner exists for fake-button detection

## 5) What was code-implemented in this pass

- added adapter-backed storage architecture with memory mode and Neon HTTP mode
- added workspace/project/job routes
- changed audit/content/visibility/publish lanes to persist records
- added workspace history aggregation route
- added research ingest with normalization and dedupe
- added brief generation from persisted sources
- added deterministic article composition from stored briefs
- added publish payload record persistence
- added SQL schema pack for orgs, workspaces, projects, jobs, audits, plans, prompts, sources, briefs, articles, publish runs, visibility runs, and evidence exports
- added route-level smoke script proving the flow end to end

## 6) Build order from here

Do not skip ahead. Build in this order.

### Phase D — Live Neon proof

Goal: make the current adapter-backed persistence lane smoke-proven against a real Neon target instead of memory-only smoke.

Required work:

- set `DB_MODE=neon-http`
- point `NEON_SQL_URL` at the real SQL bridge / endpoint used by deployment
- run the core flow end to end against Neon
- save a proof doc with returned IDs and row reads

Acceptance:

- the same smoke flow passes against Neon
- workspace history reads back from Neon
- job history survives process restarts

Smoke requirement:

- duplicate the current smoke flow with live Neon config
- capture inserted IDs and read them back in a second process pass

### Phase E — Publish execution lane

Goal: move from payload generation into actual remote publishing and reconciliation.

Required files to add:

- `src/lib/publish/wordpress.ts`
- `src/lib/publish/webflow.ts`
- `src/lib/publish/shopify.ts`
- `src/lib/publish/generic.ts`
- `src/lib/publish/reconcile.ts`
- `scripts/smoke-publish.mjs`

Acceptance:

- remote publish request succeeds for at least one real provider target
- publish response is persisted
- publish status can be re-read from the ledger
- failures are stored as explicit failed states

Smoke requirement:

- run a provider-backed publish smoke
- verify the remote returned identifier is persisted locally

### Phase F — Visibility replay lane

Goal: convert saved prompt packs into real replay jobs with stored evidence.

Required files to add:

- `src/lib/visibility/replay.ts`
- `src/lib/visibility/score.ts`
- `src/lib/visibility/parseAnswer.ts`
- `src/routes/v1/visibilityReplay.ts`
- `scripts/smoke-visibility.mjs`

Acceptance:

- saved prompt set can be replayed
- mention share is computed
- citation share is computed
- result rows persist in `visibility_runs`

Smoke requirement:

- replay at least one stored prompt set through a controlled test adapter
- verify stored scores and evidence rows

### Phase G — Evidence exports and proof ops

Goal: export auditable proof artifacts instead of only keeping them in memory or JSON responses.

Required files to add:

- `src/lib/evidence/exportAudit.ts`
- `src/lib/evidence/exportPublish.ts`
- `src/lib/evidence/exportVisibility.ts`
- `src/routes/v1/evidence.ts`
- `scripts/smoke-evidence.mjs`

Acceptance:

- audit evidence export exists
- publish evidence export exists
- visibility evidence export exists
- export rows persist in `evidence_exports`

### Phase H — Distribution moat

Goal: build the lane that content-only competitors usually do not own well.

Required work:

- partner-site registry
- placement queue
- topical relevance scoring
- fraud/abuse checks
- backlink reconciliation ledger

No checkmarks here until the queue and ledger are live and smoke-backed.

## 7) Open code work remaining

These are still genuinely open on the code side and should remain open until implemented and smoke-backed:

- live Neon execution proof
- real remote CMS publishing
- publish reconciliation and retry queue
- provider replay jobs and stored scoring
- evidence export files
- claim-level source mapping
- rewrite/tone controls
- FAQ injection and multilingual lane
- distribution moat
- RBAC / plans / quotas / invoice exports
- real UI smoke automation
- dead-nav / fake-button scanners

## 8) Completion estimate

Current repo state after this pass: **about 38% of the category-of-one target**.

That is materially farther along than the starter because the repo now has a real memory layer, route flow, job history, source ledger, brief/draft lane, persisted publish payloads, and route-level smoke proof.

It is not close enough to call finished because the major moat lanes are still blank.
