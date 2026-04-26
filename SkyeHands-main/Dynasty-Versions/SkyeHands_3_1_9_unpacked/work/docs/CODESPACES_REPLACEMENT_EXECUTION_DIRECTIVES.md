# Codespaces Replacement Execution Directives

## Non-negotiable completion protocol

An item may be marked with a green check mark only after all of the following are true:

1. The code change is already committed into the repo tree.
2. The proof command for that item has been run successfully.
3. A proof artifact exists under `docs/proof/`.
4. The exact proof artifact path is written under the item.
5. The item is still true after a fresh runtime start.

If any of the above is missing, the item stays open. No hand waving. No "basically done." No implied completion.

## Current execution model

This repo now has two explicit truths:

- The original stub path is still identifiable as `workspace-service-stub`.
- The stage-2 executor path is now a real local executor foundation, not the old stub.
- Proof commands are explicit and must be rerun after each stage.

## Stage ledger

### Stage 1 — Truth and proof instrumentation

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/lib/workspace-runtime.mjs`
  - Runtime state records an explicit driver and capability truth instead of vague labels.
- ✅ `apps/skyequanta-shell/bin/workspace-service.mjs`
  - Stub services self-identify as stub services and expose `/capabilities`.
- ✅ `apps/skyequanta-shell/bin/workspace-proof.mjs`
  - Added a proof runner that starts a workspace, probes health/capabilities, and writes a proof artifact.
- ✅ `apps/skyequanta-shell/package.json`
  - Added stage-friendly scripts: `workspace`, `workspace:proof`, `bridge`, `ide`.

Proof command:
- `npm run workspace:proof`

Proof artifact:
- `docs/proof/STAGE_1_TRUTH_AND_PROOF.json`

Completion gate used:
- Driver is explicit.
- Stub mode is explicit.
- Proof file exists.
- Proof assertions pass.

### Stage 2 — Replace the fake workspace executor with a real local executor foundation

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/lib/workspace-runtime.mjs`
  - Replaced the failing stage-2 launch plan with a real local executor foundation that boots a workspace-bound IDE surface and a workspace-bound FastAPI agent surface.
  - Added dependency-lane reporting directly into runtime state so the repo can report what is foundation-complete versus what is still upstream-parity work.
- ✅ `apps/skyequanta-shell/bin/real-ide-runtime.mjs`
  - Added a real local IDE surface with live file listing, file read, file write, and a browser editor UI bound to the workspace filesystem.
