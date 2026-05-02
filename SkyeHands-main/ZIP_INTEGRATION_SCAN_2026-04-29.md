# Seven-Zip Platform Audit - 2026-04-29

Scope: only these seven archives under `SkyeHands-main/Later-Additions/DonorCode-MySkyeApps/`:

- `artificial-sole-api-main.zip`
- `dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip`
- `FunnelSystem-main.zip`
- `GrayScape_SuperApp_Spectacle.zip`
- `skye-geo-engine-starter-v20-source-only.zip`
- `SkyeHands_Valuation_Certification_System_v0_7_0_proved_full (1).zip`
- `sovereign-variables-main.zip`

## Bottom Line

Best real platforms:

1. `dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip`
2. `skye-geo-engine-starter-v20-source-only.zip`
3. `SkyeHands_Valuation_Certification_System_v0_7_0_proved_full (1).zip`
4. `sovereign-variables-main.zip`

Useful but incomplete or donor-grade:

5. `GrayScape_SuperApp_Spectacle.zip`
6. `FunnelSystem-main.zip`

Thin prototype:

7. `artificial-sole-api-main.zip`

SkyeHands backend/auth changes the path, not the truth. Weak archives can become useful if SkyeHands supplies auth, persistence, tenancy, provider gateway, audit, rate limits, and workspace records. But inheriting SkyeHands does not make missing code magically real.

## 1. Artificial Sole API

Archive: `artificial-sole-api-main.zip`

### What It Is

Artificial Sole API is a tiny Express backend for creating and chatting with synthetic "executive AI clone" personas.

It exposes:

- `GET /health`
- `POST /api/v1/clone/onboard`
- `POST /api/v1/clone/chat`
- `GET /api/v1/clone/personas`

The code stores persona profiles in an in-memory object. A persona contains fields like:

- `displayName`
- `role`
- `industry`
- `communicationStyle`
- `principles`
- `strengths`
- `boundaries`

Then `/api/v1/clone/chat` builds a system prompt from that persona and sends the user message to OpenAI Chat Completions using `OPENAI_API_KEY`.

### What It Actually Does

It lets a caller:

1. Register a fake executive/persona profile.
2. Ask the persona a message.
3. Receive a generated response shaped by that profile.

That is it. It is not an autonomous team platform. It is not a real clone system. It is not a durable company memory layer. It is basically a persona-prompt wrapper with an API.

### What Is Real

- Express server exists.
- Basic API routes exist.
- Persona prompt generation exists.
- Guardrail wording exists: it tells the model not to claim to be the real human.
- Direct OpenAI call exists.
- CORS and JSON middleware exist.

### What Is Weak / Bullshit

- Only five files total.
- README is only `# artificial-sole-api Backend API`.
- Persona store is in memory, so everything disappears on restart.
- No authentication.
- No user/org/workspace isolation.
- No audit trail.
- No billing/rate limiting.
- No database.
- No SkyeHands provider gateway.
- Directly depends on `OPENAI_API_KEY`.
- Uses a fixed model string in code.
- No tests.
- No deployment config.
- No UI.
- No tool execution.
- No actual "AI team" orchestration.
- No evidence that it safely handles confidential executive data.

### SkyeHands Integration Verdict

Do not integrate it as a standalone platform.

Salvage the concept as a SkyeHands feature:

- "Persona Assistant" inside AE Central or House Command.
- Store personas in SkyeHands workspace records.
- Run prompts through SkyeHands provider gateway.
- Add tenant ownership, audit events, permission gates, and rate limits.
- Rename away from "clone" if this will face serious customers. "Executive persona", "operator profile", or "role agent" is cleaner and safer.

### Score

- Current platform reality: 2/10
- Concept value after SkyeHands rebuild: 6/10

## 2. Dead Route Detector - SkyeVSX

Archive: `dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip`

### What It Is

A real developer QA tool for finding UI and command surfaces that look wired but do not resolve.

It includes:

- VS Code/OpenVSX extension source.
- Browser scanner app.
- GitHub wrapper app.
- Shared scanner core.
- Report tools.
- CLI.
- Example fixtures.
- Smoke screenshots.
- Product docs.
- Built artifacts including `.vsix` and webapp/wrapper zips.

### What It Actually Does

It scans project files for:

- broken/dead route references
- orphan routes
- unregistered commands
- commands declared but not executed correctly
- menu/keybinding command issues
- placeholder links like `href="#"` and `javascript:void(0)`

It can export:

- JSON
- Markdown
- SARIF
- diff JSON
- diff Markdown
- PR review comment Markdown

