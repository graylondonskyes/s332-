# Runtime Role Identity

`skyehands_runtime_control` is the product-facing name for this runtime wrapper. The legacy `stage_44rebuild` path now exists only as a compatibility symlink for older artifacts and references.

For current SkyeHands work, treat the layers like this:

- `skyehands_runtime_control/`
  - Role: recovery wrapper and runtime control root
  - Purpose: stable repo-root operator surface, package scripts, bootstrap, recovery artifacts
- `stage_44rebuild/`
  - Role: compatibility alias only
  - Purpose: keeps older proofs, notes, and path-bound references from breaking during transition
- `SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/`
  - Role: canonical recovered application tree
  - Purpose: houses the product runtime and imported platform cores
- `apps/skyequanta-shell/`
  - Role: SkyeHands Runtime Control Shell
  - Purpose: the real authoritative launcher, bridge, session, workspace, and Theia/OpenHands convergence layer

For gate integration, wire `SkyeGateFS13` into the shell layer first. The wrapper exists to expose the shell safely, not to replace it.

Useful local verification:
- `npm run gate:verify`
- `RUNTIME_RENAME_LANDING_STATE.md`
