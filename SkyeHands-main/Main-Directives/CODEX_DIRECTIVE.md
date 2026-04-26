# ULTIMATE IMPLEMENTATION DIRECTIVE — SKYEHANDS / AE / GRAYCHUNKS TARGETED BUILDOUT V3

As-of: 2026-04-26  
Owner/operator: Skyes Over London LC  
Directive mode: targeted full buildout, code-backed only  
Revision: V3 aligns the directive to the actual repo reality that Theia and OpenHands lanes already exist inside SkyeHands and must be wired/proven instead of re-added as missing repos.  
Status notation: ✅ = implemented and smoke-proven. ☐ = open implementation target. No X marks.

## 0. Directive Purpose

This directive converts the current SkyeHands / AE / SkyDexia / GrayChunks work into a controlled implementation plan. The goal is not to add more presentation layers. The goal is to make the code match the platform claims.

SkyeHands must become the operating environment: a production-grade autonomous developer cloud where a user can spin up a real dev workspace, command an AI agent, build production-ready apps, move those apps through productization lanes, and ship files into other Skyes Over London business platforms.

AE Command must become a real independent-brain business operating layer, not just a roster of persona prompts. Each AE brain must have its own state, memory, task queue, usage meter, permission scope, provider routing, and ability to communicate with other AE brains and the wider SkyeHands platform bus.

GrayChunks must become the reality scanner that blocks false claims, skeleton platforms, route-only smokes, static-only apps, mock-provider success, doc/code mismatch, and incomplete product surfaces.

## 1. Current Code Truth Baseline

✅ Audit baseline captured: current repo contains real foundations mixed with partial platforms, skeletons, and HTML-only surfaces.

✅ AE provider dispatcher has been upgraded in concept to require real provider dispatch paths for OpenAI, Anthropic, Gemini, Printful, Calendly, and dry-run proof mode.

✅ Current truth: 13 AE brains are currently roster/persona entries unless each gains independent runtime state, queues, memory, metering, permissions, and inter-brain communication.

✅ Current truth: AE Command Hub is functional-partial, not production-complete.

✅ Current truth: Printful Commerce Brain is functional-partial until live Printful product/order/storefront/webhook paths are proven.

✅ Current truth: AI Appointment Setter is HTML/static until OAuth, calendar, booking, availability, reminders, and handoff logic are implemented and smoked.

✅ Current truth: Skye Lead Vault, Skye Media Center, and several branch apps are HTML-only or partial until backend/state/provider/storage flows are implemented and smoked.

✅ Current truth: Codex competitor/control-plane/real-platform surfaces are not yet a complete autonomous Codespaces replacement until workspace lifecycle, browser IDE, sandbox runner, provider router, deploy automation, GitHub flow, isolation, and terminal/file operations are end-to-end proven.

✅ Corrected truth: Theia source is already present under `platform/ide-core/`; do not treat Theia as missing.

✅ Corrected truth: `platform/ide-core/package.json` identifies the lane as `@theia/monorepo`; the implementation gap is runtime wiring/proof, not source acquisition.

✅ Corrected truth: OpenHands metadata and runtime boundary are already present under `platform/agent-core/`; do not treat OpenHands as a new external repo to blindly add.

✅ Corrected truth: `platform/agent-core/pyproject.toml` identifies the lane as `openhands-ai`, while `platform/agent-core/runtime/lib/server.mjs` is currently only a boundary shim until real OpenHands import/runtime/task proof exists.

☐ Update all donor-repo strategy language to state that Theia and OpenHands are existing SkyeHands lanes requiring install, build, CLI/import, launch, workspace, and behavioral proof.

☐ Add a generated `EXISTING_DONOR_LANE_PROOF.md` showing what is present, what is wired, what is only metadata/source, and what proof flags are still false.

☐ Replace every public-facing or internal doc claim that overstates readiness with code-readiness labels: PRODUCTION-READY, FUNCTIONAL-PARTIAL, SKELETON, HTML-ONLY.

☐ Add a generated `CODE_READINESS_MATRIX.md` that maps every product claim to code files, functions, persistence, providers, and smoke proofs.

