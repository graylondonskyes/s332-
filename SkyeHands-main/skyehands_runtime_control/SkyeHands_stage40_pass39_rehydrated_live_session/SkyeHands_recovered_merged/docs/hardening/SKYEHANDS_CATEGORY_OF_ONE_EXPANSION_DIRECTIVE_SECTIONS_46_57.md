# SKYEHANDS CATEGORY-OF-ONE EXPANSION DIRECTIVE
# Sections 46–60
# Drop-In Directive File

This directive is for category-creation expansion only.

A section stays blank until all of the following are true:

☐ the code path exists
☐ the runtime path exists
☐ the hostile/failure path exists
☐ the proof artifact exists
☐ the smoke survives skeptical review

A section is only complete when a hostile reviewer would be forced to attack the category thesis itself instead of the implementation quality.

---

# 0. Global rule for all Sections 46–58

Every section in this directive must eventually ship with:

☑ Deep Scan and Valuation Audit generated websites must use `docs/templates/INVESTOR_AUDIT_WEBSITE_BASE_TEMPLATE.html` as the base valuation template when a valuation website is emitted
☑ Sections 53 and 54 must interlink with Sections 59 and 60 so deep scan can honor autonomy posture and carry reconstructed environment evidence into valuation and proof surfaces
☑ Sections 55–58 must interlink with Sections 59 and 60 so deep scan and valuation can carry foundry posture, maintenance evidence, commercial boundaries, and DevGlow path intelligence into proof surfaces

☐ `apps/skyequanta-shell/bin/workspace-proof-sectionXX-*.mjs`
☐ `scripts/smoke-sectionXX-*.sh`
☐ `docs/proof/SECTION_XX_*.json`

Every proof must cover five dimensions:

☐ initialization proof
☐ action proof
☐ persistence proof
☐ explanation proof
☐ hostile/failure proof

Every proof JSON should include:

☐ `generatedAt`
☐ `pass`
☐ `checks[]`
☐ `evidence{}`
☐ hostile checks
☐ recovery checks
☐ artifact references
☐ model version
☐ runtime version
☐ directive version

---

# Section 46 — SkyeMemory Fabric

## Goal

Turn SkyeHands into a persistent engineering memory system, not just an IDE or agent session.

## Required implementation

☑ Create a durable engineering memory graph store
☑ Add node classes for workspace, repo, file, symbol, issue, task, run, failure, fix, deployment, policy-decision, user-correction, dependency, test-case
☑ Add edge classes for touched, caused, fixed-by, related-to, blocked-by, approved-by, failed-under, reoccurred-in
☑ Ingest memory events from agent planning, file edits, command execution, test failures, deploys, policy denials, runtime repair, audit verification, and user overrides
☑ Add memory retrieval API for “similar prior failures,” “related corrections,” “files that move together,” and “accepted architecture rules”
☑ Add memory-aware context injection for future autonomous runs
☑ Add UI panel for memory timeline and related-context inspection
☑ Add explanation surface that cites memory-backed reasons for future decisions

## Required smoke proof

☑ Create a fixture task run
☑ Create a fixture failure
☑ Store a successful repair
☑ Store a human correction
☑ Restart the runtime and prove memory persistence
☑ Query the memory graph and prove a future autonomous decision changes because of stored prior context
☑ Inject duplicate events and prove dedupe behavior
☑ Inject contradictory correction and prove precedence rules
☑ Corrupt one graph edge and prove graph verification fails loudly

## Required proof artifact

☑ `docs/proof/SECTION_46_SKYE_MEMORY_FABRIC.json`

## Completion gate

☑ The system can truthfully show that a prior failure and correction materially changed a later autonomous decision

---

# Section 47 — SkyeReplay

## Goal

Create a replayable time-travel execution system for autonomous engineering runs.

## Required implementation

