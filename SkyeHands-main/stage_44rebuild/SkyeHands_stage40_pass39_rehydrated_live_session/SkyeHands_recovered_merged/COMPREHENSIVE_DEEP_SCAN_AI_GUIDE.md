# COMPREHENSIVE DEEP SCAN AI GUIDE

This file is the canonical AI-orientation dossier for the surviving SkyeHands project tree.

Its job is simple: any future AI touching this repository should be able to understand what the product is, which paths are authoritative, which paths are generated or mirrored, how the runtime is composed, how claims are proven, and where to edit without corrupting the current-truth lane.

---

## 1) Identity resolution: what this project is called

This codebase carries multiple names. They are related, not contradictory.

- **SkyeHands** = the repository and umbrella project identity.
- **SkyeQuantaCore** = the integrated runtime/product identity used throughout the operator docs.
- **TheHybrid-AutonomousIDE** = the root package identity in the top-level `package.json`.
- **SkyeQuanta Shell** = the canonical product-owned runtime shell under `apps/skyequanta-shell`.
- **IDE Core** = the vendored / integrated Theia substrate under `platform/ide-core`.
- **Agent Core** = the vendored / integrated OpenHands substrate under `platform/agent-core`.

The most accurate short description is:

> **SkyeHands is a proof-driven, product-owned Codespaces-replacement platform that wraps a SkyeQuanta shell around integrated Theia IDE and OpenHands agent lanes, then extends that stack with governance, workspace orchestration, preview routing, deep scan, valuation audit, imported-platform launchpad/power mesh, and proof-backed hardening.**

---

## 2) Executive summary: what the project actually does

At a high level, this repository is not “just an IDE” and not “just an agent.” It is a **multi-layer runtime platform** with all of the following characteristics:

1. It provides a **canonical operator CLI** at the shipped root.
2. It launches a **product-owned shell** that starts and coordinates:
   - a bridge/runtime surface,
   - an IDE lane,
   - an agent/backend lane.
3. It supports **workspace orchestration** with lifecycle, provisioning, snapshots, governance, audit events, and forwarded preview routing.
4. It integrates **deep proof discipline**: stages and sections are not supposed to be declared done unless code, proof command, and proof artifact all exist and survive restart.
5. It integrates **deep scan mode** that can ingest other projects, reconstruct launch posture, launch them, probe routes, harvest controls, run actions, build reader dossiers, and only then grant valuation-ready posture.
6. It integrates **valuation audit mode** that consumes verified deep-scan evidence and emits a deterministic single-number valuation plus an investor-audit website/evidence pack.
7. It supports **imported platforms** via a launchpad / import mesh and then a deeper **power mesh** that indexes nested capsules, routes, env-example keys, and launchable surfaces.
8. It now carries a concrete **agent-core runtime bundle** under `platform/agent-core/runtime`, rather than leaving the agent lane as a vague dependency story.
9. It has a large hardening/proof ecosystem spanning runtime isolation, recovery, artifact identity, AppArmor/delegated control, memory/replay/council/proofops, sovereignty, cost, compliance, foundry, maintenance, deep scan, valuation, and import mesh/power mesh lanes.

The key mental model is:

> **SkyeHands is a sovereign operator shell that turns upstream IDE + agent runtimes into a productized, audited, proof-oriented autonomous workspace platform.**

---

## 3) The most important truth: which paths are canonical

If an AI ignores this section, it will almost certainly misunderstand the repo.

### Canonical product-owned runtime path

The current-truth docs explicitly lock the canonical runtime path to:

- `apps/skyequanta-shell`

This is the authoritative product runtime surface. Most behavior that matters operationally should be interpreted through this shell.

### Canonical public operator entrypoints

Use these first:

- `./START_HERE.sh`
- `./skyequanta`
- `node ./skyequanta.mjs <command>`

The root layer exists to expose a converged shipped surface so operators and reviewers do not have to guess deep internal paths.

### Canonical operator docs

These files define current-truth operator posture and should be read before touching code:

- `docs/CURRENT_TRUTH_INDEX.md`
- `docs/CANONICAL_RUNTIME_PATHS.md`
- `docs/CANONICAL_OPERATOR_SURFACE.md`
- `docs/LAUNCH_READINESS.md`
- `docs/SMOKE_CONTRACT_MATRIX.md`
- `docs/CODESPACES_REPLACEMENT_EXECUTION_DIRECTIVES.md`

### Canonical source vs non-canonical mirrors