☐ Add a generated `CLAIMS_TO_SMOKE_MAP.json` that fails CI when a claimed capability has no behavioral smoke.

## 1.1 Legacy Checkmark Quarantine and Proof Discipline

☐ Quarantine all prior directive checkmarks that were granted from file existence, route existence, JSON-key checks, or documentation-only proof.

☐ Add `LEGACY_CHECKMARK_REVALIDATION_REPORT.md` listing every prior completed claim, its original proof, whether proof is structural or behavioral, and what new smoke is required.

☐ Add `DIRECTIVE_DOWNGRADE_REPORT.md` listing every capability that must be downgraded from complete/production-ready to functional-partial, skeleton, or HTML-only until behavioral smoke exists.

☐ Add a root release gate that blocks production-ready language when evidence only proves structure, mock behavior, dry-run-only behavior, static UI, or HTML-only state.

☐ Add signed proof artifact bundle requirements for every generated or remediated app: build log, smoke log, file hash manifest, env contract, provider contract, claim map, readiness matrix row, and rollback note.

☐ Add `PROOF_BUNDLE_MANIFEST.schema.json` defining required fields for proof bundle artifacts.

☐ Add smoke proving a stale or structural-only legacy checkmark is detected, quarantined, and excluded from completion percentage.


## 2. Non-Negotiable Build Rules

☐ No capability may be marked complete unless a behavioral smoke proves the real flow.

☐ No route-existence smoke may count as completion for product capability.

☐ No provider integration may return success unless it either calls the real provider API or runs dry-run mode through the exact same dispatch function and response-shape contract.

☐ No UI button may ship unless the clicked control completes a real code path or produces a truthful blocked/missing-env state.

☐ No docs may claim production-ready while code readiness remains functional-partial, skeleton, or HTML-only.

☐ No branch app may be called a platform unless it has backend/state/persistence or an explicit offline persistence layer.

☐ Local smoke must prove code paths without live vars where provider-supported test/dry-run mode exists.

☐ Production mode must fail loudly when required live vars are missing.

☐ All implementation checklists must use only ✅ and ☐.

## 3. SkyeHands Operating-System Architecture

### 3.1 SkyeHands Environment Bus

☐ Add `core/platform-bus/skyehands-platform-bus.mjs` as the canonical event bus for cross-platform communication.

☐ Add event envelopes: `workspace.created`, `app.generated`, `app.packaged`, `app.shipped`, `ae.requested`, `commerce.product.created`, `media.asset.created`, `lead.generated`, `deployment.requested`, `smoke.completed`, `billing.updated`.

☐ Add signed event envelopes with event id, tenant id, workspace id, actor id, source platform, target platform, payload hash, created timestamp, and replay protection.

☐ Add platform subscription registry so AE, SkyDexia, Commerce, Music Nexus, Media Center, Lead Vault, Routex, and Store systems can subscribe to only allowed event types.

☐ Add local dev transport using file-backed queue for smoke.

☐ Add production transport abstraction for Cloudflare Queue, Neon-backed outbox, or provider queue.

☐ Add bridge audit ledger recording every cross-platform event, delivery, retry, failure, and consuming platform.

☐ Add smoke proving a generated app event leaves SkyeHands, reaches AE, creates a productization task, and writes an audit entry.

### 3.2 Platform Bridge Contracts

☐ Add `platform/contracts/platform-capability.schema.json` defining how every platform declares capabilities, routes, state layer, required env vars, and smoke proofs.

☐ Add `platform/contracts/file-shipment.schema.json` for sending generated files from SkyDexia/SkyeHands to AE, Commerce, Music, Media, Lead Vault, or deployment targets.

☐ Add `platform/contracts/productization.schema.json` for turning a coded app into a sellable product.

☐ Add bridge adapters for `ae-commandhub`, `maggies-store`, `printful-commerce`, `appointment-setter`, `lead-vault`, `media-center`, `music-nexus`, `skydexia`, and `skyehands-codex-platform`.

☐ Add contract validator that blocks any platform registration missing backend/state/smoke proof.

☐ Add smoke proving each registered platform can receive a bridge event and produce a truthful response.

### 3.3 SuperIDEv2 Architecture Study Side Note

