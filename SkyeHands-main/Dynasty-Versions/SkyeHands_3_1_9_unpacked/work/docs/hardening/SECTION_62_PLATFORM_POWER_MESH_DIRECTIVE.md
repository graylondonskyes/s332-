# Section 62 — Platform Power Mesh Directive

Goal: convert imported platforms into deeper searchable and launchable capability graphs, not just parked source trees.

Implemented code lanes:
- `apps/skyequanta-shell/lib/platform-power-mesh.mjs`
- `apps/skyequanta-shell/bin/platform-power-mesh.mjs`
- `apps/skyequanta-shell/bin/platform-power-query.mjs`
- `apps/skyequanta-shell/bin/workspace-proof-section62-platform-power-mesh.mjs`
- `scripts/smoke-section62-platform-power-mesh.sh`

Evidence standard:
- must write `platform/user-platforms/<slug>/skyehands.power.json`
- must update `platform/user-platforms/POWER_MESH_REGISTRY.json`
- must update `.skyequanta/platform-launchpad/power-mesh-registry.json`
- must prove a nested imported capsule launches live from the mesh

Directive expansion:
- must deepen beyond searchable / launchable graphs into inherited-capability graphs
- must be able to express which SkyeQuanta powers an imported platform inherits, which are denied, and which still need adapters
- must support super-app uplift paths for imported platforms, not only parked discovery metadata
- should become the power-routing truth surface for AE Flow visual analytics inheritance, replay linkage, and export intelligence once those lanes are implemented

- should expose inherited client-facing AI identity as kAIxU for AE Flow and imported-platform assistant surfaces while keeping provider/model routing abstracted underneath