### What Is Real

- 119 files.
- Real scanner core exists.
- Multiple surfaces exist: extension, webapp, GitHub wrapper, CLI.
- Fixture corpus exists.
- Smoke screenshots exist.
- CLI scripts exist.
- Browser smoke scripts exist.
- Extension host smoke exists.
- Packaging scripts exist.
- VSX extension manifest is coherent.
- SARIF support makes it useful for CI/security-style reporting.

### What Is Weak / Needs Proof

- README itself says live VS Code/OpenVSX runtime UI proof is not yet proven.
- Platform-wide investor-grade proof is not done.
- It likely needs scanner tuning against SkyeHands-specific route helpers and app conventions.
- GitHub wrapper will need real auth/policy if embedded in SkyeHands.

### SkyeHands Integration Verdict

Integrate this first.

Best use:

- SkyeHands quality gate.
- House Command release check.
- AE Central app audit.
- CI scan before platform modules are blessed.
- Valuation Certification input signal.

SkyeHands should wrap it as:

- `POST /api/quality/dead-routes/scan`
- `POST /api/quality/dead-routes/compare`
- artifact store for SARIF/Markdown/JSON
- workspace-level scan history

### Score

- Current platform reality: 8/10
- SkyeHands integration value: 9/10

## 3. FunnelSystem

Archive: `FunnelSystem-main.zip`

### What It Claims To Be

The README claims a dual-lane Netlify funnel:

- Job Seekers: `/jobseekers.html`
- Employers: `/employers.html`
- Netlify Forms capture.
- Netlify Functions write to Blobs and Postgres.
- Netlify DB/Neon support.

### What Is Actually In The Zip

Only eight entries:

- `.nvmrc`
- `README.md`
- `netlify.toml`
- `package-lock.json`
- `package.json`
- `scripts/db-init.js`
- folders

There is no `public/` folder in the archive.
There is no `netlify/functions/` folder in the archive.
There are no `jobseekers.html` or `employers.html` pages in the archive.
There is no intake function in the archive.

### What Is Real

- Package config exists.
- Netlify config exists.
- Build script exists.
- DB initializer exists.
- DB initializer creates `intake_submissions`.
- It supports `NETLIFY_DATABASE_URL`, `NEON_DATABASE_URL`, or `DATABASE_URL`.
- The table shape is sensible: lane, name, email, phone, company, role, IP, user agent, JSON payload.

### What Is Weak / Bullshit

- The zip is incomplete relative to its README.
- It is not deployable as the claimed funnel because `public` and `netlify/functions` are missing.
- Build will not fail without a DB because `db-init.js` intentionally sets `process.exitCode = 0` on failure.
- No actual form handling code present.
- No frontend pages present.
- No spam protection.
- No auth.
- No tenant model.
- No admin/review dashboard.
- No workflow integration.

### SkyeHands Integration Verdict

Keep the schema and concept, but do not treat the archive as a complete platform.

Best use:

- Intake schema donor.
- House Command/AE Central lead capture module.
- Rebuild frontend and functions inside SkyeHands.

SkyeHands should supply:

- authenticated intake submission APIs
- tenant/workspace ID
- spam/rate controls
- admin review UI
- workflow dispatch to AE Central / SkyeMail / SkyeChat

### Score

- Current platform reality: 3/10
- Concept value after SkyeHands rebuild: 7/10

## 4. GrayScape SuperApp Spectacle

Archive: `GrayScape_SuperApp_Spectacle.zip`

### What It Is

A static installable PWA with a flashy portal UI and local modules:

- Nexus landing page
- Forge
- Command/calendar
- Tasks
- Journal
- Vault
- Settings
- About

It has:

- `index.html`
- `sw.js`
- `manifest.json`
- icons
- page HTML files
- `assets/superdock.js`
- CSS
- Three.js spectacle via CDN

### What It Actually Does

It stores local app state in `localStorage`.

Examples:

- tasks stored in `grayscape_tasks_v1`
- journal entries stored in `grayscape_journal_v1`
- vault stored in `grayscape_vault_v1`
- vault lock flag stored in `grayscape_vault_locked_v1`

It provides:

- command palette
- quick task capture
- quick journal capture
- export/import of local GrayScape keys
- PWA install support

### What Is Real

- Usable static PWA.
- Multiple local modules exist.
- Tasks, journal, and vault have real localStorage logic.
- Export/import logic exists.
- Service worker exists.
- Command palette exists.
- Good candidate for visual shell/donor UI.

### What Is Weak / Bullshit