☐ When SuperIDEv2 source is provided, inspect its cross-platform communication architecture.

☐ Extract reusable bridge patterns from SuperIDEv2 without copying incompatible runtime assumptions.

☐ Apply the communication pattern to SkyeHands Environment Bus and AE Brain Mesh.

☐ Generate `SUPERIDEV2_BRIDGE_REUSE_NOTES.md` with imported concepts, rejected concepts, and final applied architecture.


## 3.4 Existing Theia and OpenHands Runtime Lanes

✅ Theia donor source is already inside the SkyeHands repo under `platform/ide-core/`.

✅ OpenHands metadata/runtime boundary is already inside the SkyeHands repo under `platform/agent-core/`.

☐ Do not add Theia as a new missing external repo.

☐ Do not add OpenHands as a new missing external repo.

☐ Treat Theia and OpenHands as existing lanes that require installation, runtime wiring, import/CLI proof, build proof, launch proof, workspace proof, and behavioral smoke.

☐ Run repo inventory to locate all existing Theia/OpenHands stage files, repair scripts, smoke scripts, proof flags, and state files.

☐ Complete existing `platform/ide-core` Theia install/build lane.

☐ Prove Theia CLI resolution instead of leaving `resolvedTheiaCli: null`.

☐ Prove Theia backend entrypoint launches.

☐ Prove Theia browser frontend launches and serves a usable IDE page.

☐ Prove Theia workspace opens a generated SkyeHands project.

☐ Prove Theia can save a file back into the SkyeHands workspace filesystem.

☐ Prove Theia can trigger a SkyeHands smoke run.

☐ Prove Theia can display generated-app preview output.

☐ Add smoke artifact requiring `fullTheiaRuntime: true` before docs claim Theia runtime parity.

☐ Complete existing `platform/agent-core` OpenHands install lane.

☐ Prove the real OpenHands Python package is importable from the SkyeHands repo environment.

☐ Replace shim-only proof with actual OpenHands runtime import proof.

☐ Prove OpenHands app/server entrypoint can start or expose a real local runtime API.

☐ Prove OpenHands can receive a task from SkyeHands.

☐ Prove OpenHands can inspect a workspace file.

☐ Prove OpenHands can edit or generate a file.

☐ Prove OpenHands can run a command or test in the workspace sandbox.

☐ Prove OpenHands can return a structured task result to SkyeHands.

☐ Prove SkyeHands records the OpenHands task receipt, changed files, stdout/stderr, exit code, and smoke result.

☐ Keep `platform/agent-core/runtime/lib/server.mjs` only as a boundary shim until real OpenHands runtime proof replaces it.

☐ Add smoke artifact requiring `fullOpenHandsRuntime: true` before docs claim OpenHands runtime parity.

☐ Connect OpenHands task execution to SkyeHands workspace files and terminal/sandbox runner.

☐ Connect Theia IDE surface to the same workspace runtime.

☐ Define Theia as the human/operator IDE surface.

☐ Define OpenHands as the autonomous coding agent runtime.

☐ Define SkyeHands as the operating environment coordinating both.

## 4. Autonomous Codespace Replacement Buildout

### 4.1 Workspace Lifecycle

☐ Implement workspace create, open, pause, resume, archive, restore, export, and delete.

☐ Add per-workspace filesystem root with safe path resolution and symlink escape blocking.

☐ Add workspace metadata ledger: owner, tenant, language stack, runtime profile, env profile, created files, agent sessions, smoke history.

☐ Add workspace snapshot and restore preview.

☐ Add smoke proving workspace create → file write → command run → snapshot → restore.

### 4.2 Browser IDE

☐ Implement real browser IDE file tree, editor, terminal panel, preview panel, logs panel, smoke panel, and artifact export.

☐ Add file read/write/rename/delete endpoints with permission checks.

☐ Add terminal command runner with sandbox policy, timeout, output capture, and exit code handling.

☐ Add preview server routing for generated web apps.

☐ Add smoke proving UI controls perform file and terminal operations end to end.

### 4.3 AI Agent Runtime

☐ Implement agent plan → edit → run → test → repair → summarize loop.