☑ Capture ordered replay events for planning, file reads, file writes, command start/exit, test failure, policy denial, approvals, deploys, and runtime transitions
☑ Add checkpoint snapshots plus diffs between checkpoints instead of only final-state storage
☑ Add replay timeline UI with scrubber, event list, diff view, terminal view, and checkpoint jump controls
☑ Add replay export bundle for debugging, procurement, and proof packs
☑ Add replay fork capability so a run can be resumed from a chosen checkpoint under different model, policy, or budget conditions
☑ Add replay verification digest so event tampering is detectable

## Required smoke proof

☑ Execute a real fixture task run
☑ Persist ordered replay events
☑ Reconstruct file state at step N
☑ Reconstruct terminal output at step N
☑ Export replay bundle
☑ Re-run from a selected checkpoint
☑ Remove one event and prove replay verification fails
☑ Tamper one diff and prove digest mismatch
☑ Inject out-of-order event and prove replay rejects it
☑ Fork replay from an intermediate step and prove the new branch diverges cleanly

## Required proof artifact

☑ `docs/proof/SECTION_47_SKYE_REPLAY.json`

## Completion gate

☑ A real autonomous run can be rewound, inspected, verified, forked, and re-executed from a checkpoint

---

# Section 48 — kAIxU Council

## Goal

Turn SkyeHands from a single-agent surface into a specialist multi-agent engineering council.

## Required implementation

☑ Add council orchestration model with roles such as Architect, Implementer, Test Breaker, Security Reviewer, Migration Engineer, Deploy/Recovery Agent, Documentation Agent, Cost Optimizer
☑ Add council execution graph and ordering rules
☑ Add arbitration rules for approve, deny, veto, majority, tie-break, escalation, and human override
☑ Add per-role budget tracking and confidence scoring
☑ Add per-role output artifacts such as plan, verdict, diff, objection, cost, and evidence
☑ Add council panel UI with role timeline, verdict cards, objections, and final arbitration summary

## Required smoke proof

☑ Launch a council task
☑ Have Architect define a plan
☑ Have Implementer produce a patch
☑ Have Test Breaker challenge the patch
☑ Have Security Reviewer approve or deny
☑ Produce final arbitration result
☑ Simulate architect/implementer disagreement
☑ Simulate security veto
☑ Simulate budget exhaustion mid-council
☑ Simulate one agent failure and prove council recovers or fails loudly
☑ Simulate human override and prove final decision reflects it

## Required proof artifact

☑ `docs/proof/SECTION_48_KAIXU_COUNCIL.json`

## Completion gate

☑ Multiple autonomous roles can disagree, arbitrate, and converge on a real engineering result with evidence

---

# Section 49 — ProofOps

## Goal

Make SkyeHands a proof-producing engineering cloud instead of only a build-producing tool.

## Required implementation

☑ Add proof pipeline that can emit baseline, post-change verification, hostile checks, rollback check, and evidence export for a run
☑ Add evidence packager for logs, diffs, replay refs, test results, audit verification, artifact hashes, and policy traces
☑ Add attestation generation for release or deployable change sets
☑ Add redacted procurement-safe export mode
☑ Add UI trust surface showing proof complete, missing evidence, export bundle, and chain verification

## Required smoke proof

☑ Run a real code change
☑ Run regression checks
☑ Build evidence pack
☑ Generate attestation
☑ Generate redacted procurement-safe export
☑ Verify hashes
☑ Remove one evidence artifact and prove pack validation fails
☑ Tamper one hash and prove attestation fails
☑ Redact incorrectly and prove export validator fails
☑ Attempt export with missing replay/audit references and fail loudly

## Required proof artifact

☑ `docs/proof/SECTION_49_PROOFOPS.json`

## Completion gate

☑ The platform can ship a code change and a verifiable proof package for that change

---

# Section 50 — SkyeSovereign Runtime

## Goal

Turn provider connectivity into policy-aware sovereign runtime orchestration.

## Required implementation

