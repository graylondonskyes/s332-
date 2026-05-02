# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V20

As of 2026-04-09 (America/Phoenix)

## 1) Mission

Build a Cloudflare-first, Neon-backed, multi-tenant AI-search growth platform that can materially outperform BabyLoveGrowth-class products by being deeper, more provable, more operator-controlled, and less dependent on hand-wavy automation claims.

This platform must function as one operating system with these lanes working together:

- intake and workspace creation
- technical GEO / SEO audit
- research and source harvesting
- article brief generation
- long-form article generation with claim-to-source mapping
- schema / internal link / FAQ enrichment
- article review gating with evidence, SEO, conversion, and publish-blocker scoring
- article remediation that turns review findings into stronger publish candidates with stored corrective actions and exportable proof packs
- CMS publishing and reconciliation
- visibility replay against AI answer surfaces
- backlink / distribution network operations
- tenant / agency / reseller controls
- proof ops / smoke / replay / audit evidence
- workspace backup / restore / clone portability
- client / investor / operator report sites
- workspace proof matrix and walkthrough completion
- runtime-aware readiness, claim catalog, contract-truth exports, runtime contracts, provider validation, and proof-site exports
- release-gate scoring, drift control, and release-pack exports
- live target probe summaries, stored target-probe history, and target-pack exports that show the difference between reachable targets and truly live-proved targets
- cutover summaries, stored cutover runs, provider recipes, and cutover-pack exports that turn the remaining live-proof gap into an explicit launch handoff
- article enrichment packs that turn stored drafts into schema graphs, internal-link plans, metadata packs, and publish-ready exportable HTML without ad hoc manual cleanup
- article review packs that turn stored drafts into score-backed publish gates and exportable HTML review binders before CMS execution
- article remediation packs that turn stored drafts into corrective action plans, stronger publish candidates, predicted score deltas, and exportable HTML remediation binders before CMS execution

The platform only earns a checkmark when the feature is backed by real code and a real smoke path. No theater. No fake controls. No “coming soon” dressed up as done.

## 2) Locked standards

### Product standards

- Cloudflare is the default runtime.
- Neon is the default persistent data layer.
- Every visible control in the UI must do something real.
- Every major claim must have a smoke path.
- Every smoke must verify real routes and real state transitions, not just file existence.
- Every claimed UI control in smoke scope must be discoverable, inside the visible screen margins, and functional end to end.
- Fail loud when configuration is missing.
- Use one naming system throughout the product.
- No legacy residue, no orphan routes, no dead navigation.
- Client-facing surfaces stay client-facing only.
- Walkthroughs and report sites must explain only what the platform can actually do right now.
- Readiness, runtime-contract, provider-contract, target-probe, proof-site, release-gate, drift, article-enrichment, article-review, and article-remediation surfaces must separate locally proved capability from live-runtime blockers.

### Proof standards

- A feature is not done until a smoke proves it end to end.
- Checkmarks are allowed only for code paths that already exist and can be exercised.
- Blank boxes remain blank until the smoke is real.
- Never mark work complete because it is designed, scaffolded, or easy to add later.

## 3) Current repo truth

The current repo contains real code for:

- capability registry + purpose narrative
- walkthrough registry + walkthrough runs
- no-theater validator
- runtime contracts
- provider target contract validation
- claim evidence graph
- proof-site HTML export + stored proof-site evidence
- readiness runs + claim catalog + contract pack export
- strategy scorecard + actions + strategy export
- proof matrix + report summary + report site + report export
- release gate + drift report + release-pack export
- live target probe summary + probe history + target-pack export
- workspace bundles export/import/clone
- API auth / agency / backlink / visibility / publish / article / research / audit lanes
- article enrichment lane with stored schema, internal-link, metadata, and HTML pack evidence
- article review lane with stored evidence coverage, SEO readiness, conversion readiness, publish-gate scoring, and HTML review pack evidence
- article remediation lane with corrective actions, stronger publish candidates, predicted enrichment, predicted review, score deltas, and HTML remediation pack evidence
- local durable-ledger proof, Neon transport smoke, headless DOM UI smoke, real Chromium browser smoke, and rollback recovery proof

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
- ✅ Org/workspace scope guards exist in route flow
- ✅ API-key auth lane exists at `GET/POST /v1/auth/keys`
- ✅ Auth / RBAC exists through API-key role enforcement and smoke-backed denial paths
- ✅ No-demo residue scanner exists at `scripts/scan-no-demo-residue.mjs`
- ✅ Shipped operator UI no longer ships seeded demo/example defaults in the audited lanes
- ✅ Core smoke lanes run against a local fixture server instead of inline mock-fetch scaffolding
- ✅ Neon transport smoke exists at `scripts/smoke-neon-transport.mjs`
- ✅ Headless DOM UI smoke exists at `scripts/smoke-browser-ui.mjs`
- ✅ Real Chromium browser smoke exists at `scripts/smoke-real-browser.py`
- ✅ Capability registry exists at `src/lib/capabilities.ts`
- ✅ Product-purpose endpoint exists at `GET /v1/capabilities`
- ✅ Walkthrough endpoint exists at `GET /v1/walkthroughs`
- ✅ No-theater validator endpoint exists at `POST /v1/truth/validate`
- ✅ Runtime-contract endpoint exists at `GET /v1/runtime/contracts`
- ✅ Provider-contract validation endpoint exists at `POST /v1/providers/validate`
- ✅ Claim-evidence endpoint exists at `GET /v1/claims/evidence`
- ✅ Proof-site export endpoint exists at `POST /v1/proof/site`
- ✅ Release-gate endpoint exists at `GET /v1/release/gate`
- ✅ Release-drift endpoint exists at `GET /v1/release/drift`
- ✅ Release-pack export endpoint exists at `POST /v1/release/export`
- ✅ Target-summary endpoint exists at `GET /v1/targets/summary`
- ✅ Target-probe history endpoint exists at `GET /v1/targets/probes`
- ✅ Target-probe execution endpoint exists at `POST /v1/targets/probe`
- ✅ Target-pack export endpoint exists at `POST /v1/targets/export`
- ✅ Cutover summary endpoint exists at `GET /v1/cutover/summary`
- ✅ Cutover run history endpoint exists at `GET /v1/cutover/runs`
- ✅ Cutover run endpoint exists at `POST /v1/cutover/run`
- ✅ Cutover-pack export endpoint exists at `POST /v1/cutover/export`
- ✅ Rollback-summary endpoint exists at `GET /v1/rollback/summary`
- ✅ Rollback history endpoint exists at `GET /v1/rollback/runs`
- ✅ Rollback execution endpoint exists at `POST /v1/rollback/run`
- ✅ Rollback-pack export endpoint exists at `POST /v1/rollback/export`
- ✅ Runtime/provider/claim-evidence/proof-site/release/target/cutover/rollback controls exist in the shipped UI
- ✅ Runtime/provider/claim-evidence/proof-site/release/target/cutover/rollback route and UI scanners exist
- ✅ Runtime/provider/claim-evidence/proof-site smoke suite exists at `scripts/smoke-runtime-contracts.mjs`
- ✅ Release-gate smoke suite exists at `scripts/smoke-release.mjs`
- ✅ Target-probe smoke suite exists at `scripts/smoke-targets.mjs`
- ✅ Cutover smoke suite exists at `scripts/smoke-cutover.mjs`
- ✅ Rollback smoke suite exists at `scripts/smoke-rollback.mjs`
- ☐ Neon database adapter is smoke-proven against a live Neon target

### Research and writing lane