☐ Add provider router for OpenAI, Anthropic, Gemini, and local/dry-run providers.

☐ Add patch application with diff preview and rollback.

☐ Add agent memory scoped to workspace and tenant.

☐ Add cost and token meter per agent run.

☐ Add smoke proving an agent creates a small app, runs tests, fixes a failing test, and packages the output.

### 4.4 Deployment Automation

☐ Implement Cloudflare default deployment lane.

☐ Implement optional Netlify deployment lane.

☐ Add Netlify Functions deployment warning anywhere a platform requires Netlify Functions: “Lord kAIxu, this must be deployed via Git or it will not be useful to you.”

☐ Implement GitHub repo create/push/branch/PR/release flow.

☐ Implement deployment env var readiness check.

☐ Implement deployment smoke that checks live or local preview URL after deploy.

☐ Add loud blocked state when provider vars are missing.

## 5. AE Independent Brain Mesh

### 5.1 Brain Runtime Independence

☐ Convert each AE roster entry into a runtime entity with its own state record.

☐ Add per-brain memory store.

☐ Add per-brain task queue.

☐ Add per-brain usage ledger.

☐ Add per-brain provider routing and failover settings.

☐ Add per-brain capability permissions.

☐ Add per-brain audit trail.

☐ Add per-brain status: active, paused, capped, failed, escalated.

☐ Add smoke proving each of the 13 brains can independently receive a task, produce a response, write state, and log usage.

### 5.2 Brain-to-Brain Communication

☐ Add `netlify/functions/_shared/ae_brain_mesh.js`.

☐ Add brain message types: consult, handoff, escalation, review, quote-request, appointment-request, commerce-request, launch-request, support-request.

☐ Add message envelope with fromBrainId, toBrainId, tenantId, taskId, payload, permission scope, timestamp, trace id.

☐ Add brain routing rules so one brain can ask another for help without uncontrolled loops.

☐ Add max-hop protection.

☐ Add per-task transcript showing inter-brain communication.

☐ Add smoke proving onboarding brain can hand off to growth brain, commerce brain, and appointment brain.

### 5.3 AE-to-SkyeHands Bridge

☐ Add AE bridge adapter that lets SkyeHands send generated app/productization requests to AE.

☐ Add AE bridge adapter that lets AE request SkyeHands actions such as build, package, deploy, generate landing page, create repo, run smoke, and export proof pack.

☐ Add permission checks so AE cannot execute unrestricted filesystem or deployment commands.

☐ Add smoke proving a user builds an app in SkyeHands, sends it to AE, and AE creates productization tasks.

### 5.4 AE Productization Scenario Proof

☐ Implement scenario: user builds a parent/babysitter medical info app in SkyeHands.

☐ SkyeHands packages files and emits `app.generated`.

☐ AE onboarding brain creates product intake.

☐ AE growth brain generates offer positioning.

☐ AE commerce brain creates pricing/product setup request.

☐ AE appointment brain creates consultation/sales scheduling link.

☐ AE media/marketing brain creates launch content request.

☐ Bridge writes a complete audit trail.

☐ Smoke proves the entire scenario end to end without live vars using dry-run provider paths.

## 6. AE Command Hub Completion

☐ Wire all AE functions to a shared persistence layer, with Neon as production path and local test DB as smoke path.

☐ Replace file-only production state with database-backed repositories where production persistence is claimed.

☐ Add tenant model, user model, role model, brain model, client model, lead model, task model, thread model, message model, appointment model, productization model, and audit model.

☐ Add RBAC for founder, admin, AE operator, client, and viewer.

☐ Add session refresh flow and token revocation.

☐ Add client/account CRM records with status transitions.

☐ Add assignments between clients, brains, AEs, and tasks.

☐ Add activity timeline per account.

☐ Add smoke proving login, client create, assignment, brain message, task create, state update, and audit record.

## 7. Appointment Setter Full Buildout

☐ Replace static-only appointment pages with backend functions.

☐ Add OAuth connection records for Google Calendar.

☐ Add OAuth connection records for Microsoft 365 calendar.

☐ Add Calendly scheduling link path.

☐ Add availability query flow.

☐ Add booking create flow.