Authoritative source lanes:
- `apps/skyequanta-shell/**`
- `apps/skye-reader-hardened/**`
- `platform/ide-core/**`
- `platform/agent-core/**`
- `platform/user-platforms/**`
- `docs/**`
- `scripts/**`
- root wrappers such as `README.md`, `START_HERE.sh`, `skyequanta`, `skyequanta.mjs`, `package.json`, `Makefile`

Non-authoritative or generated/mirrored lanes:
- `.skyequanta/**` → mutable runtime state, reports, runtime registry, logs, recovery residue
- `workspace/volumes/**` → workspace filesystem mirrors / runtime sandboxes / persisted workspace state
- `dist/**` → generated release/output material
- `docs/proof/**` → proof artifacts; inspect them, but do not hand-edit them casually
- historical stage archive residue and older generated documents

Rule of thumb:

> **Edit source; inspect outputs. Do not treat outputs as the primary implementation lane.**

---

## 4) Recovery-merge context: why the tree is huge and why duplicate-looking paths exist

This repo is the result of a **recovered merge**. The merge report says the recovered tree used:

- TAR base: `SkyeHands_3_1_9_FULL_PROJECT_COMPLETE (1).tar.gz`
- ZIP donor: `SkyeHands-main_stage40_pass38_stage9_fallback_full (3)(1).zip`

Merge rule:
- keep TAR files when the same path existed in both,
- restore only missing ZIP paths into the TAR base.

Important counts from the recovered merge report:
- ZIP regular files: **28,426**
- TAR regular files: **13,940**
- Merged regular files: **28,597**
- Restored from ZIP into TAR base: **14,657**
- TAR-only files preserved: **171**
- Same-path ZIP/TAR files kept from TAR: **51**
- ZIP files still missing after merge: **0**

This matters because future AI systems may see:
- canonical source files,
- generated release copies,
- workspace runtime mirrors,
- proof residue,
- historical stage artifacts,
and falsely assume they are all equal. They are not.

The recovered merge created a **surviving full tree**, but the AI must still distinguish:
- **implementation source**
from
- **runtime copies**
from
- **release artifacts**
from
- **proof artifacts**
from
- **historical residue**.

---

## 5) Repo anatomy: what each major top-level area means

## Root files

### `README.md`
High-level root operator surface. It tells operators to enter through the root wrappers and points them at the shell.

### `START_HERE.sh`
One-command operator bootstrap wrapper. It currently prints guidance and executes a deploy-readiness doctor flow from the root.

### `skyequanta` / `skyequanta.mjs`
Canonical command router. This is the public wrapper that maps high-value commands into `apps/skyequanta-shell/bin/*` entrypoints.

### `package.json`
Root wrapper package for the hybrid autonomous IDE. It exposes a subset of top-level operator and proof commands and deliberately routes through `skyequanta.mjs`.

---

## `apps/skyequanta-shell/` — the heart of the product

This is the single most important path in the repo.

It is the **product-owned shell runtime** and the canonical implementation lane for:
- launch orchestration,
- bridge runtime,
- doctor / deploy readiness,
- remote executor,
- workspace lifecycle,
- governance,
- snapshots,
- proof runners,
- deep scan,
- valuation audit,
- platform import/launchpad/power mesh,
- current-chain refresh logic,
- runtime closure / hardening layers.

### `apps/skyequanta-shell/bin/`
This folder contains the command-entry layer.

Representative responsibilities:
- `launch.mjs` → starts bridge + agent backend + IDE and waits for them to become live
- `bridge.mjs` → owns the bridge/runtime HTTP surface
- `doctor.mjs` → deploy-readiness runner
- `remote-executor.mjs` → detached executor service for durable workspace orchestration
- `operator-start.mjs` / `operator-green` lanes → operator startup flows
- `workspace-proof-*` files → proof runners for stages/sections
- `ship-candidate.mjs` → packaging lane
- `current-chain-refresh.mjs` / `current-chain-rerun.mjs` → refresh current-truth status summaries and closure matrix
- `platform-import.mjs`, `platform-launch-plan.mjs`, `platform-power-mesh.mjs`, `platform-power-query.mjs` → imported platform lanes
- deep scan / valuation entrypoints for Sections 59 and 60
- Section 61 / 62 / 63 proof entrypoints

### `apps/skyequanta-shell/lib/`
This folder contains the durable logic layer.

