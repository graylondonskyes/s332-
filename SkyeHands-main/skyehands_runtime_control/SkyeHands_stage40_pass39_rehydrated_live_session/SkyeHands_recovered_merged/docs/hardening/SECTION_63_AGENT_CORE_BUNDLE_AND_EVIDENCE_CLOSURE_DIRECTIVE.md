# Section 63 — Agent Core Bundle and Evidence Closure

Goal: make the shipped agent-core story concrete enough for diligence instead of leaving it at config, locks, and packaging surfaces.

Implemented code lanes:
- `platform/agent-core/runtime/package.json`
- `platform/agent-core/runtime/lib/server.mjs`
- `platform/agent-core/runtime/bin/agent-core-launch.mjs`
- `platform/agent-core/runtime/bin/agent-core-smoke.mjs`
- `apps/skyequanta-shell/bin/workspace-proof-section63-agent-core-bundle.mjs`
- `scripts/smoke-section63-agent-core-bundle.sh`

Evidence standard:
- the runtime must boot
- `/health` must answer
- `/manifest` must answer
- proof must be written to `docs/proof/SECTION_63_AGENT_CORE_BUNDLE.json`
