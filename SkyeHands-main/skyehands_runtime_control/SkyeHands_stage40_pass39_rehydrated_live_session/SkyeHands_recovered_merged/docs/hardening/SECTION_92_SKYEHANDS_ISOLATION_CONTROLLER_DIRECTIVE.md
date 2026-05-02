# Section 92 — SkyeHands Isolation Controller Directive

☑ Rootless runtime detection implemented.
☑ Container execution plan implemented.
☑ Network-none policy implemented.
☑ Memory limit policy implemented.
☑ CPU limit policy implemented.
☑ Read-only rootfs policy implemented.
☑ Tmpfs policy implemented.
☑ Workspace mount policy implemented.
☑ Live container run gate implemented.
☑ Proof output implemented.

## Required proof

☑ `node platform/user-platforms/skyehands-codex-real-platform/skyehands-isolation-controller.mjs smoke`
☑ `docs/proof/SKYEHANDS_ISOLATION_CONTROLLER_PROOF.json`

## Honest boundary

This is the isolation-controller lane. Live enforcement depends on podman/docker/rootless runtime availability on the host and requires `SKYEHANDS_ALLOW_CONTAINER_RUN=1` for actual execution.