- No backend.
- No auth.
- No sync.
- No encryption for the vault.
- The "vault lock" is only a UI/localStorage flag, not security.
- External CDN dependency for Three.js.
- Heavy spectacle may not be appropriate for serious ops dashboards without refinement.
- Data model is local-only and ad hoc.

### SkyeHands Integration Verdict

Use as a House Command UI donor, not as-is as a platform.

Good pieces to salvage:

- Command palette pattern.
- PWA shell.
- Tasks/journal/vault module concepts.
- Visual "command portal" vibe if toned down.

Must replace:

- localStorage storage with SkyeHands workspace records.
- vault lock with real SkyeHands auth/vault encryption.
- CDN dependencies with local bundled assets.
- isolated pages with routed SkyeHands app modules.

### Score

- Current platform reality: 4/10
- UI donor value: 7/10

## 5. Skye GEO Engine Starter

Archive: `skye-geo-engine-starter-v20-source-only.zip`

### What It Is

A Cloudflare Worker-first API and UI starter for AI search/growth/content operations.

It includes:

- Worker entrypoint: `src/index.ts`
- routes under `src/routes/v1`
- backend libraries under `src/lib`
- SQL migrations
- many smoke scripts
- docs and roadmaps
- UI app source
- Wrangler config

### What It Actually Does / Is Built To Do

It supports or defines routes for:

- health
- auth
- workspaces
- projects
- jobs/history
- site audit
- content plans
- visibility prompt packs
- research/source ingest
- article briefs
- article drafts
- publish payloads
- backlinks
- bundles
- agency flows
- strategy
- targets
- readiness
- release
- reporting
- runtime contracts
- rollback/cutover
- evidence

It has publisher adapters/files for:

- generic
- Ghost
- Shopify
- Webflow
- Wix
- WordPress

### What Is Real

- Large TypeScript Worker codebase.
- Real route files.
- Real SQL migrations.
- RLS/tenant guard SQL file exists.
- DB abstraction exists.
- Smoke scripts are extensive.
- UI app source exists.
- Publish adapter files exist.
- Wrangler config exists.

### What Is Weak / Needs Proof

- README admits local smoke proves adapter-backed memory mode.
- Real Neon execution proof is still open.
- Cloudflare Worker integration must be reconciled with SkyeHands backend architecture.
- Needs real tenant/auth binding to SkyeHands identity.
- Lots of docs/valuation deltas may overstate maturity compared with live production proof.

### SkyeHands Integration Verdict

High-value AE Central module.

Best use:

- growth ops engine
- research and content planning
- article brief/draft pipeline
- publish payload preparation
- visibility/audit reporting

SkyeHands should supply:

- auth and tenancy
- workspace/project ownership
- provider gateway
- live DB wiring
- audit/event bus
- job queue if long-running tasks exceed Worker request patterns

### Score

- Current platform reality: 7/10
- SkyeHands integration value: 9/10

## 6. SkyeHands Valuation Certification System

Archive: `SkyeHands_Valuation_Certification_System_v0_7_0_proved_full (1).zip`

### What It Is

A standalone Node-based proof/certification system that imports codebase zips, analyzes them, emits reports/artifacts, and can generate deterministic patch outputs.

It includes:

- server: `server/server.mjs`
- frontend: `public/`
- tools: `scan_zip.py`, `patch_zip.py`, `repair_brain.py`, `trust_chain.py`
- config ledgers/weights
- smoke scripts
- fixtures
- proof pack with direct workspaces and generated artifacts

### What It Actually Does

Based on README and file layout, it can:

- accept codebase zip imports
- reconstruct descriptors, dependencies, launch profiles, smoke profiles
- detect provider/integration signals
- score project readiness/value using configured weights
- produce VCS artifact family
- run deterministic patch lab
- emit updated codebase zips
- produce repair intelligence
- produce public trust/cert-related readiness artifacts

### What Is Real

- Substantial code exists.
- Server exists.
- UI exists.
- Python scan/patch/trust tools exist.
- Proof pack exists.
- Sample direct workspaces exist.
- Generated VCS artifacts exist.
- Smoke script exists.
- Patch outputs exist.

### What Is Weak / Bullshit Risk

- "Valuation" is dangerous language. This is not a legal/IRS/investor appraisal.
- It should be framed as readiness scoring, internal certification, or technical proof scoring.
- Proof pack is based on bundled fixtures, not necessarily the actual SkyeHands integrated production system.
- Public trust/certificate outputs include local generated keys/certs in proof pack. That proves generation mechanics, not public CA issuance or production trust.
- Needs to run against these seven zips and actual SkyeHands modules before its claims become useful for this integration.