- ✅ `apps/skyequanta-shell/python/skyequanta_app_server.py`
  - Added a fallback-capable real FastAPI runtime that boots even when full OpenHands imports are unavailable.
  - The runtime now exposes `/health`, `/docs`, `/capabilities`, `/api/workspace/summary`, `/api/files`, and `/api/file` against the workspace root.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage2.mjs`
  - Stage-2 proof now passes against the real local executor foundation.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `stage2:deps` and preserved `workspace:proof:stage2`.

Proof command:
- `npm run workspace:proof:stage2 -- --strict`

Proof artifact:
- `docs/proof/STAGE_2_REAL_LOCAL_EXECUTOR.json`

Completion gate used:
- The workspace IDE root is no longer the stub HTML placeholder.
- The workspace agent now boots as a real FastAPI runtime with `/docs` and `/health`.
- The proof artifact exists.
- The proof shows `realIdeRuntime: true` and `realAgentRuntime: true`.

Green-check note:
- This check mark applies to the **real local executor foundation** only.
- It does **not** claim full upstream Theia parity or full upstream OpenHands parity.
- That upstream parity work is now tracked in Stage 2B and remains open until separately proven.

### Stage 2B — Upstream dependency parity for full Theia + full OpenHands

Status: ✅ COMPLETE

Required directives:
- ✅ Install and prove a full upstream Theia runtime path that replaces the stage-2 IDE foundation surface.
- ✅ Install and prove a full upstream OpenHands app-server path that replaces the stage-2 FastAPI foundation fallback.
- ✅ Add a dependency-lane proof artifact that records exact install commands, exact installed versions, and exact runtime boot commands.
- ✅ Upgrade the runtime state so `fullTheiaRuntime` and `fullOpenHandsRuntime` are reported from real checks instead of being implied.

Proof commands:
- `npm run stage2b:deps`
- `npm run workspace:proof:stage2b -- --strict`

Required proof artifacts:
- `docs/proof/STAGE_2_DEPENDENCY_LANES.json`
- `docs/proof/STAGE_2B_UPSTREAM_PARITY.json`

Completion gate:
- The IDE runtime is the upstream Theia runtime, not the foundation IDE surface.
- The agent runtime is the upstream OpenHands-backed runtime, not the fallback foundation mode.
- Both runtimes survive a fresh stop/start.
- The proof files exist and pass.

Current truth:
- The repo now boots the Stage 2B isolated upstream lanes through the generated Theia browser runtime scaffold and the OpenHands-backed app-server lane.
- `docs/proof/STAGE_2_DEPENDENCY_LANES.json` now reports both lanes true.
- `docs/proof/STAGE_2B_UPSTREAM_PARITY.json` now passes under `--strict` after a fresh stop/start cycle.

### Stage 3 — Repo/dev environment provisioning

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/lib/workspace-runtime.mjs`
  - Workspaces are now provisioned from repo state instead of starting as marker-only sandbox folders.
  - The workspace filesystem now receives a curated repo manifest including the repo root files, shell app, scripts, config, branding, docs, and `.devcontainer` contract.
  - Workspace-level environment values are persisted cleanly under `workspace/instances/<id>/config/workspace-env.json`.
  - Workspace-level provisioning state is persisted under `workspace/instances/<id>/config/repo-provisioning.json` and mirrored into `.skyequanta-provisioning.json` inside the workspace filesystem.
- ✅ `apps/skyequanta-shell/bin/config.mjs`
  - Added an explicit workspace provisioning manifest and repo dev-environment contract paths.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage3.mjs`
  - Added a proof runner that provisions a repo-backed workspace, writes a persistence file, restarts the runtime, and confirms the workspace reopens with repo files and persisted content intact.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `workspace:proof:stage3`.

Proof command:
- `npm run workspace:proof:stage3 -- --strict`

Proof artifact:
- `docs/proof/STAGE_3_REPO_PROVISIONING.json`

Completion gate used:
- Proof artifact exists under `docs/proof/STAGE_3_REPO_PROVISIONING.json`.
- A created workspace shows real repo files instead of only marker files.
- `.devcontainer/devcontainer.json` is present inside the provisioned workspace.
- Workspace env values persist cleanly via `workspace-env.json`.
- A written file survives a stop/start reopen cycle.


### Stage 4 — Remote executor platform

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/lib/workspace-runtime.mjs`
  - Added a real `remote-executor` driver that provisions workspaces through a detached executor daemon instead of directly under the controlling shell process.
  - Runtime state now reports `remoteExecutor: true`, `equivalentIsolation: true`, durable volume paths, and executor metadata.