Representative responsibilities:
- runtime state management
- process spawning
- bridge logic
- workspace registry and workspace manager
- workspace runtime provisioning / status / stopping
- runtime bus and event projection
- governance and audit
- snapshot retention / create / restore
- provider vault / provider bindings / provider connectors / provider projection / redaction / provider UI
- replay, memory, proofops, costbrain, council, compliance, sovereignty, etc
- skye-reader integration bridge used by deep scan and valuation

This is where an AI should look when it needs to understand **how** the platform works, not just **how to invoke** it.

---

## `apps/skye-reader-hardened/` — document ingestion and dossier engine

This is an integrated document-reader subsystem used by the higher-level deep scan and valuation lanes.

It is not a random side app. It matters because Section 59 and Section 60 explicitly pull it into the platform.

It supports:
- document ingestion,
- text extraction,
- reader library behavior,
- OpenAI-backed reading/TTS lanes,
- OCR/document parsing,
- smoke tests.

In practice, the SkyeQuanta shell uses `apps/skyequanta-shell/lib/skye-reader-bridge.mjs` to:
- start this reader app,
- select candidate readable files from an ingested project,
- import them,
- build a reader dossier,
- emit JSON + HTML dossier artifacts that enrich deep scan and valuation.

---

## `platform/ide-core/` — Theia-based IDE substrate

This is the integrated IDE backbone. It is effectively a Theia monorepo plus AI-oriented packages.

It includes:
- standard Theia monorepo structure,
- examples,
- packages,
- build/test tooling,
- plugins,
- AI packages such as:
  - `@theia/ai-ide`
  - `@theia/ai-chat`
  - `@theia/ai-chat-ui`
  - `@theia/ai-core`
  - `@theia/ai-mcp`
  - `@theia/ai-terminal`
  - `@theia/ai-claude-code`

Important interpretation rule:

> `platform/ide-core` is the **IDE substrate**, but the product-owned operator truth still lives in `apps/skyequanta-shell`. Do not confuse the integrated IDE monorepo with the public product surface.

---

## `platform/agent-core/` — OpenHands-based agent substrate

This is the integrated agent backbone. It contains an OpenHands-style backend/frontend/enterprise structure and also now contains a smaller shipped runtime bundle under `platform/agent-core/runtime`.

Important interpretation rule:

> `platform/agent-core` is the **agent substrate**, but the product-owned orchestration truth still lives in `apps/skyequanta-shell`.

There are two relevant layers here:
1. the larger integrated upstream-style OpenHands tree,
2. the concrete shipped agent-core runtime bundle.

The shipped runtime bundle matters because Section 63 proves that the repo no longer stops at a manifest/story level and instead exposes a concrete runtime with start/smoke commands and live health/manifest responses.

---

## `platform/user-platforms/` — imported platform launchpad and power mesh

This is where external / imported platforms get normalized into a SkyeHands-owned intake lane.

Important artifacts include:
- `platform/user-platforms/<platform-slug>/source/`
- `platform/user-platforms/<platform-slug>/skyehands.platform.json`
- `platform/user-platforms/REGISTRY.json`
- `platform/user-platforms/POWER_MESH_REGISTRY.json`
- platform-specific `skyehands.power.json` files

This lane allows SkyeHands to:
- ingest a platform,
- discover scripts and static surfaces,
- build launch plans,
- deny broken launch plans honestly,
- preserve nested branch-app depth,
- expose env-example keys,
- expose route targets,
- support intent search across capsules,
- and then pass imported platform depth into deep scan and valuation lanes.

---

## `docs/` — current truth, directives, proofs, and diligence surfaces

This folder is critical.

It contains:
- canonical operator docs,
- canonical runtime docs,
- hardening directives,
- proof artifacts,
- investor/procurement-oriented supporting docs,
- templates.

This repo is unusually documentation-heavy because the docs are not just narrative. They are part of the **claim governance system**.

### `docs/hardening/`
Directive files for advanced sections.

### `docs/proof/`
Proof artifacts, usually JSON. These are evidence surfaces, not just notes.

### `docs/templates/`
Templates used by valuation audit and related output systems.

Important interpretation rule:

> In this repo, docs are part of the system design. They are not optional commentary.

---

## `scripts/`
Shell-level smoke and helper scripts. Usually these are the shell-side proof runners that correspond to section/stage verification contracts.

---

## `.skyequanta/`
Mutable runtime state, reports, platform-launchpad runtime registries, recovery artifacts, audit/replay/log surfaces, and other live/generated material.

Treat this as **runtime/state residue**, not as the source-of-truth implementation lane.

---

