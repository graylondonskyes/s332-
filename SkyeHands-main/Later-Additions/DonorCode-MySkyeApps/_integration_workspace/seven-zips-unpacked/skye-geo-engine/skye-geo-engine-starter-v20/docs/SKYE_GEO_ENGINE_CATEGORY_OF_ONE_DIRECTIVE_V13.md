# SKYE GEO ENGINE — CATEGORY-OF-ONE BUILD DIRECTIVE V13

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
- runtime-aware readiness, claim catalog, contract-truth exports, runtime contracts, provider validation, and proof-site exports

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
- Readiness, runtime-contract, provider-contract, and proof-site surfaces must separate locally proved capability from live-runtime blockers.

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
- workspace bundles export/import/clone
- API auth / agency / backlink / visibility / publish / article / research / audit lanes
- local durable-ledger proof, Neon transport smoke, headless DOM UI smoke, and real Chromium browser smoke

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
- ✅ Shipped operator UI no longer ships seeded demo/example defaults
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
- ✅ Runtime/provider/claim-evidence/proof-site controls exist in the shipped UI
- ✅ Runtime/provider/claim-evidence/proof-site route and UI scanners exist
- ✅ Runtime/provider/claim-evidence/proof-site smoke suite exists at `scripts/smoke-runtime-contracts.mjs`
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

### Reporting / readiness / strategy lane

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

## 5) What was code-implemented in V13

- Added `src/lib/runtimeContracts.ts`
- Added `src/routes/v1/runtime.ts`
- Wired `GET /v1/runtime/contracts` into `src/index.ts`
- Wired `POST /v1/providers/validate` into `src/index.ts`
- Wired `GET /v1/claims/evidence` into `src/index.ts`
- Wired `POST /v1/proof/site` into `src/index.ts`
- Extended `src/lib/capabilities.ts` so readiness, reporting, and truth modules expose the new routes, controls, and walkthrough steps
- Extended `src/ui/app.ts` with runtime-contract, provider-contract, claim-evidence, and proof-site controls plus browser-smoke summary reporting
- Extended `scripts/scan-routes.mjs` and `scripts/scan-ui.mjs` to fail on missing runtime/provider/claim-evidence/proof-site surfaces
- Added `scripts/smoke-runtime-contracts.mjs`
- Extended `scripts/smoke-browser-ui.mjs` to assert runtime/provider/claim-evidence/proof-site summary values
- Extended `scripts/smoke-real-browser.py` to drive the new controls in a real Chromium session and assert runtime/provider/claim-evidence/proof-site outputs

## 6) Remaining blank items

- ☐ Neon database adapter is smoke-proven against a live Neon target
- ☐ Live remote CMS publish exists

Those are the only meaningful blanks left in the repo truth ledger.