- ✅ `apps/skyequanta-shell/bin/remote-executor.mjs`
  - Added a detached remote executor daemon with start, stop, health, and workspace-runtime state endpoints.
  - Workspace IDE and agent processes are now launched by the remote executor daemon and tracked outside the proof shell process.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage4.mjs`
  - Added a strict proof runner that boots a remote-executor workspace, writes persisted content into the durable volume, restarts the workspace, and proves the file survives a full stop/start cycle.
- ✅ `apps/skyequanta-shell/bin/config.mjs`
  - Added explicit remote executor state paths, volume roots, retention roots, and remote executor port configuration.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `workspace:proof:stage4`.

Proof command:
- `npm run workspace:proof:stage4 -- --strict`

Proof artifact:
- `docs/proof/STAGE_4_REMOTE_EXECUTOR.json`

Completion gate used:
- Proof artifact exists under `docs/proof/STAGE_4_REMOTE_EXECUTOR.json`.
- Runtime state reports `remoteExecutor: true`.
- Runtime state reports equivalent real isolation through the detached remote executor daemon.
- Workspace content persists under the durable volume directory across stop/start.

## Rule for future edits

When a later stage is completed, update only these three things in the same pass:

1. The code.
2. The proof artifact.
3. This ledger, replacing the open box with a green check mark only after the proof exists.


### Stage 5 — Lifecycle policy, machine profiles, and secret injection

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/lib/workspace-runtime.mjs`
  - Added lifecycle policy materialization for each workspace, including idle timeout, max runtime age, retention window, and persisted machine profile.
  - Added injectable secret bundle materialization gated by an explicit allowlist and persisted under a dedicated workspace secrets directory.
  - Added prebuild manifest generation keyed from the repo devcontainer contract and machine profile.
- ✅ `apps/skyequanta-shell/bin/remote-executor.mjs`
  - Remote executor runtime records lifecycle, secrets, and prebuild metadata for each launched workspace.
  - Added executor maintenance pruning for expired workspaces.
- ✅ `apps/skyequanta-shell/bin/config.mjs`
  - Added lifecycle defaults, machine profile catalog, secret allowlist handling, and dedicated secrets/prebuild root paths.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage5.mjs`
  - Added a strict proof runner that provisions a remote workspace with a large machine profile, injects allowed secrets, verifies prebuild metadata, restarts the workspace, and proves all lifecycle artifacts survive restart.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `workspace:proof:stage5`.

Proof command:
- `npm run workspace:proof:stage5 -- --strict`

Proof artifact:
- `docs/proof/STAGE_5_LIFECYCLE_AND_SECRETS.json`

Completion gate used:
- Lifecycle policy file exists and survives restart.
- Secret manifest and secret env bundle exist and survive restart.
- Machine profile persists as a real runtime property, not a comment.
- Prebuild manifest contains a stable key derived from the repo contract and survives restart.
- Remote executor state records lifecycle, secret, and prebuild metadata for the running workspace.



### Stage 6 — Admin control plane and tenant governance surface

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/lib/runtime.mjs`
  - Fixed runtime-state initialization so the governance policy file is created once and no longer overwritten on fresh bridge/runtime starts.
- ✅ `apps/skyequanta-shell/lib/bridge.mjs`
  - Added a writable governance policy endpoint for admin control-plane operations.
  - Added a machine-profile/catalog endpoint for control-plane inspection.
  - Added a tenant summary endpoint that reports per-tenant workspace and session counts.
- ✅ `apps/skyequanta-shell/lib/governance-manager.mjs`
  - Added tenant summary aggregation logic used by the control plane.
- ✅ `apps/skyequanta-shell/bin/config.mjs`
  - Added a control-plane catalog export so the bridge can expose lifecycle defaults, machine profiles, routes, and remote-executor metadata from one source of truth.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage6.mjs`
  - Added a strict proof runner that starts the bridge, updates governance policy, reads catalog + tenant summary, restarts the bridge, and proves the admin plane still reports the updated state.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `workspace:proof:stage6`.

Proof command:
- `npm run workspace:proof:stage6 -- --strict`

Proof artifact:
- `docs/proof/STAGE_6_ADMIN_CONTROL_PLANE.json`

Completion gate used:
- Governance policy is writable through the admin plane and survives a fresh bridge restart.
- Control-plane catalog exposes machine profiles, lifecycle defaults, and control-plane routes.
- Tenant summary reports real per-tenant workspace counts.
- Proof artifact exists and passes.


### Stage 7 — Full smoke matrix and release gate

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage7.mjs`
  - Added a consolidated smoke runner that executes the proven stage commands in order: Stage 1, Stage 2, Stage 2B dependency lanes, Stage 2B upstream parity, Stage 3, Stage 4, Stage 5, and Stage 6.
  - The smoke runner now validates that each command exits cleanly and that each stage proof artifact still reports a true completion state.
  - The smoke runner writes a single aggregate proof artifact so release claims can be checked from one file.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `workspace:proof:stage7` and `smoke:all`.

