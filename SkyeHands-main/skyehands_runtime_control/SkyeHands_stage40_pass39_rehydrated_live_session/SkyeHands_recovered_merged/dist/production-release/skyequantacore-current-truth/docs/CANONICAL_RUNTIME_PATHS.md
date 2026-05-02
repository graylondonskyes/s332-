# CANONICAL_RUNTIME_PATHS

This file defines the single authoritative product truth path for SkyeQuantaCore.

## Canonical public operator CLI

- Command: `./skyequanta`
- Entry: `skyequanta.mjs`
- Shell wrapper: `./skyequanta`
- Purpose: this is now the single public command surface for launch, doctor, seal, support, bridge-only startup, and truth-path proof.

## Canonical one-command operator path

- Command: `./START_HERE.sh`
- Equivalent explicit command: `./skyequanta operator-green --json`
- Entrypoints: `START_HERE.sh` -> `skyequanta.mjs` -> `apps/skyequanta-shell/bin/operator-green.mjs`
- Purpose: prepares the machine, validates deploy readiness, seals the gate/runtime lane, and emits the packaged operator handoff.

## Canonical launcher

- Command: `./skyequanta start`
- Compatibility alias: `npm run start`
- Internal entry: `apps/skyequanta-shell/bin/launch.mjs`
- Purpose: starts the product-owned shell launcher and the public product surface.

## Canonical bridge/runtime surface

- Command: `./skyequanta bridge:start`
- Compatibility alias: `npm run bridge:start`
- Internal entry: `apps/skyequanta-shell/bin/bridge.mjs`
- Library: `apps/skyequanta-shell/lib/bridge.mjs`
- Purpose: owns the public runtime contract, product identity endpoint, status endpoint, workspace routes, and control-plane surface.

## Canonical executor lane

- Command: `node apps/skyequanta-shell/bin/remote-executor.mjs`
- Entry: `apps/skyequanta-shell/bin/remote-executor.mjs`
- Purpose: authoritative detached executor service for durable workspace runtime orchestration.

## Canonical workspace manager

- Entry: `apps/skyequanta-shell/lib/workspace-manager.mjs`
- Purpose: authoritative registry, selection, lifecycle, snapshot, and route ownership for workspaces.

## Canonical truth-path proof runner

- Command: `./skyequanta proof:truthpath --strict`
- Compatibility alias: `npm run workspace:proof:section3`
- Entry: `apps/skyequanta-shell/bin/workspace-proof-section3-truthpath.mjs`
- Purpose: proves the wrapper convergence, user-facing command surface, and legacy-entrypoint quarantine.

## Canonical deploy runner

- Command: `./skyequanta doctor --mode deploy --probe-active --json`
- Compatibility alias: `npm run doctor`
- Internal entry: `apps/skyequanta-shell/bin/doctor.mjs`
- Purpose: authoritative machine-readable deploy-readiness command.

## Quarantined non-canonical paths

The following entrypoints are retained only for internal runtime composition and proof lanes. They are not public launcher surfaces and must not be started directly without an explicit override:

- `apps/skyequanta-shell/bin/workspace-service.mjs`
- `apps/skyequanta-shell/bin/real-ide-runtime.mjs`
- `apps/skyequanta-shell/bin/workspace-proof.mjs`

These paths now hard-fail when launched directly unless one of the following is set:

- `SKYEQUANTA_INTERNAL_RUNTIME_INVOCATION=1` for product-owned internal process spawning
- `SKYEQUANTA_ALLOW_LEGACY_RUNTIME=1` for explicit legacy proof/debug work

## Public operator-surface rule

For user-facing documentation, onboarding, deploy guides, and operator handoff, present only:

- `./START_HERE.sh`
- `./skyequanta operator-green --json`
- `./skyequanta start`
- `./skyequanta doctor --mode deploy --probe-active --json`
- `./skyequanta runtime-seal --strict --json`
- `./skyequanta support-dump --json`

Raw internal bin paths are implementation detail only.

## Default runtime driver

- Default workspace runtime driver: `remote-executor`
- Reason: this is the authoritative detached workspace runtime for durable multi-workspace operation.

## Canonical preview operator path

- Workspace-scoped routed preview is the canonical operator path: `/w/:workspaceId/p/:port`
- Current-workspace preview alias remains available for convenience only: `/p/:port`
- Preview routing contract endpoint: `/api/workspaces/:workspaceId/preview-contract`
- Agent-generated app preview contract route: `/.well-known/preview-contract.json`


## Canonical universal completion proof

Use `./skyequanta proof:universal --strict` to prove the fully converged Codespaces-replacement completion surface from the product-owned operator path.
