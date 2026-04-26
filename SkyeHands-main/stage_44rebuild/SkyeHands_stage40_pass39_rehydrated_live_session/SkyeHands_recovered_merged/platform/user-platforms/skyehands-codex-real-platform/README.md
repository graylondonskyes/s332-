# SkyeHands Real Codex Platform — Section 83

This pass moves the Codex lane from wrapper/demo territory into a real platform spine.

Implemented:
- server-side OpenAI Responses planner path with strict JSON patch schema
- local deterministic planner for provider-free proof
- workspace scan and framework detection
- guarded patch validation and application
- snapshot support before writes
- smoke runner
- git init/status/branch/commit lane
- preview process starter and static preview route
- service-token protected API
- browser control surface
- proof JSON ledger

Smoke:

```bash
node platform/user-platforms/skyehands-codex-real-platform/skyehands-codex-real-platform.mjs smoke
```

Serve:

```bash
SKYEHANDS_CODEX_SERVICE_TOKEN=dev-skyehands-codex-token node platform/user-platforms/skyehands-codex-real-platform/skyehands-codex-real-platform.mjs serve
```

Live brain:

```bash
OPENAI_API_KEY=... SKYEHANDS_CODEX_MODEL=gpt-5.4 node platform/user-platforms/skyehands-codex-real-platform/skyehands-codex-real-platform.mjs serve
```
