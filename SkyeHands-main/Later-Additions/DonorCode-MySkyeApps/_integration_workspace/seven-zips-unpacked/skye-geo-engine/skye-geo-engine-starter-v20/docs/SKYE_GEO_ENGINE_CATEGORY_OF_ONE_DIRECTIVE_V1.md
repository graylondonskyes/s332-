# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V1

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
- Every smoke must verify real UI and real endpoints, not just file existence.
- Fail loud when configuration is missing.
- Use one naming system throughout the product.
- No legacy residue, no orphan routes, no dead navigation.
- Client-facing surfaces stay client-facing only.

### Proof standards

- A feature is not “done” until a smoke proves it end to end.
- Checkmarks are allowed only for code paths that already exist and can be exercised.
- Blank boxes remain blank until the smoke is real.
- Never mark work complete because it is designed, scaffolded, or “easy to add later.”

### Strategic standards

- Winning is not just article generation.
- The moat is the combination of audit depth, publishing automation, replayable visibility evidence, distribution, and multi-tenant controls.
- Source provenance must be first-class.
- Publish logs must be first-class.
- Visibility logs must be first-class.
- Backlink / distribution quality must be first-class.

## 3) Current repo truth

The following paths exist in the current starter and can be treated as present now:

- `src/index.ts`
- `src/ui/app.ts`
- `src/lib/audit.ts`
- `src/lib/contentPlan.ts`
- `src/lib/promptPack.ts`
- `src/lib/publishPayload.ts`
- `sql/001_init.sql`
- `docs/BUILD_STRATEGY.md`
- `docs/COMPETITOR_GAP_MAP.md`
- `docs/ROADMAP.md`

## 4) Status ledger

Only use checkmarks and blanks.

### Foundation lane

- ✅ Cloudflare Worker entrypoint exists at `src/index.ts`
- ✅ Operator UI exists at `src/ui/app.ts`
- ✅ Live audit lane exists at `POST /v1/audit/site`
- ✅ 30-day content-plan lane exists at `POST /v1/content/plan`
- ✅ Visibility prompt-pack lane exists at `POST /v1/visibility/prompt-pack`
- ✅ CMS payload mapping lane exists at `POST /v1/publish/payload`
- ✅ Initial SQL file exists at `sql/001_init.sql`
- ☐ Neon database adapter is wired
- ☐ Durable job ledger exists
- ☐ Auth / tenant isolation exists
- ☐ Real UI smoke suite exists
- ☐ Route-level API smoke suite exists

### Research and writing lane

- ☐ URL research fetcher exists
- ☐ Search-source normalization exists
- ☐ claim-to-source ledger exists
- ☐ outline engine exists
- ☐ article draft engine exists
- ☐ rewrite / tone / CTA controls exist
- ☐ FAQ/schema injection exists
- ☐ infographic prompt / asset lane exists
- ☐ multilingual generation lane exists

### Publishing lane

- ☐ WordPress publish adapter exists
- ☐ Webflow publish adapter exists
- ☐ Shopify publish adapter exists
- ☐ Wix publish adapter exists
- ☐ Ghost publish adapter exists
- ☐ Generic webhook / API publisher exists
- ☐ publish reconciliation ledger exists
- ☐ failed publish retry queue exists
- ☐ scheduled publishing exists

### Visibility lane

- ☐ saved prompt sets exist
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

- ☐ orgs / workspaces / seats exist
- ☐ white-label branding exists
- ☐ reseller client management exists
- ☐ usage metering exists
- ☐ plan / quota enforcement exists
- ☐ invoice / export lane exists
- ☐ role-based access control exists

### Proof ops lane

- ☐ smoke CLI exists
- ☐ replay CLI exists
- ☐ audit evidence export exists
- ☐ publish evidence export exists
- ☐ visibility evidence export exists
- ☐ route scanner exists for dead-nav detection
- ☐ UI scanner exists for fake-button detection

## 5) Build order