☐ Add booking reschedule/cancel flow.

☐ Add reminders and follow-up task generation.

☐ Add appointment handoff to AE brain mesh.

☐ Add provider dry-run fixtures that use the same booking service functions.

☐ Add smoke proving availability → booking → reminder → AE task handoff.

## 8. Printful Commerce Brain Full Buildout

☐ Replace mock state success with real Printful API service layer.

☐ Keep dry-run mode but require it to pass through the same Printful service function.

☐ Add Printful product sync.

☐ Add Printful variant mapping.

☐ Add draft order creation.

☐ Add order confirmation path gated behind explicit production env.

☐ Add webhook verification and order status update.

☐ Add storefront product publishing.

☐ Add payment/checkout handoff.

☐ Add order ledger and customer ledger.

☐ Add smoke proving product sync, draft order, webhook ingest, storefront update, and audit trail.

## 9. Maggies Autonomous Store System Buildout

☐ Add merchant auth backend.

☐ Add merchant profile database.

☐ Add inventory CRUD backend.

☐ Add product detail backend.

☐ Add public storefront renderer backed by stored products.

☐ Add cart and checkout handoff.

☐ Add payment provider abstraction.

☐ Add order records.

☐ Add delivery booking records.

☐ Add Routex/dispatch packet generation.

☐ Add AE roster view and AE task creation for store events.

☐ Add donor visual ingestion pipeline from source merchant assets.

☐ Add smoke proving merchant creates product, storefront updates, customer order created, route packet generated, AE notified.

## 10. Skye Lead Vault Completion

☐ Add local IndexedDB persistence.

☐ Add encrypted backup export.

☐ Add restore preview and merge restore.

☐ Add smart duplicate detection.

☐ Add lead scoring.

☐ Add follow-up scheduler.

☐ Add activity timeline per lead.

☐ Add relationship/contact mapping.

☐ Add offline route/territory planning.

☐ Add portable lead-pack export.

☐ Add AE bridge event for qualified lead handoff.

☐ Add smoke proving offline create, duplicate detect, score, schedule, export, restore, and AE handoff.

## 11. Skye Media Center Completion

☐ Add media asset database.

☐ Add upload/import abstraction.

☐ Add metadata extraction.

☐ Add video/audio/document record model.

☐ Add search and filter backend.

☐ Add publishing workflow.

☐ Add AE/marketing brain integration.

☐ Add smoke proving asset import, metadata write, search, publish, and AE marketing handoff.

## 12. Skye Music Nexus Completion

☐ Normalize existing Express app into the chosen runtime.

☐ Remove bundled node_modules from source packaging lane.

☐ Add artist account model.

☐ Add artist onboarding flow.

☐ Add upload/package/release workflow.

☐ Add storefront per artist.

☐ Add purchase/download ledger.

☐ Add payout eligibility logic.

☐ Add 13% revenue share ledger.

☐ Add AE/music representative handoff.

☐ Add smoke proving artist onboarding, release package, storefront publish, purchase ledger, and payout eligibility calculation.

## 13. SkyDexia Completion

☐ Define SkyDexia as the code-generation and project transformation lane inside SkyeHands.

☐ Add project ingest, template selection, generation, patching, and export APIs.

☐ Add bridge emission when SkyDexia completes a generated app.

☐ Add safe file shipment into AE, Commerce, Media, Music, or deployment platforms.

☐ Add provenance ledger for generated files.

☐ Add smoke proving SkyDexia generates an app and ships it through the platform bus.

## 14. GrayChunks Reality Scanner Upgrade

### 14.1 Claim/Code Mismatch Rules

☐ Add rule: doc or UI claims provider integration but no provider service file exists.

☐ Add rule: provider service returns success without fetch/API/SDK/dry-run shared path.

☐ Add rule: platform claims backend but has no functions/server/API directory.

☐ Add rule: app has only HTML/CSS/static JS and must be labeled HTML-ONLY.

☐ Add rule: platform claims persistence but has no database schema, repository, or local offline store.

☐ Add rule: roster claims independent brains but runtime has only one shared dispatcher and no per-brain state.

☐ Add rule: smoke only checks file existence or route existence and must be classified STRUCTURAL.