☑ Build provider graph with capability, cost, latency, trust tier, tenancy scope, policy limits, and health state
☑ Add runtime routing engine that can choose providers by lowest cost, highest trust, private-only, fastest acceptable, enterprise policy mode, failover-only, or human approval required
☑ Add failover logic across sovereign providers
☑ Add routing explanation surface that states why a provider was chosen or denied
☑ Add policy denial surface when no valid route exists

## Required smoke proof

☑ Load multiple provider fixtures
☑ Classify them by capability
☑ Route a task under policy mode A
☑ Route the same task differently under policy mode B
☑ Simulate provider outage
☑ Prove failover
☑ Emit route explanation
☑ Inject invalid provider metadata
☑ Simulate secret mismatch
☑ Simulate outage with no valid fallback
☑ Simulate cost cap breach
☑ Simulate trust policy denying every route and prove loud explanation

## Required proof artifact

☑ `docs/proof/SECTION_50_SKYE_SOVEREIGN_RUNTIME.json`

## Completion gate

☑ The platform can reason over multiple sovereign providers and explain routing under changing policy, cost, and failure conditions

---

# Section 51 — CostBrain / Live Economic Intelligence

## Goal

Give SkyeHands real-time economic reasoning over software creation.

## Required implementation

☑ Track token spend, compute cost, build time, deploy cost, storage cost, and rollback risk per run
☑ Add cost model per provider and runtime lane
☑ Add planning modes such as cheapest acceptable, safest regulated patch, fastest fix under budget, private-only budget mode
☑ Add budget-aware planner and runtime decision engine
☑ Add cost explanation UI for why a cheaper or safer route was selected
☑ Add budget overrun denial path and approval path

## Required smoke proof

☑ Run the same task under multiple budget policies
☑ Prove route/plan changes when budget changes
☑ Prove live spend accounting for the run
☑ Prove over-budget denial
☑ Prove human override can approve a more expensive route
☑ Inject incorrect cost metadata and prove validation catches it
☑ Simulate provider price spike and prove planner reroutes or fails loudly

## Required proof artifact

☑ `docs/proof/SECTION_51_COSTBRAIN.json`

## Completion gate

☑ The platform can choose materially different engineering strategies based on explicit economic constraints and explain why

---

# Section 52 — Compliance-Native Development Modes

## Goal

Make regulated development modes first-class runtime behavior rather than marketing language.

## Required implementation

☑ Add named modes such as finance mode, healthcare mode, government mode, education mode, air-gapped mode
☑ Bind each mode to tool access, logging depth, data retention, provider routing, approval workflow, and export policy
☑ Add policy packs and enforcement engine per mode
☑ Add UI for mode selection, effective policy view, and denial explanation
☑ Add mode-aware proof/export packaging

## Required smoke proof

☑ Run the same task in two different compliance modes and prove different runtime/tooling behavior
☑ Prove provider routing restrictions change by mode
☑ Prove retention/export policy changes by mode
☑ Simulate a forbidden action in regulated mode and prove denial with explanation
☑ Simulate air-gapped denial for disallowed egress
☑ Tamper a compliance profile and prove verification fails

## Required proof artifact

☑ `docs/proof/SECTION_52_COMPLIANCE_NATIVE_MODES.json`

## Completion gate

☑ A regulated mode measurably changes runtime behavior, allowed actions, and evidence posture compared with a less restricted mode

---

# Section 53 — Autonomy Gradient

## Goal

Give users explicit control over how autonomous the system is at every step.

## Required implementation

☑ Add autonomy modes such as suggest-only, draft-and-wait, execute-with-review-gates, full autonomous, continuous maintenance mode
☑ Bind autonomy settings by task, workspace, repo, branch, user, and policy tier
☑ Add review gates and approval checkpoints
☑ Add UI showing current autonomy level and pending approval requirements
☑ Add policy enforcement for forbidden autonomy levels in restricted contexts

## Required smoke proof

☑ Run the same task under multiple autonomy modes and prove different execution behavior
☑ Prove suggest-only never mutates state
☑ Prove draft-and-wait produces a patch but stops before execution
☑ Prove execute-with-review-gates pauses at human approval
☑ Prove fully autonomous completes without manual stop when allowed
☑ Simulate forbidden autonomy escalation and prove denial