### SkyeHands Integration Verdict

Keep as internal proof/audit engine.

Best use:

- donor code intake analyzer
- readiness score generator
- repair plan generator
- proof pack exporter
- audit artifact system

Do not sell it as formal valuation. Sell it as SkyeHands platform readiness/certification.

### Score

- Current platform reality: 7/10
- Claim-risk-adjusted value: 6/10
- SkyeHands proof engine value: 8/10

## 7. Sovereign Variables

Archive: `sovereign-variables-main.zip`

### What It Is

A VS Code/OpenVSX extension plus standalone static app for managing environment variables and deployment notes.

It includes:

- VS Code extension entry: `extension.js`
- extension manifest: `package.json`
- web app under `media/app`
- standalone copy under `standalone`
- walkthrough docs
- PWA assets

### What It Actually Does

It lets a user:

- create projects/vessels
- create environments
- add key/value variables
- write environment notes
- import `.env`, `.txt`, `.json`, `.skye`
- export `.env`, `.json`, `.skye`
- encrypt `.skye` exports with browser WebCrypto
- push payloads to `/api/skychat-notify` and `/api/skymail-send` in standalone hosted mode
- use VS Code file dialogs in extension mode

Encryption implementation:

- AES-GCM
- PBKDF2-SHA256
- 120,000 iterations
- 16-byte salt
- 12-byte IV
- `SKYESEC1` package marker

### What Is Real

- Real extension wrapper exists.
- Real web app exists.
- Real import/export exists.
- Real browser encryption exists.
- VS Code host save/open bridge exists.
- Local-first flow is credible.
- SkyeMail/SkyeChat route hooks are already anticipated.

### What Is Weak / Needs Hardening

- Primary state is localStorage.
- No SkyeHands auth.
- No server-side vault.
- No team permissions.
- No secret rotation model.
- No recovery/key custody model beyond passphrase prompt/hint.
- Uses prompt dialogs for passphrase, which is not a polished security UX.
- Pushing secrets to SkyeMail/SkyeChat would be risky unless redaction/policy gates are added.
- Extension CSP allows `connect-src ... https: http: data: blob:` which is broad.

### SkyeHands Integration Verdict

Keep and harden. This is a good House Command / SuperIDE env vault candidate.

SkyeHands should provide:

- workspace-scoped encrypted records
- permission model
- audit logs for import/export/share
- redaction before chat/mail handoff
- explicit secret classification
- provider/deploy integration
- secure passphrase UX or SkyeHands vault-backed envelope encryption

### Score

- Current platform reality: 6/10
- Hardened SkyeHands value: 8/10

## Best Combinations

### House Command

Combine:

- `GrayScape_SuperApp_Spectacle.zip`
- `sovereign-variables-main.zip`
- rebuilt pieces of `FunnelSystem-main.zip`

Role:

- GrayScape provides command/dashboard shell inspiration.
- Sovereign Variables provides env/deployment control.
- FunnelSystem provides intake records after rebuilding missing UI/functions.
- SkyeHands supplies real backend/auth/storage.

### AE Central

Combine:

- `skye-geo-engine-starter-v20-source-only.zip`
- rebuilt pieces of `FunnelSystem-main.zip`
- persona concept from `artificial-sole-api-main.zip`

Role:

- Funnel captures leads/intake.
- GEO Engine performs research/content/growth operations.
- Artificial Sole becomes role-agent/persona assistant inside the SkyeHands provider gateway.

### SkyeHands Proof / Quality Layer

Combine:

- `dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip`
- `SkyeHands_Valuation_Certification_System_v0_7_0_proved_full (1).zip`
- `sovereign-variables-main.zip`

Role:

- Dead Route Detector catches broken app wiring.
- Valuation Certification creates readiness/proof artifacts.
- Sovereign Variables packages deployment/env evidence.

## Recommended Build Order

1. Integrate Dead Route Detector as a SkyeHands quality gate.
2. Run Dead Route Detector against the other six archives after extraction.
3. Mount Skye GEO Engine behind SkyeHands auth/workspaces and prove live DB mode.
4. Rebuild FunnelSystem as a real SkyeHands intake app because the archive is incomplete.
5. Harden Sovereign Variables into a SkyeHands vault/env module.
6. Mount Valuation Certification as internal proof/readiness scoring, with language cleaned up.
7. Use GrayScape as UI donor only after real records exist.
8. Rebuild Artificial Sole as a provider-gateway-backed persona assistant if wanted.

