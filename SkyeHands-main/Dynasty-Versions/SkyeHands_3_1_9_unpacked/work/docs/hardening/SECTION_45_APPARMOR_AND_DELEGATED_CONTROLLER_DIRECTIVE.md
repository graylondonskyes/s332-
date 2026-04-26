# SECTION 45 · APPARMOR AND DELEGATED CONTROLLER DIRECTIVE

Generated: 2026-04-07
Scope: hardening continuation after Section 44

## Current implementation board

- ✅ AppArmor launch-proof lane now performs real profile-load / aa-exec capability gating and fails closed with an explicit kernel-capability reason when live enforcement is unavailable.
- ✅ AppArmor live-proof transport pack now emits a self-verifying host bundle with hashed policy artifacts, standalone verifier, and runnable execution script at `dist/section45/apparmor-live-proof-pack/`.
- ✅ AppArmor host-proof intake and attestation lane now imports a manifest-bound host execution report, verifies it against the pack expectations, signs an attestation, denies tampered reports, and renders a trust surface at `dist/section45/apparmor-live-proof-ingest/`.
- ✅ Delegated-controller planner now resolves v1/v2-aware delegated controller paths and emits concrete quota / attachment commands for cpu, memory, and pids controllers.
- ✅ Delegated-controller live kill-path lane now attaches a real child workload into the delegated group, verifies kernel membership, terminates that group through the delegated controller path, and cleans the delegated controller directories back down.
- ☐ AppArmor kernel-enforced launch proof on an AppArmor-enabled host.
