# Section 84 — SkyeHands Platform Core Directive

☑ Local persistent platform-core store implemented.
☑ Org creation implemented.
☑ Password-hashed user creation implemented.
☑ Session login implemented.
☑ RBAC permission checks implemented.
☑ Project records implemented.
☑ Task records implemented.
☑ Approval gate implemented.
☑ Unauthorized approval denial implemented.
☑ Usage/cost record implemented.
☑ Tamper-evident audit event hashing implemented.
☑ Evidence export implemented.
☑ Proof ledger output implemented.

## Required proof

☑ `node platform/user-platforms/skyehands-codex-real-platform/skyehands-platform-core.mjs smoke`
☑ `docs/proof/SKYEHANDS_PLATFORM_CORE_PROOF.json`

## Honest boundary

This closes the most embarrassing platform gap: the Codex lane now has a real platform-core spine for org/user/session/RBAC/project/task/approval/usage/audit/evidence state. Production still needs Postgres/Neon adapter wiring, external OAuth, billing provider webhooks, and container-grade isolation.