☐ Add rule: behavioral smoke must perform state transition, provider dispatch, database write, file mutation, or UI action.

☐ Add rule: docs claim production-ready but readiness matrix says partial/skeleton/html-only.

☐ Add rule: UI button has no listener or listener only logs/alerts without real action.

☐ Add GrayChunks rule: any doc/UI claim of Theia runtime parity requires proof flags for CLI resolution, backend launch, browser launch, workspace mount, file save, terminal command, and preview.

☐ Add GrayChunks rule: any doc/UI claim of OpenHands runtime parity requires import proof, server/runtime launch proof, task execution proof, workspace mutation proof, command/test proof, and result ledger proof.

☐ Add GrayChunks rule: any open-source donor recommendation must first check whether that donor lane already exists inside SkyeHands and label it as existing-source, metadata-only, runtime-shim, or fully wired.

### 14.2 Platform Grading Engine

☐ Add grades: PRODUCTION-READY, FUNCTIONAL-PARTIAL, SKELETON, HTML-ONLY.

☐ Add scoring dimensions: backend, persistence, provider integrations, UI wiring, smoke depth, docs honesty, deployment readiness.

☐ Add platform inventory scanner for all apps under `platform/user-platforms`, `apps`, and AE Branching Apps.

☐ Add `graychunks-readiness-report.mjs` to generate `CODE_READINESS_MATRIX.md` and JSON.

☐ Add CI gate that blocks release if any production-ready claim maps to partial/skeleton/html-only code.

☐ Add smoke proving GrayChunks catches one fixture of each false-claim category.

## 15. Persistence / Neon / Local Smoke Database

☐ Add canonical schema migrations for AE Command Hub.

☐ Add canonical schema migrations for SkyeHands workspaces.

☐ Add canonical schema migrations for productization and commerce.

☐ Add canonical schema migrations for appointment scheduling.

☐ Add canonical schema migrations for media/music/lead vault where server persistence is claimed.

☐ Add local SQLite or file DB test mode where appropriate for local smoke.

☐ Add Neon production adapter.

☐ Add repository interfaces so production and local smoke share the same business logic.

☐ Add smoke proving restart-safe persistence for key state transitions.

## 16. Provider Pseudo-Key / Dry-Run Proof Standard

☐ Define required env vars per provider in `PROVIDER_CONTRACTS.json`.

☐ Define dry-run behavior per provider.

☐ Dry-run must use same service function as production.

☐ Dry-run must return realistic provider-shaped responses.

☐ Production mode must never silently fall back to dry-run.

☐ Add provider validation script for OpenAI, Anthropic, Gemini, Printful, Calendly, Google Calendar, Microsoft 365, Stripe, PayPal, Resend, GitHub, Cloudflare, Netlify, Neon.

☐ Add smoke proving missing env vars create clear blocked states.

☐ Add smoke proving dry-run path exercises dispatch without network.

☐ Add smoke proving live mode attempts real provider call when env vars are present.

## 17. Honest Documentation Requirements

☐ Add `CURRENT_CODE_TRUTH.md` at repo root.

☐ Add `PLATFORM_READINESS_LEDGER.md` at repo root.

☐ Add per-platform readiness badges generated from code scan, not manually written.

☐ Add per-platform missing-work sections with exact files/functions required.

☐ Remove production-ready language from partial/skeleton/html-only surfaces.

☐ Add generated claim map to every major platform README.

☐ Add smoke proof index with artifact links.

☐ Add `PROOF_BUNDLE_INDEX.md` linking build logs, smoke logs, file hash manifests, env contracts, provider contracts, claim maps, readiness rows, and rollback notes for every platform.

☐ Add rule: docs cannot be updated to ✅ until code and smoke are present.

## 18. Completion Gates

### Gate A — Truth Gate

☐ GrayChunks inventories every app/platform/branch app.

☐ Every app has readiness grade.

☐ Every product claim maps to code or is flagged.

☐ Every smoke is classified structural or behavioral.

☐ Docs are corrected to match code truth.

### Gate B — Bridge Gate

☐ SkyeHands Environment Bus implemented.

☐ Platform bridge contracts implemented.