Proof command:
- `npm run workspace:proof:stage7 -- --strict`

Proof artifact:
- `docs/proof/STAGE_7_SMOKE_MATRIX.json`

Completion gate used:
- Every stage smoke command exits with status 0.
- `docs/proof/STAGE_2_DEPENDENCY_LANES.json` still reports `fullTheiaRuntime: true` and `fullOpenHandsRuntime: true`.
- Every referenced proof artifact still reports a true completion state.
- The aggregate smoke proof exists and passes.


### Stage 8 — Preview forwarding and routed port contract

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/lib/bridge.mjs`
  - Bridge startup no longer hijacks the current workspace selection by force-resetting it back to the default workspace.
  - Added forwarded preview URL metadata for each allowed port, including both the workspace-scoped route and the current-workspace public route.
  - Added preview URL metadata to `/api/status`, `/api/workspaces`, and `/api/workspaces/:id/ports` so the current bridge contract exposes real preview paths instead of requiring guesswork.
- ✅ `apps/skyequanta-shell/bin/workspace-preview-fixture.mjs`
  - Added a reusable preview fixture server for smoke validation of forwarded HTTP routes.
  - The fixture exposes `/health`, `/marker`, and HTML preview content bound to the workspace filesystem.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage8.mjs`
  - Added a strict proof runner that reruns the full Stage 7 smoke matrix, provisions a preview fixture inside the current workspace, proves the forwarded route is forbidden before allow-port, proves the preview opens after allow-port, proves preview URL metadata is exposed by the bridge, proves the route survives a fresh bridge restart, and proves deny-port closes the route again.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `workspace:proof:stage8`.

Proof command:
- `npm run workspace:proof:stage8 -- --strict`

Proof artifact:
- `docs/proof/STAGE_8_PREVIEW_FORWARDING.json`

Completion gate used:
- Stage 7 smoke reruns cleanly before Stage 8 assertions begin.
- Forwarded preview route is forbidden before allow-port is granted.
- Forwarded preview route opens after allow-port and serves the workspace fixture content.
- Bridge status and workspace port endpoints expose concrete preview URL metadata.
- Forwarded preview route survives a fresh bridge restart.
- Deny-port closes the preview route again.


### Stage 9 — Deployment-readiness doctor and public product identity contract

Status: ✅ COMPLETE

Completed directives:
- ✅ `apps/skyequanta-shell/bin/config.mjs`
  - Added a product identity export with branded component names, route templates, and a public identity URL in the runtime contract.
- ✅ `apps/skyequanta-shell/lib/runtime.mjs`
  - Runtime bootstrap now materializes remote-executor state, workspace runtime roots, and repairs executable bits for shipped runtime tools when archives strip permissions.
- ✅ `apps/skyequanta-shell/lib/bridge.mjs`
  - Added a public `/api/product/identity` endpoint and surfaced that route in both status and control-plane catalog metadata.
- ✅ `apps/skyequanta-shell/bin/doctor.mjs`
  - Added deploy-mode readiness checks, active bridge probing, and JSON output.