- ✅ URL research fetcher exists
- ✅ Raw-text ingest exists
- ✅ Source normalization exists
- ✅ Source dedupe ledger exists
- ✅ Persisted source store exists
- ✅ Article brief engine exists
- ✅ Article draft engine exists
- ✅ Brief-to-source linkage exists
- ✅ Draft citations are stored with the article record
- ✅ Claim-to-source mapping exists at sentence/claim granularity
- ✅ Rewrite / tone / CTA controls exist
- ✅ FAQ injection exists
- ✅ Infographic prompt / asset lane exists
- ✅ Multilingual generation lane exists
- ✅ Article enrichment lane exists at `POST /v1/articles/enrich`
- ✅ Article enrichment export lane exists at `POST /v1/articles/enrich/export`
- ✅ Article enrichment history lane exists at `GET /v1/articles/enrichments`
- ✅ Schema-graph generation exists for stored articles
- ✅ Internal-link suggestion engine exists for stored articles
- ✅ Metadata pack generation exists for stored articles
- ✅ Article enrichment controls exist in the shipped UI
- ✅ Article enrichment route and UI scanners exist
- ✅ Article enrichment smoke suite exists at `scripts/smoke-enrich.mjs`
- ✅ Article review lane exists at `POST /v1/articles/review`
- ✅ Article review export lane exists at `POST /v1/articles/review/export`
- ✅ Article review history lane exists at `GET /v1/articles/reviews`
- ✅ Evidence-coverage scoring exists for stored articles
- ✅ SEO-readiness scoring exists for stored articles
- ✅ Conversion-readiness scoring exists for stored articles
- ✅ Publish-gate verdicting exists for stored articles
- ✅ Article review controls exist in the shipped UI
- ✅ Article review route and UI scanners exist
- ✅ Article review smoke suite exists at `scripts/smoke-review.mjs`
- ✅ Article remediation lane exists at `POST /v1/articles/remediate`
- ✅ Article remediation export lane exists at `POST /v1/articles/remediate/export`
- ✅ Article remediation history lane exists at `GET /v1/articles/remediations`
- ✅ Corrective remediation actions are generated for stored articles
- ✅ Stronger publish-candidate article bodies are generated for stored articles
- ✅ Predicted enrichment packs are generated for remediated articles
- ✅ Predicted review packs and score deltas are generated for remediated articles
- ✅ Article remediation controls exist in the shipped UI
- ✅ Article remediation route and UI scanners exist
- ✅ Article remediation smoke suite exists at `scripts/smoke-remediate.mjs`

### Publishing lane

- ✅ WordPress publish adapter is smoke-exercised
- ✅ Webflow publish adapter is smoke-exercised
- ✅ Shopify publish adapter is smoke-exercised
- ✅ Wix publish adapter is smoke-exercised
- ✅ Ghost publish adapter is smoke-exercised
- ✅ Generic webhook / API publisher is smoke-exercised
- ✅ Publish payload persistence ledger exists
- ✅ Publish reconciliation ledger exists beyond payload storage
- ✅ Failed publish retry queue exists
- ✅ Scheduled publishing exists
- ☐ Live remote CMS publish exists

### Visibility lane

- ✅ Saved prompt sets exist
- ✅ Provider replay jobs exist
- ✅ Answer parsing exists
- ✅ Mention-share scoring exists
- ✅ Citation-share scoring exists
- ✅ Competitor-overlap scoring exists
- ✅ Time-series visibility dashboard exists
- ✅ Replay evidence export exists

### Backlink / distribution lane

- ✅ Partner-site registry exists
- ✅ Site quality policy exists in code
- ✅ Topical relevance scoring exists
- ✅ Placement queue exists
- ✅ Anchor diversity rules exist
- ✅ Backlink reconciliation ledger exists
- ✅ Fraud / abuse detection exists
- ✅ Network health dashboard exists

### Agency / reseller lane

- ✅ Org/workspace/seat operator UI exists
- ✅ White-label branding exists
- ✅ Reseller client management exists
- ✅ Usage metering exists
- ✅ Plan / quota enforcement exists
- ✅ Invoice / export lane exists
- ✅ Role-based access control exists

### Purpose / walkthrough / truth lane