Build this in the exact order below. Do not jump to later glamour lanes while foundational ledgers and smoke remain blank.

### Phase A — Persistence and truth layer

Goal: convert the starter from stateless demo surface into a system that remembers work, stores evidence, and supports tenants.

Required files to add:

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
- `src/routes/v1/articles.ts`
- `src/routes/v1/visibility.ts`
- `src/routes/v1/publish.ts`
- `sql/002_core_tables.sql`
- `sql/003_indexes.sql`
- `sql/004_rls_or_tenant_guards.sql`
- `scripts/smoke-api.mjs`

Required tables:

- `orgs`
- `users`
- `memberships`
- `workspaces`
- `projects`
- `jobs`
- `audit_runs`
- `article_briefs`
- `articles`
- `sources`
- `article_source_map`
- `publish_runs`
- `visibility_runs`
- `saved_prompt_sets`
- `evidence_exports`

Acceptance:

- create workspace
- create project
- run audit and persist result
- generate plan and persist result
- list history from Neon
- every stored record is scoped to an org/workspace

Smoke requirement:

- create workspace via API
- create project via API
- run audit
- confirm rows exist in Neon
- fetch the workspace history and verify returned records match inserted IDs

### Phase B — Research and source ledger

Goal: make writing source-backed instead of free-floating.

Required files to add:

- `src/lib/research/fetchUrl.ts`
- `src/lib/research/extractText.ts`
- `src/lib/research/normalizeSource.ts`
- `src/lib/research/sourceLedger.ts`
- `src/lib/research/serpAdapter.ts`
- `src/lib/research/redditAdapter.ts`
- `src/lib/research/schemaExtractor.ts`
- `src/lib/research/entityExtractor.ts`
- `src/routes/v1/research.ts`
- `scripts/smoke-research.mjs`

Required behavior:

- ingest URLs and raw text safely
- normalize title, canonical URL, published time, site name, content snippet
- hash content for dedupe
- persist source artifacts
- attach source rows to briefs and articles
- record retrieval timestamp and retrieval origin

Acceptance:

- submit research seed
- store normalized sources
- create a brief using only persisted sources
- export source ledger with article linkage

Smoke requirement:

- run research on at least two URLs
- verify dedupe works
- verify source rows persist
- verify article brief references source IDs

### Phase C — Article engine

Goal: generate publishable content with structure, provenance, and operator controls.

Required files to add:

- `src/lib/write/brief.ts`
- `src/lib/write/outline.ts`
- `src/lib/write/draft.ts`
- `src/lib/write/rewrite.ts`
- `src/lib/write/faq.ts`
- `src/lib/write/internalLinks.ts`
- `src/lib/write/schema.ts`
- `src/lib/write/cta.ts`
- `src/routes/v1/write.ts`
- `scripts/smoke-write.mjs`

Required behavior:

- generate article brief from workspace + research
- generate outline
- generate full draft
- inject FAQs
- inject JSON-LD schema
- suggest internal links
- store source map for article claims
- allow tone, audience, CTA, and length controls

Acceptance:

- create brief
- create outline
- create article
- store article and source map
- return article with schema + FAQ + internal-link suggestions

Smoke requirement:

- run write pipeline from persisted brief
- assert article body is non-empty
- assert source IDs are attached
- assert schema object exists
- assert FAQ section exists

### Phase D — CMS automation

Goal: make content leave the system and land in destination CMSs with reconciliation.

Required files to add:

- `src/lib/publish/wordpress.ts`
- `src/lib/publish/webflow.ts`
- `src/lib/publish/shopify.ts`
- `src/lib/publish/wix.ts`
- `src/lib/publish/ghost.ts`
- `src/lib/publish/generic.ts`
- `src/lib/publish/reconcile.ts`
- `src/lib/publish/retryQueue.ts`
- `src/routes/v1/publish-run.ts`
- `scripts/smoke-publish.mjs`

Required behavior:

- validate destination config
- prepare mapped payload
- send publish request
- persist request/response/result state
- reconcile destination record ID, URL, and status
- retry failures with capped strategy

Acceptance:

- publish one article to at least one real adapter
- persist full publish ledger
- list publish history
- show publish status in UI

Smoke requirement:

- use local mock adapters when secrets are absent
- verify published state transitions correctly
- when real credentials are present, run a live publish smoke against a test destination

### Phase E — Visibility replay

Goal: prove whether the brand is actually surfacing in AI-answer flows over time.

Required files to add:

- `src/lib/visibility/providers.ts`
- `src/lib/visibility/replay.ts`
- `src/lib/visibility/parseAnswer.ts`
- `src/lib/visibility/scoreMention.ts`
- `src/lib/visibility/scoreCitation.ts`
- `src/lib/visibility/scoreCompetitors.ts`
- `src/lib/visibility/nextActions.ts`
- `src/routes/v1/visibility-run.ts`
- `scripts/smoke-visibility.mjs`

Required behavior:

- save prompt sets
- replay prompts against configured providers
- store raw answer, parsed mentions, parsed citations, confidence, and competitor overlap
- compute mention share and citation share
- produce next-action recommendations

Acceptance:

- save a prompt pack
- run a visibility replay
- persist the run
- render a dashboard view showing changes over time

Smoke requirement:

- run replay with deterministic test answers when provider keys are absent
- assert parsed mentions and citations populate
- when provider keys are present, run live replay against a test prompt pack

### Phase F — Backlink / distribution network

Goal: build the actual moat instead of pretending content alone is enough.

Required files to add:

- `src/lib/network/partnerRegistry.ts`
- `src/lib/network/siteQuality.ts`
- `src/lib/network/relevance.ts`
- `src/lib/network/placementQueue.ts`
- `src/lib/network/anchorRules.ts`
- `src/lib/network/fraud.ts`
- `src/lib/network/reconcile.ts`
- `src/routes/v1/network.ts`
- `scripts/smoke-network.mjs`

Required behavior:

- register partner or owned distribution sites
- compute site quality and topical fit
- queue placements
- enforce anchor diversity and frequency rules
- store placement evidence
- flag circular spammy behavior and abuse

Acceptance:

- create site registry rows
- queue placements for an article
- reconcile placement status
- render network health summary

Smoke requirement:

- create test partner sites
- run placement queue generation
- verify anchor diversity rules prevent duplicates
- verify fraud checks can block bad placements

### Phase G — Agency / reseller controls

Goal: make the platform sellable at agency scale.

Required files to add:

- `src/lib/billing/plans.ts`
- `src/lib/billing/quota.ts`
- `src/lib/billing/metering.ts`
- `src/lib/export/whiteLabel.ts`
- `src/lib/rbac.ts`
- `src/routes/v1/billing.ts`
- `src/routes/v1/export.ts`
- `src/routes/v1/admin.ts`
- `scripts/smoke-agency.mjs`

Required behavior:

- plan assignment
- seat count enforcement
- usage metering
- white-label PDF / CSV / JSON exports
- admin and member roles
- client workspace management

Acceptance:

- create org + member roles
- enforce quotas
- export client-ready evidence

Smoke requirement:

- exceed a quota and verify loud fail
- export a white-label evidence bundle
- verify role restrictions work

## 6) UI build map

The UI must remain truthful. Do not render controls before the endpoint exists.

Required routes to add inside the operator app:

- `/app/overview`
- `/app/workspaces`
- `/app/projects`
- `/app/audits`
- `/app/research`
- `/app/articles`
- `/app/publishing`
- `/app/visibility`
- `/app/network`
- `/app/agency`
- `/app/evidence`
- `/app/settings`

Required UI panels:

- workspace switcher
- project dossier panel
- audit detail panel
- source ledger panel
- article pipeline panel
- publish queue panel
- visibility replay panel
- network health panel
- evidence export panel