- ✅ `scripts/smoke-workspace-lifecycle.sh`
  - Added an end-to-end workspace lifecycle smoke script covering create, start, runtime read, stop, and cleanup through the bridge admin contract.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-stage9.mjs`
  - Added a strict proof runner that reruns Stage 8, boots the bridge, executes deploy-mode doctor probes, executes the Node lifecycle smoke verifier, and writes the deployment-readiness proof artifact.
- ✅ `apps/skyequanta-shell/package.json`
  - Added `workspace:proof:stage9`.

Proof command:
- `npm run workspace:proof:stage9 -- --strict`

Proof artifact:
- `docs/proof/STAGE_9_DEPLOYMENT_READINESS.json`

Completion gate used:
- Stage 8 proof reruns cleanly before Stage 9 assertions begin.
- Deploy-mode doctor passes and includes active bridge probe checks.
- `/api/product/identity` exposes branded component names and route templates.
- Control-plane catalog and status endpoints expose the product identity route metadata.
- Workspace lifecycle smoke passes through create/start/runtime/stop/cleanup.


### Stage 29–34 — Sovereign provider bindings and user-owned infrastructure lane

Status: 🟡 IN PROGRESS / PROOF-BACKED FOUNDATION LANDED

Completed directives proven in repo:
- ✅ `apps/skyequanta-shell/lib/provider-vault.mjs`
  - Added encrypted provider-vault storage with ciphertext-at-rest posture and safe metadata-only list/detail surfaces.
- ✅ `apps/skyequanta-shell/lib/session-manager.mjs`
  - Added session-scoped provider unlock / relock with no unlock-secret persistence.
- ✅ `apps/skyequanta-shell/lib/provider-bindings.mjs`
  - Added per-workspace binding roles, allowed actions, and required capability enforcement.
- ✅ `apps/skyequanta-shell/lib/provider-connectors.mjs`
  - Added provider catalog, connection-plan diagnostics, and action-specific execution planning for Neon, Cloudflare, Netlify, GitHub, and env bundles.
- ✅ `apps/skyequanta-shell/lib/provider-env-projection.mjs`
  - Added minimum-variable runtime projection with fail-closed `requires_unlock` / `binding_missing` posture.
- ✅ `apps/skyequanta-shell/lib/provider-redaction.mjs`
  - Added provider payload redaction across runtime/support/export lanes.
- ✅ `apps/skyequanta-shell/lib/provider-ui.mjs` and `apps/skyequanta-shell/lib/bridge.mjs`
  - Added real in-product Provider / Storage / Deployment centers plus canonical provider APIs.
- ✅ `apps/skyequanta-shell/bin/workspace-proof-section29-provider-vault.mjs` through `workspace-proof-section35-provider-discovery-bootstrap.mjs`
  - Added proof runners for sections 29 through 35, including provider discovery and bootstrap coverage.

Proof commands currently passing:
- `npm run workspace:proof:section29 -- --strict`
- `npm run workspace:proof:section30 -- --strict`
- `npm run workspace:proof:section31 -- --strict`
- `npm run workspace:proof:section32 -- --strict`
- `npm run workspace:proof:section33 -- --strict`
- `npm run workspace:proof:section34 -- --strict`
- `npm run workspace:proof:section35 -- --strict`

Smoke commands currently passing:
- `npm run smoke:section29`
- `npm run smoke:section30`
- `npm run smoke:section31`
- `npm run smoke:section32`
- `npm run smoke:section33`
- `npm run smoke:section34`
- `npm run smoke:section35`

Open truth:
- Live outbound provider verification against real third-party accounts is not yet smoke-backed in this repo.
- Runtime-seal intentional leak-fixture fail/pass proof is now closed and smoke-backed.
- Provider discovery and workspace bootstrap are now smoke-backed across product, API, and CLI surfaces.


## Sovereign provider continuation

- Founder-only governance secrets now surface as an explicit separate lane and never silently mix into user-owned provider runtime execution.
- Legacy governance-secret scopes can now be inspected as migration candidates and explicitly re-saved into the encrypted provider vault.

## Section 36 — Bridge/runtime closure

☑ Archive-stripped runtime dependency rehydration now runs from `apps/skyequanta-shell/lib/runtime.mjs`
☑ Legacy remote-executor runtime tables now normalize into `workspaces{}` via `apps/skyequanta-shell/bin/remote-executor.mjs`
☑ `operator:start` now requires runtime closure and Section 26 now proves the workspace is truly running
☑ Closure proof: `docs/proof/SECTION_36_BRIDGE_RUNTIME_CLOSURE.json`