## Required proof artifact

☑ `apps/skyequanta-shell/bin/workspace-proof-section53-autonomy-gradient.mjs`
☑ `scripts/smoke-section53-autonomy-gradient.sh`
☑ `docs/proof/SECTION_53_AUTONOMY_GRADIENT.json`

## Completion gate

☑ The same task behaves materially differently under different autonomy settings, with policy and evidence enforcing the distinction

---

# Section 54 — Environment Mirror / SkyeClone

## Goal

Make SkyeHands intelligent about reconstructing engineering environments from external or partial input.

## Required implementation

☑ Add ingestion for repo metadata, docs, config files, deployment descriptors, and runtime traces
☑ Build environment reconstruction model for services, env vars, runbooks, dependency graphs, and launch paths
☑ Add environment gap report that explains what was inferred, what was confirmed, and what is still missing
☑ Add UI for reconstructed environment summary and manual correction
☑ Add reusable environment template export

## Required smoke proof

☑ Import a fixture repo or descriptor set
☑ Reconstruct workspace/runtime model
☑ Launch reconstructed environment successfully
☑ Produce environment gap report
☑ Export reconstructed template
☑ Inject incomplete metadata and prove gap report remains honest
☑ Inject contradictory metadata and prove conflict detection
☑ Tamper one inferred service dependency and prove validation fails or requests correction

## Required proof artifact

☑ `apps/skyequanta-shell/bin/workspace-proof-section54-environment-mirror.mjs`
☑ `scripts/smoke-section54-environment-mirror.sh`
☑ `docs/proof/SECTION_54_ENVIRONMENT_MIRROR.json`

## Completion gate

☑ The system can reconstruct a materially usable engineering environment from partial external signals and honestly show what was inferred versus proven

---

# Section 55 — SkyeFoundry

## Goal

Turn SkyeHands into a white-label developer-cloud foundry.

## Required implementation

☑ Add tenant-brandable shell generation
☑ Add tenant-branded domain, policy, provider, and audit posture configuration
☑ Add per-tenant feature tiering and branding surfaces
☑ Add tenant packaging/export lane for white-label deployment
☑ Add operator UI for provisioning a branded developer cloud from the core platform

## Required smoke proof

☑ Provision two distinct branded foundry tenants
☑ Prove they render different domains/branding/policies while sharing core runtime
☑ Prove provider settings and governance boundaries remain tenant-scoped
☑ Export a white-label package for a tenant
☑ Simulate cross-tenant branding bleed and prove denial
☑ Simulate cross-tenant provider bleed and prove denial

## Required proof artifact

☑ `docs/proof/SECTION_55_SKYE_FOUNDRY.json`

## Completion gate

☑ The platform can spin up distinctly branded autonomous developer clouds without cross-tenant leakage

---

# Section 56 — Autonomous Maintenance Mode

## Goal

Make SkyeHands a persistent maintenance system that improves software between direct user interventions.

## Required implementation

☑ Add persistent maintenance scheduler for dependency upgrades, flaky test detection, stale code discovery, vulnerability patch proposals, doc refresh, and infra drift checks
☑ Add maintenance policy controls and allowed action windows
☑ Add maintenance evidence ledger
☑ Add UI for maintenance queue, completed tasks, and blocked tasks
☑ Add safety gates for unattended maintenance

## Required smoke proof

☑ Detect stale dependency or flaky test in a fixture project
☑ Propose or perform a maintenance action under allowed policy
☑ Produce evidence for the maintenance action
☑ Persist task across restart
☑ Simulate policy denial for unattended mutation and prove loud stop
☑ Simulate failed maintenance run and prove retry/rollback behavior
☑ Simulate recurring issue and prove scheduler reopens it appropriately

## Required proof artifact

☑ `docs/proof/SECTION_56_AUTONOMOUS_MAINTENANCE_MODE.json`

## Completion gate