☐ AE bridge adapter implemented.

☐ SkyDexia file shipment path implemented.

☐ Cross-platform audit ledger implemented.

☐ End-to-end bridge smoke passes.

### Gate C — AE Brain Gate

☐ 13 AE brains have independent runtime records.

☐ 13 AE brains have per-brain state, memory, queue, usage, permissions, and audit.

☐ Brain-to-brain communication works.

☐ AE-to-SkyeHands communication works.

☐ Productization scenario smoke passes.

### Gate D — Platform Completion Gate

☐ Appointment Setter backend complete and smoked.

☐ Printful Commerce backend complete and smoked.

☐ Maggies Store backend complete and smoked.

☐ Lead Vault offline/persistence complete and smoked.

☐ Media Center backend complete and smoked.

☐ Music Nexus normalized and smoked.

### Gate E — Autonomous Codespace Gate

☐ Workspace lifecycle complete and smoked.

☐ Browser IDE complete and smoked.

☐ Agent runtime complete and smoked.

☐ GitHub flow complete and smoked.

☐ Deployment automation complete and smoked.

☐ Isolation and rollback complete and smoked.

### Gate F — Release Honesty Gate

☐ All docs align with readiness matrix.

☐ Production-ready language is blocked unless UI, API, state, provider/test path, negative-path smoke, deployment guide, and proof bundle are all present.

☐ All production claims have behavioral smoke.

☐ All provider integrations have dry-run and production behavior.

☐ All buttons and controls are smoke-tested.

☐ Release package strips dev junk, node_modules where inappropriate, logs, stale artifacts, and residual state.

## 19. Target Build Order

☐ First: GrayChunks readiness scanner upgrade so the repo cannot lie.

☐ Second: SkyeHands Environment Bus and bridge contracts.

☐ Third: AE independent brain mesh.

☐ Fourth: AE Command Hub persistence and CRM/task/thread hardening.

☐ Fifth: Appointment Setter provider backend.

☐ Sixth: Printful Commerce live/dry-run provider backend.

☐ Seventh: Maggies Store backend and AE/Routex handoff.

☐ Eighth: SkyDexia file shipment into business platforms.

☐ Ninth: Codex/SkyeHands autonomous workspace and browser IDE completion.

☐ Tenth: Media, Music, and Lead Vault completion.

☐ Eleventh: full smoke suite and docs honesty rewrite.

## 20. Release Package Deliverables

☐ Final release package includes source code with dev junk removed.

☐ Final release package includes `CURRENT_CODE_TRUTH.md`.

☐ Final release package includes `CODE_READINESS_MATRIX.md` and machine-readable JSON.

☐ Final release package includes `CLAIMS_TO_SMOKE_MAP.json`.

☐ Final release package includes `PLATFORM_READINESS_LEDGER.md`.

☐ Final release package includes all proof bundles.

☐ Final release package includes `DEPLOYMENT_READINESS.md`.

☐ Final release package includes rollback plan and restore smoke.

☐ Final release package excludes inappropriate `node_modules`, logs, stale smoke artifacts, local state, test secrets, cache folders, and residual generated junk.

## 21. Final Definition of Done

☐ A user can open SkyeHands, create a workspace, ask an AI agent to build a real app, inspect/edit files, run tests, package the app, and deploy or export it.

☐ The generated app can be shipped into AE through the platform bus.

☐ AE independent brains can communicate with each other to productize the app.

☐ AE can create sales, scheduling, commerce, media, and lead tasks from the app package.

☐ Supporting business platforms can receive files/events from SkyeHands and act on them.

☐ GrayChunks can prove what is real, partial, skeleton, or HTML-only.

☐ Every product claim is backed by behavioral smoke.


☐ `fullTheiaRuntime: true` is generated by behavioral smoke, not manually written.

☐ `fullOpenHandsRuntime: true` is generated by behavioral smoke, not manually written.

☐ Theia and OpenHands both operate against the same SkyeHands workspace lifecycle.

☐ GrayChunks blocks any claim that outruns Theia/OpenHands runtime proof.

☐ Live deployment requires only real provider vars and deployment credentials, not new implementation code.