## `workspace/`
This is the workspace runtime/state lane. It includes workspace volumes, instance directories, and mirrored filesystem content for launched or proven workspaces.

Treat this as:
- valuable evidence,
- useful for understanding runtime behavior,
- **not** the primary source tree to edit.

---

## `dist/`
Generated release/output material. Useful for release inspection, not usually the primary edit lane.

---

## 6) The core architecture in one sentence

The architecture is:

> **Root wrappers → SkyeQuanta shell → bridge/runtime + IDE substrate + agent substrate → workspace/governance/provider/proof/deep-scan/valuation/import-mesh services → evidence/proof artifacts and launchable products.**

---

## 7) Command routing: how the public surface works

The root `skyequanta.mjs` file is extremely important because it defines the public command contract.

It resolves root commands into the shell, for example:
- `doctor`
- `operator:start`
- `launch` / `start`
- `workspace:proof:section61`
- `workspace:proof:section62`
- `workspace:proof:section63`
- `workspace:proof:stage4`
- `workspace:proof:stage8`
- `workspace:proof:stage9`
- `workspace:proof:stage10`
- `workspace:proof:stage11`
- `workspace:proof:section8`
- `current:refresh`
- `current:rerun`
- `ship:candidate`

This is a strong signal that the **root wrapper is intentionally narrow**. It only exposes the public/high-value operator lanes and delegates the rest into the shell.

---

## 8) What `launch.mjs` tells us about the live runtime composition

The shell launcher is one of the best “what is this system” files in the repo.

The launcher builds process specs for:

- **stack bridge**
  - launched by `apps/skyequanta-shell/bin/bridge.mjs`
  - exposes the bridge/runtime HTTP surface
- **agent backend**
  - launched via `poetry run uvicorn skyequanta_app_server:app`
  - points into the agent-core lane
  - accepts gate/provider config through env
- **ide**
  - launches Theia/browser IDE surface
  - feeds runtime contract / public origin / gate URL config

The launcher waits for these surfaces to become live, prints a startup summary, and treats them as a coordinated runtime set.

This means SkyeHands is not a single process. It is a **coordinated runtime stack**.

---

## 9) Workspace architecture: what the workspace manager proves this system really is

`apps/skyequanta-shell/lib/workspace-manager.mjs` is one of the clearest implementation files in the repo.

It shows that the platform has real concepts of:

- workspace registry
- current workspace selection
- workspace runtime projection
- runtime events
- audit events
- tenant IDs
- machine profiles
- secret scopes
- repo or template seeding
- snapshot creation / restore / delete
- forwarded preview ports
- runtime state / sandbox paths
- start / stop / delete lifecycle
- persisted workspace metadata

This is important because it confirms SkyeHands is not merely “a launcher for Theia/OpenHands.” It is a **workspace platform** with its own control plane logic.

Key behaviors present in the workspace manager:
- create workspace
- create from git repo
- create from template path
- select workspace
- start workspace
- stop workspace
- delete workspace
- list workspace ports
- allow/deny preview ports
- create/restore/list/remove snapshots
- apply snapshot retention
- set workspace secret scope

That is Codespaces/remote-workspace platform behavior, not just editor behavior.

---

## 10) Deep scan and valuation: why this repo is more than an IDE stack

Sections 59 and 60 are some of the most commercially important parts of the repo.

### Section 59 — Deep Scan Mode
Deep Scan Mode is designed to:
- ingest user-supplied zip/project inputs,
- reconstruct environment/launch posture honestly,
- launch the target locally like a running product,
- probe rendered routes,
- harvest visible controls,
- execute end-to-end actions,
- integrate the Skye Reader dossier,
- tie output into replay/compliance/cost/council/memory lanes,
- deny unsupported inputs honestly.

This is a project-ingestion + runtime-proving + audit-preparation engine.

### Section 60 — Valuation Audit Mode
Valuation mode is designed to:
- consume verified deep-scan output,
- derive a deterministic single-number valuation,
- generate an investor-ready audit website from a controlled template,
- tie into ProofOps,
- carry replay references,
- carry the reader dossier,
- deny tampered or incomplete inputs.

This is not a hand-wavy “AI valuation idea.” It is intended to be a **proof-backed commercial assessment lane**.

---

## 11) Imported platforms: what Sections 61 and 62 add

### Section 61 — Platform Launchpad / Import Mesh
This adds a canonical intake model for imported platforms.