☑ The platform can detect, queue, execute, and explain maintenance work without requiring the user to initiate every action manually

---

# Section 57 — Deal / Ownership-Aware Code Generation

## Goal

Make the platform commercially aware of ownership, licensing, white-label boundaries, and export rights.

## Required implementation

☑ Add project commercial profile model distinguishing internal product, client work, white-label branch, acquirable core asset, regulated internal tool, community edition, and resale-restricted deliverable
☑ Add policy engine for reuse restrictions, founder-only modules, export restrictions, and ownership boundaries
☑ Add generation planner that respects commercial profile before producing patches, exports, or templates
☑ Add UI showing current ownership/deal posture and blocked reuse lanes
☑ Add export packaging that honors the project commercial profile

## Required smoke proof

☑ Create multiple commercial profiles
☑ Prove generation/export behavior changes by profile
☑ Prove founder-only modules stay blocked from inappropriate exports
☑ Prove white-label package excludes restricted internal components
☑ Simulate ownership mismatch and prove export denial
☑ Simulate illegal reuse request and prove policy denial with explanation
☑ Tamper commercial profile and prove verification catches it

## Required proof artifact

☑ `docs/proof/SECTION_57_DEAL_OWNERSHIP_AWARE_GENERATION.json`

## Completion gate

☑ The platform can materially alter generation and export behavior based on ownership, licensing, and commercial boundaries


---

# Section 58 — DevGlow

## Goal

Give SkyeHands a live developer-inspection glow surface that can reveal the exact backing file path for the current screen, expose command references fast, and let operators capture bug trails without hunting manually through a large repo or live runtime.

## Required implementation

☑ Add a global keyboard command that opens the DevGlow overlay from the active SkyeHands surface
☑ Add exact backing file-path resolution for the live screen, route, panel, or currently focused UI surface
☑ Add clipboard copy action for the resolved file path
☑ Add bug-log capture action so copied paths and notes can be appended into a persistent operator log
☑ Add tabbed DevGlow menu with Path, Keyboard Commands, and Terminal Commands views
☑ Add keyboard-commands registry surface that lists live shortcuts with current bindings
☑ Add terminal-commands registry surface that lists canonical run, smoke, recovery, and proof commands
☑ Add support for local projects, remote workspace runtimes, private server sessions, and Codespaces-style live environments
☑ Add explanation surface for why a path was resolved and where the resolution came from
☑ Add hostile-path handling so unresolved, ambiguous, or generated-only surfaces fail loudly instead of guessing
☑ Add privacy / policy filtering so restricted paths can be redacted or denied under policy mode
☑ Add durable event logging for DevGlow opens, copies, denials, and bug-log writes

## Required smoke proof

☑ Trigger the DevGlow keyboard command from a fixture surface
☑ Prove the overlay resolves the exact backing file path for the active screen
☑ Copy the resolved path to clipboard and prove it matches the displayed value
☑ Switch to Keyboard Commands tab and prove live bindings render
☑ Switch to Terminal Commands tab and prove canonical commands render
☑ Append a captured path into a persistent bug log and prove persistence after restart
☑ Trigger DevGlow on an ambiguous screen and prove the system fails loudly instead of inventing a path
☑ Trigger DevGlow on a restricted surface and prove path redaction or denial follows policy
☑ Inject stale route metadata and prove resolution verification fails
☑ Inject duplicate bug-log writes and prove dedupe or explicit duplicate handling
☑ Corrupt one logged DevGlow event and prove verification fails loudly

## Required proof artifact

☑ `docs/proof/SECTION_58_DEVGLOW.json`

## Completion gate

☑ A developer can stand on a live screen, invoke DevGlow, see the exact verified backing file path, copy it, inspect command references, and persist bug-trace evidence without guessing

---

---

# Section 59 — Deep Scan Mode

## Goal

Allow a user to drop a zip or project into the environment, reconstruct a launch path, run it like a deployed product, test it end to end, and emit a valuation-ready proof posture only after real execution.