- ✅ Product-purpose narrative is generated from a real capability registry
- ✅ Module-by-module walkthroughs exist and enumerate routes, controls, outputs, and operator steps
- ✅ No-theater validator exists and checks capability claims against the shipped UI surface
- ✅ Runtime contracts enumerate control-by-control requirements and blocker state
- ✅ Provider contract validation distinguishes blocked, local-proof-only, remote-target-ready, and remote-proof-observed states
- ✅ Claim evidence graph ties claims to routes, controls, exports, job types, and next proof actions
- ✅ Proof-site export generates HTML from runtime contracts plus claim evidence
- ✅ Purpose, walkthrough, truth validation, runtime contracts, provider validation, claim evidence, and proof-site export are smoke-backed through API smoke and UI smoke

### Live target probe lane

- ✅ Target summary is generated from stored target-probe evidence
- ✅ Target probes run as real network requests against Neon/provider targets
- ✅ Target probes classify blocked, reachable, and unreachable targets
- ✅ Target probes preserve the difference between reachable targets and live-proved targets
- ✅ Target-probe history is stored in the evidence ledger
- ✅ Target-pack export generates HTML from real probe history
- ✅ Target-probe controls are smoke-backed through dedicated API smoke and shipped UI smoke
- ☐ Live Neon proof is observed through a real production target
- ☐ Live remote provider publish proof is observed through a real production target

### Cutover / live-proof handoff lane

- ✅ Cutover summary is generated from release truth, target probes, and provider contracts
- ✅ Cutover runs are stored in the evidence ledger
- ✅ Cutover runs preserve the difference between proved, ready-to-attempt, and blocked launch items
- ✅ Provider recipes list request patterns, required fields, expected statuses, and blockers per target platform
- ✅ Cutover-pack export generates HTML from the live workspace ledger
- ✅ Cutover controls are smoke-backed through dedicated API smoke, shipped UI smoke, and real Chromium browser smoke

### Rollback / recovery lane

- ✅ Rollback summary is generated from real bundle, cutover, publish, target, and release evidence
- ✅ Rollback runs are stored in the evidence ledger
- ✅ Rollback pack generates HTML from the real workspace ledger
- ✅ Rollback controls are smoke-backed through dedicated API smoke and shipped UI smoke

### Reporting / readiness / strategy / release lane

- ✅ Runtime-aware readiness map exists
- ✅ Persisted readiness evidence exists
- ✅ Claim catalog exists
- ✅ Contract-pack export exists
- ✅ Proof matrix exists
- ✅ Walkthrough-completion run exists
- ✅ Report summary exists
- ✅ Report-site generation exists
- ✅ Report export exists
- ✅ Strategy scorecard exists
- ✅ Strategy actions exist
- ✅ Strategy export exists
- ✅ Release gate exists
- ✅ Release drift report exists
- ✅ Release-pack export exists

## 5) What was code-implemented in V20

- Added `src/lib/articles/remediate.ts`
- Extended `src/routes/v1/articles.ts` with `GET /v1/articles/remediations`
- Extended `src/routes/v1/articles.ts` with `POST /v1/articles/remediate`
- Extended `src/routes/v1/articles.ts` with `POST /v1/articles/remediate/export`
- Wired the article-remediation routes into `src/index.ts`
- Extended `src/lib/capabilities.ts` so the writing module now includes article-remediation routes, controls, proof points, and walkthrough steps
- Extended `src/lib/reporting.ts` so proof-matrix and walkthrough tracking now observe article-remediation evidence instead of stopping at review-only accounting
- Extended `src/ui/app.ts` with article-remediation generation, history, and export controls plus shipped-UI smoke coverage
- Added `scripts/smoke-remediate.mjs`
- Extended `scripts/scan-routes.mjs` and `scripts/scan-ui.mjs` to fail on missing article-remediation routes and controls
- Extended `scripts/smoke-browser-ui.mjs` so shipped-UI smoke covers the article-remediation lane end to end
- Extended `scripts/smoke-real-browser.py` so real-browser smoke verifies critical controls are present, within screen margins, and function end to end, including the remediation controls
- Updated `package.json` so the full smoke chain runs the article-remediation smoke suite

## 6) Remaining blank items

- ☐ Neon database adapter is smoke-proven against a live Neon target
- ☐ Live remote CMS publish exists

Those are still the only meaningful blanks left in the repo truth ledger.