Capabilities include:
- one authoritative source directory per imported platform,
- generated manifest per platform,
- canonical registry plus runtime registry,
- script/static-surface discovery,
- honest denial if runtime scripts point to missing files,
- real static launch-plan execution,
- preservation of nested launcher depth,
- linkage of imported platform summaries into deep scan and valuation.

### Section 62 — Platform Power Mesh
This deepens imported-platform analysis by:
- indexing nested branch-app capsules,
- surfacing env-example keys,
- surfacing route targets,
- enabling intent search across imported platform depth,
- launching nested imported capsules as real proof,
- writing canonical/runtime power-mesh registries.

The existing proof shows one imported platform lane:
- `skye-account-executive-commandhub-s0l26-0s`

The power mesh for that platform currently reports:
- capsule count: 6
- launchable capsule count: 4
- env key count: 120
- route target count: 59

This means SkyeHands is not only about its own runtime. It is also an **environment that can absorb, map, and prove other platforms**.

---

## 12) Agent-core bundle: what Section 63 changes

Section 63 proves that the repo now ships a concrete runtime bundle at:

- `platform/agent-core/runtime`

That runtime bundle has:
- a package identity,
- a `start` script,
- a `smoke` script,
- health endpoint,
- manifest endpoint,
- proof of live response.

The manifest advertises capabilities such as:
- `health`
- `manifest`
- `bundle-proof`

This matters because it closes a common “oversell gap”:
- before: “the repo contains agent-core code”
- now: “the repo contains a concrete agent-core runtime bundle that starts and answers live requests”

---

## 13) The Skye Reader lane: how document intelligence fits into the platform

The Skye Reader bridge is one of the most important “glue” modules in the repo.

It does all of the following:
- locates readable files within a project,
- prioritizes likely high-value docs such as README/docs/investor/audit/security/pricing surfaces,
- launches the integrated reader app,
- imports candidate docs,
- extracts text,
- counts keyword clusters across investor/product/proof/compliance/monetization themes,
- builds excerpts,
- emits JSON and HTML dossier outputs.

This means document understanding is not bolted on. It is part of the platform’s **evidence-generation and explanation stack**.

Future AI systems should understand that:
- Skye Reader is used to enrich deep scan,
- deep scan enriches valuation,
- valuation enriches investor audit surfaces,
- therefore docs and readable content are part of runtime proof posture, not just “nice-to-have context.”

---

## 14) Proof discipline: how this repo decides what is real

This repository has a strict completion philosophy.

A claim is not supposed to be marked complete merely because code exists.

The directive ledger states that a green check is valid only when:
1. the code change already exists in the repo,
2. the proof command has been run successfully,
3. a proof artifact exists under `docs/proof/`,
4. the exact proof artifact path is recorded,
5. the result is still true after a fresh runtime start.

This matters for any future AI touching the repo.

### What this means operationally
- Do not claim completion from a diff alone.
- Do not infer that a section is green because similar code exists elsewhere.
- Do not overwrite honest gates with optimistic wording.
- If proof is stale, the honest status may still be open even when code exists.

---

## 15) Current honest gate: what is currently green vs still open in the current chain

The current chain refresh / smoke matrix indicates:

Green in the current chain:
- Stage 9 deployment readiness
- Section 8 ship-candidate packaging
- Section 61 imported platform launchpad
- Section 62 imported platform power mesh
- Section 63 agent-core runtime bundle

Still open / blank in the current chain:
- Stage 8 preview forwarding
- Stage 10 multi-workspace stress
- Stage 11 regression proof
- Section 42 portable hostile-environment rerun

This is an important nuance:
- many earlier directives show substantial implementation depth,
- but the **current chain** still preserves honest open status for selected reruns.

Any future AI must preserve that honesty.

---

## 16) Section-map summary: what the major advanced sections mean

Below is a compressed map for fast orientation.

### Sections 38–45: hardening and trust surface
- **38** — production hardening plus
- **39** — runtime isolation and tenant proof
- **40** — runtime recovery and disaster recovery
- **41** — rootless namespace and deploy trust
- **42** — kernel containment and artifact identity
- **43** — live surface identity and LSM/AppArmor posture
- **44** — execution attestation and killpath enforcement
- **45** — AppArmor and delegated controller

### Sections 46–52: category-of-one intelligence and control
- **46** — Skye Memory Fabric
- **47** — Skye Replay
- **48** — kAIxU Council
- **49** — ProofOps
- **50** — Skye Sovereign Runtime
- **51** — CostBrain
- **52** — Compliance-native modes