UI rules:

- panels must be scrollable
- panels must be minimizable
- if detachable behavior is added, it must actually work
- every table row should have a detail drawer or detail page
- every mutation should show real success or real failure
- show IDs, timestamps, and states where useful for proof

## 7) API surface target

These are the target endpoints once the build matures.

### Existing now

- `GET /v1/health`
- `POST /v1/audit/site`
- `POST /v1/content/plan`
- `POST /v1/visibility/prompt-pack`
- `POST /v1/publish/payload`

### Required next

- `POST /v1/workspaces`
- `GET /v1/workspaces`
- `POST /v1/projects`
- `GET /v1/projects`
- `POST /v1/research/run`
- `GET /v1/research/:id`
- `POST /v1/write/brief`
- `POST /v1/write/article`
- `GET /v1/articles/:id`
- `POST /v1/publish/run`
- `GET /v1/publish/:id`
- `POST /v1/visibility/run`
- `GET /v1/visibility/:id`
- `POST /v1/network/placements`
- `GET /v1/network/health`
- `POST /v1/export/evidence`

## 8) Smoke map

No box gets checked without the corresponding smoke.

Required smoke files:

- `scripts/smoke-api.mjs`
- `scripts/smoke-ui.mjs`
- `scripts/smoke-research.mjs`
- `scripts/smoke-write.mjs`
- `scripts/smoke-publish.mjs`
- `scripts/smoke-visibility.mjs`
- `scripts/smoke-network.mjs`
- `scripts/smoke-agency.mjs`
- `scripts/smoke-proofops.mjs`

Smoke rules:

- API smoke verifies real status codes and response contracts.
- UI smoke verifies real routes, visible controls, form submission, and resulting state changes.
- Publish smoke must use mock mode when secrets are absent and live mode when secrets are present.
- Visibility smoke must use deterministic test-answer fixtures when provider keys are absent and live provider runs when keys are present.
- Proof-op smoke must verify evidence exports are generated and downloadable.

## 9) Definition of done

The platform is not “done” when it can generate text. It is only done when all of the following are true:

- a workspace can be created
- a project can be created
- a site can be audited and stored
- research sources can be harvested and stored
- a source-backed article can be generated and stored
- the article can be published to a destination and reconciled
- prompt sets can be replayed and scored
- evidence can be exported
- all visible routes work
- all visible controls work
- smoke passes are green

## 10) Anti-theater guardrails

Never ship any of the following:

- fake publish buttons
- fake visibility scores
- fake backlink counts
- placeholder “coming soon” actions inside the live operator app
- unpersisted work presented as historical truth
- checkmarks without smoke

## 11) Value creation logic

Each completed lane increases defensibility and valuation for specific reasons.

- Persistence increases operator trust and turns isolated actions into a true system.
- Source ledger increases trust, compliance posture, and enterprise credibility.
- CMS reconciliation increases real-world usefulness and lowers customer friction.
- Visibility replay increases retained value because it proves ongoing outcomes instead of promising them.
- Distribution/network operations create moat.
- Agency controls create revenue scale.
- Proof ops make skeptic attacks easier to defeat.

## 12) Immediate next move

Do not start with the backlink glamour lane.

Start now with:

1. Neon adapter and core tables.
2. workspace/project CRUD.
3. persisted audit history.
4. smoke-api script.
5. source ledger lane.
6. brief/article pipeline.

That sequence turns the starter into a real product foundation fast.

## 13) Operator command block

When work resumes, use this order and do not skip steps:

- wire Neon
- add core tables
- add workspace and project routes
- persist audit runs
- build and run API smoke
- add research/source ledger
- build and run research smoke
- add article engine
- build and run writing smoke
- then move to publishing, visibility, network, and agency lanes

## 14) Locked summary

This directive is the truth standard for the build. The repo should move from a real starter into a category-of-one growth operating system only by proving each lane with code and smoke. Until then, blanks stay blank.
