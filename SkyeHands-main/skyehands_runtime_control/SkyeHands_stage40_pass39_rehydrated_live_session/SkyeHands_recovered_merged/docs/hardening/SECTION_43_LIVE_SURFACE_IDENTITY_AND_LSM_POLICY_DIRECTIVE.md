# SECTION 43 · LIVE SURFACE IDENTITY AND LSM POLICY DIRECTIVE

Generated: 2026-04-07
Scope: major hardening continuation after Section 42

## Current implementation board

- ✅ Live surface identity route now serves a signed deployment-and-artifact identity document over HTTP and the verifier binds it back to the current sanitized release artifact.
- ✅ AppArmor profile bundle lane now writes per-workspace profiles, compiles them offline, and runtime strict mode fails closed when kernel enforcement cannot be guaranteed.
- ☐ AppArmor kernel-enforced launch proof on an AppArmor-enabled host
- ☑ Delegated-controller live kill-path proof now exists with v1/v2-aware current-host execution and controller-path termination