### Sections 53–58: governance / foundry / maintenance / commercial boundary / operator precision
- **53** — Autonomy Gradient
- **54** — Environment Mirror
- **55** — Skye Foundry
- **56** — Autonomous Maintenance Mode
- **57** — Deal Ownership Aware Generation
- **58** — DevGlow

### Sections 59–63: high-value commercial and intake lanes
- **59** — Deep Scan Mode
- **60** — Valuation Audit Mode
- **61** — Platform Launchpad and Import Mesh
- **62** — Platform Power Mesh
- **63** — Agent-Core Runtime Bundle

This is one of the reasons the repo is large: it is not just shipping runtime behavior, it is shipping a **claim/proof/commercialization stack** around that runtime.

---

## 17) Sovereign provider lane: what Sections 29–35 mean in practice

The directives describe a proof-backed foundation for sovereign provider handling.

Implemented/proven foundation includes:
- encrypted provider vault storage,
- session-scoped unlock/relock,
- per-workspace binding roles and capability enforcement,
- provider catalog and connection-plan diagnostics,
- minimum-variable runtime projection,
- provider payload redaction,
- in-product Provider / Storage / Deployment centers,
- proof runners for the sections.

Important nuance:
- the directive also says that **live outbound provider verification against real third-party accounts is not yet smoke-backed in this repo**.

So future AI must distinguish between:
- strong in-repo proof-backed foundations,
- and still-open live third-party verification posture.

---

## 18) The canonical reading order for any AI that wants to understand the repo fast

A future AI should read in this order:

1. `COMPREHENSIVE_DEEP_SCAN_AI_GUIDE.md` (this file)
2. `docs/CURRENT_TRUTH_INDEX.md`
3. `docs/CANONICAL_RUNTIME_PATHS.md`
4. `docs/CANONICAL_OPERATOR_SURFACE.md`
5. `README.md`
6. `skyequanta.mjs`
7. `apps/skyequanta-shell/package.json`
8. `apps/skyequanta-shell/bin/launch.mjs`
9. `apps/skyequanta-shell/lib/workspace-manager.mjs`
10. `docs/LAUNCH_READINESS.md`
11. `docs/SMOKE_CONTRACT_MATRIX.md`
12. `docs/CODESPACES_REPLACEMENT_EXECUTION_DIRECTIVES.md`
13. `docs/hardening/SECTION_59_DEEP_SCAN_MODE_DIRECTIVE.md`
14. `docs/hardening/SECTION_60_VALUATION_AUDIT_MODE_DIRECTIVE.md`
15. `docs/hardening/SECTION_61_PLATFORM_LAUNCHPAD_AND_IMPORT_MESH_DIRECTIVE.md`
16. `docs/proof/SECTION_62_PLATFORM_POWER_MESH.json`
17. `docs/proof/SECTION_63_AGENT_CORE_BUNDLE.json`
18. `apps/skyequanta-shell/lib/skye-reader-bridge.mjs`
19. `apps/skye-reader-hardened/package.json`
20. `platform/ide-core/package.json`
21. `platform/ide-core/packages/ai-ide/package.json`
22. `platform/agent-core/AGENTS.md`
23. `platform/agent-core/runtime/package.json`

That reading order gives the AI:
- what the product claims,
- what is canonical,
- how to invoke it,
- how the shell orchestrates it,
- how workspaces function,
- how proof status is tracked,
- how deep scan/valuation/import mesh work,
- and how the integrated IDE/agent substrates fit in.

---

## 19) Fast task-routing guide: if an AI is asked to change X, go here first

### “Change the operator/launch experience”
Start with:
- `skyequanta.mjs`
- `START_HERE.sh`
- `apps/skyequanta-shell/bin/launch.mjs`
- `apps/skyequanta-shell/bin/operator-start.mjs`
- `docs/CANONICAL_OPERATOR_SURFACE.md`

### “Change the bridge API or runtime contract”
Start with:
- `apps/skyequanta-shell/bin/bridge.mjs`
- `apps/skyequanta-shell/lib/bridge.mjs`
- `apps/skyequanta-shell/bin/config.mjs`
- `docs/CANONICAL_RUNTIME_PATHS.md`

### “Change workspace lifecycle / provisioning / previews / snapshots”
Start with:
- `apps/skyequanta-shell/lib/workspace-manager.mjs`
- `apps/skyequanta-shell/lib/workspace-runtime.mjs`
- `apps/skyequanta-shell/lib/workspace-registry.mjs`
- `apps/skyequanta-shell/lib/snapshot-manager.mjs`
- `apps/skyequanta-shell/bin/remote-executor.mjs`