## Required implementation

☑ Add user-supplied zip/project ingestion for deep scan entry
☑ Add honest environment reconstruction with descriptor harvest and gap report
☑ Add deployed-style local launch lane for previewable targets
☑ Add rendered-route probe lane and visible-control harvest
☑ Add end-to-end functionality action checks against the running target
☑ Integrate `apps/skye-reader-hardened/server.js` through `apps/skyequanta-shell/lib/skye-reader-bridge.mjs` so deep scan extracts a real project document dossier from README/docs/public and other readable inputs
☑ Tie deep scan into replay export and verification
☑ Tie deep scan into compliance, cost, council, and memory-backed explanation lanes
☑ Add denial posture for unsupported or non-launchable inputs

## Required smoke proof

☑ Drop a fixture zip into the environment and ingest it
☑ Launch the ingested target like a running product
☑ Probe multiple rendered routes
☑ Harvest visible controls from the live surface
☑ Execute a real end-to-end action against the running preview
☑ Import readable project documents through the integrated Skye Reader lane and emit a dossier artifact
☑ Export replay refs and verify them
☑ Prove valuation-ready posture is only granted after launch, route proof, and action proof all pass
☑ Tamper the deep scan report and prove verification fails
☑ Feed an unsupported project and prove the system fails honestly instead of pretending

## Required proof artifact

☑ `docs/proof/SECTION_59_DEEP_SCAN_MODE.json`

## Completion gate

☑ The platform can ingest a user project, reconstruct a launch path, run it, test it, and emit a valuation-ready proof posture from actual execution

---

# Section 60 — Valuation Audit Mode

## Goal

Convert a verified deep scan into a deterministic valuation and an investor-ready audit website generated from a controlled template base.

## Required implementation

☑ Add valuation mode that consumes a verified deep-scan report instead of narrative-only input
☑ Add deterministic single-number valuation model driven by launch, routes, actions, controls, descriptors, and proof integrations
☑ Add investor-ready audit website generation from a dedicated base template file
☑ Carry the deep-scan reader dossier into valuation scoring and the generated audit website using `apps/skyequanta-shell/lib/valuation-audit-mode.mjs`
☑ Tie valuation mode into council arbitration
☑ Tie valuation mode into ProofOps evidence-pack validation and attestation
☑ Carry replay references from deep scan into the investor audit website and evidence pack
☑ Fail loudly on tampered deep-scan inputs or missing valuation templates
☑ Use `docs/templates/INVESTOR_AUDIT_WEBSITE_BASE_TEMPLATE.html` as the base template for generated valuation websites

## Required smoke proof

☑ Produce a single-number valuation from a launch-backed deep scan
☑ Generate an investor-ready audit website from the base template
☑ Prove the base template marker survives into the generated website
☑ Build an evidence pack and attestation for the valuation website
☑ Carry replay refs into the valuation lane
☑ Carry the integrated reader dossier into the website and evidence pack
☑ Show that deeper proven functionality yields a higher valuation than a shallower surface
☑ Tamper the deep-scan report and prove valuation mode denies it
☑ Remove the template path and prove valuation mode fails loudly

## Required proof artifact

☑ `docs/proof/SECTION_60_VALUATION_AUDIT_MODE.json`

## Completion gate

☑ The platform can prove what it built, convert that proof into a deterministic valuation, and emit an investor-ready audit website from a controlled template surface

---

# Build order recommendation

## Phase 1

☑ Section 49 — ProofOps

## Phase 2

☑ Section 47 — SkyeReplay

## Phase 3

☑ Section 46 — SkyeMemory Fabric

## Phase 4

☐ Section 48 — kAIxU Council

## Phase 5

☐ Section 50 — SkyeSovereign Runtime

## Phase 6

☐ Sections 51–58 in the order best aligned to the product’s next commercial lane

---

# Final rule

These sections are not category-defining because their names sound ambitious.
They become category-defining only when the code path, runtime path, hostile path, and smoke evidence all exist together.