### “Change deep scan”
Start with:
- `apps/skyequanta-shell/bin/workspace-proof-section59-deep-scan-mode.mjs`
- `apps/skyequanta-shell/lib/skye-reader-bridge.mjs`
- `docs/hardening/SECTION_59_DEEP_SCAN_MODE_DIRECTIVE.md`

### “Change valuation audit”
Start with:
- `apps/skyequanta-shell/bin/workspace-proof-section60-valuation-audit-mode.mjs`
- `docs/hardening/SECTION_60_VALUATION_AUDIT_MODE_DIRECTIVE.md`
- `docs/templates/INVESTOR_AUDIT_WEBSITE_BASE_TEMPLATE.html`

### “Change imported-platform intake or imported app discovery”
Start with:
- `apps/skyequanta-shell/bin/platform-import.mjs`
- `apps/skyequanta-shell/bin/platform-launch-plan.mjs`
- `apps/skyequanta-shell/bin/workspace-proof-section61-platform-launchpad.mjs`
- `docs/hardening/SECTION_61_PLATFORM_LAUNCHPAD_AND_IMPORT_MESH_DIRECTIVE.md`

### “Change power mesh / capsule indexing / imported platform search”
Start with:
- `apps/skyequanta-shell/bin/platform-power-mesh.mjs`
- `apps/skyequanta-shell/bin/platform-power-query.mjs`
- `apps/skyequanta-shell/bin/workspace-proof-section62-platform-power-mesh.mjs`
- `platform/user-platforms/POWER_MESH_REGISTRY.json`
- platform-specific `skyehands.power.json` files

### “Change the agent runtime bundle”
Start with:
- `platform/agent-core/runtime/**`
- `apps/skyequanta-shell/bin/workspace-proof-section63-agent-core-bundle.mjs`
- `docs/proof/SECTION_63_AGENT_CORE_BUNDLE.json`

### “Change the IDE substrate”
Start with:
- `platform/ide-core/**`
But remember:
- do not accidentally present `platform/ide-core` internals as the canonical operator surface.

### “Change the document-reader / dossier lane”
Start with:
- `apps/skye-reader-hardened/server.js`
- `apps/skye-reader-hardened/public/app.js`
- `apps/skye-reader-hardened/scripts/smoke.mjs`
- `apps/skyequanta-shell/lib/skye-reader-bridge.mjs`

---

## 20) AI safety rails for editing this repo

Any future AI should follow these rules.

### Rule 1: never confuse source with runtime mirrors
Do not patch `workspace/volumes/**` when the real implementation lives in `apps/**`, `platform/**`, `docs/**`, or `scripts/**`.

### Rule 2: never claim completion without proof
If code changed, look for the proof runner and proof artifact that correspond to the lane.

### Rule 3: preserve honest gates
If Stage 8, 10, 11, or Section 42 are blank in the current chain, do not silently convert them to green language.

### Rule 4: public docs must use canonical public commands
When writing operator-facing text, lead with:
- `./START_HERE.sh`
- `./skyequanta`
not with obscure internal bin paths.

### Rule 5: do not flatten the project into “just OpenHands” or “just Theia”
The repo integrates those substrates, but the product identity and commercial architecture live in the shell/proof/import/deep-scan layers.

### Rule 6: generated proof JSON is evidence, not freeform prose
If proof artifacts are changed, they should usually be regenerated from the corresponding proof command, not hand-edited.

### Rule 7: current-truth docs are part of the system
They are not optional. If behavior changes materially, `docs/CURRENT_TRUTH_INDEX.md`, launch-readiness, smoke matrix, and related directives may also need alignment.

---

## 21) Important subtleties future AI must not miss

### Subtlety A — This repo is both runtime and diligence packet
It is simultaneously:
- a launchable platform,
- a proof/evidence machine,
- a deep-scan/valuation engine,
- an import mesh for other platforms.

### Subtlety B — The root surface is intentionally cleaner than the internals
The root wrappers are supposed to hide the implementation sprawl and present a converged operator surface.

### Subtlety C — The docs describe claim discipline, not just ideas
The directives and proof files are part of the repository’s operating contract.

### Subtlety D — There are upstream-style subtrees, but the shell is the product owner
Theia and OpenHands are substrates. The shell decides how they become a product.

### Subtlety E — Deep scan and valuation are first-class lanes
They are not just notes about how to assess other repos. They are implemented proof-backed lanes within this repo’s architecture.

### Subtlety F — Imported platforms are not side clutter
The platform launchpad and power mesh make imported platforms part of the product’s evidentiary and commercial depth.

---

## 22) Minimal “what is this project?” answer for future AI systems

If another AI needs a one-paragraph answer, use this:

> SkyeHands is a recovered-merged but current-truth-governed autonomous workspace platform built around a product-owned SkyeQuanta shell. The shell exposes canonical root operator commands, coordinates a bridge/runtime surface, an integrated Theia IDE substrate, and an integrated OpenHands agent substrate, and adds real workspace lifecycle control, governance, provider sovereignty, snapshots, proofs, replay/memory/council/cost/compliance lanes, deep scan mode, valuation audit mode, imported-platform launchpad/power mesh, and a concrete agent-core runtime bundle. The canonical implementation lane is `apps/skyequanta-shell`, while `dist/`, `workspace/`, and `.skyequanta/` contain generated/runtime material rather than primary source. This repo must be interpreted through its proof discipline: code alone does not equal completion unless the matching proof command and artifact are present and current.

---

## 23) Practical summary of the major canonical files

| Path | Why it matters |
|---|---|
| `README.md` | Root operator-facing entry summary |
| `START_HERE.sh` | One-command root operator bootstrap |
| `skyequanta.mjs` | Root command router into the shell |
| `package.json` | Root wrapper package and top-level scripts |
| `apps/skyequanta-shell/package.json` | Full shell command map and section/stage script inventory |
| `apps/skyequanta-shell/bin/launch.mjs` | Launches bridge + agent backend + IDE |
| `apps/skyequanta-shell/bin/bridge.mjs` | Owns bridge/runtime surface |
| `apps/skyequanta-shell/bin/doctor.mjs` | Deploy-readiness / machine-readable operator checks |
| `apps/skyequanta-shell/bin/remote-executor.mjs` | Detached executor for durable workspaces |
| `apps/skyequanta-shell/lib/workspace-manager.mjs` | Real workspace control-plane logic |
| `apps/skyequanta-shell/lib/skye-reader-bridge.mjs` | Reader-dossier integration used by deep scan/valuation |
| `apps/skye-reader-hardened/package.json` | Reader subsystem identity and capabilities |
| `platform/ide-core/package.json` | Theia monorepo substrate |
| `platform/ide-core/packages/ai-ide/package.json` | AI IDE extension package showing AI-oriented IDE integration |
| `platform/agent-core/AGENTS.md` | Agent-core / OpenHands structure and conventions |
| `platform/agent-core/runtime/package.json` | Concrete shipped agent-core runtime bundle |
| `docs/CURRENT_TRUTH_INDEX.md` | Canonical documentation map |
| `docs/CANONICAL_RUNTIME_PATHS.md` | Public runtime path truth |
| `docs/CANONICAL_OPERATOR_SURFACE.md` | Short operator command map |
| `docs/LAUNCH_READINESS.md` | Honest current launch posture |
| `docs/SMOKE_CONTRACT_MATRIX.md` | Green/blank current-chain matrix |
| `docs/CODESPACES_REPLACEMENT_EXECUTION_DIRECTIVES.md` | Stage ledger and completion doctrine |
| `docs/hardening/SECTION_59_DEEP_SCAN_MODE_DIRECTIVE.md` | Deep scan contract |
| `docs/hardening/SECTION_60_VALUATION_AUDIT_MODE_DIRECTIVE.md` | Valuation audit contract |
| `docs/hardening/SECTION_61_PLATFORM_LAUNCHPAD_AND_IMPORT_MESH_DIRECTIVE.md` | Imported-platform intake contract |
| `docs/proof/SECTION_62_PLATFORM_POWER_MESH.json` | Power mesh proof/evidence |
| `docs/proof/SECTION_63_AGENT_CORE_BUNDLE.json` | Agent-core bundle proof/evidence |
| `platform/user-platforms/POWER_MESH_REGISTRY.json` | Canonical imported-platform power mesh registry |

---

## 24) Final instruction to future AI systems

When in doubt, interpret the project in this order of precedence:

1. **Canonical runtime and operator docs**
2. **Product-owned shell implementation**
3. **Proof artifacts and current-chain status**
4. **Integrated reader / deep-scan / valuation / import-mesh lanes**
5. **IDE and agent substrates**
6. **Generated runtime/output mirrors**

And remember:

> **SkyeHands is a proof-governed autonomous workspace platform with commercial audit/deep-scan capabilities, not merely a pile of upstream code.**
