# SkyeHands Codex Competitor

This is the Section 82 upgrade from wrapper shell to working coding-agent control plane.

It includes:

- workspace creation and repo scanning
- deterministic local coding agent that writes real files without provider vars
- guarded patch application
- terminal/smoke runner
- generated static preview route
- proof JSON output under `docs/proof/`
- browser UI with functional controls
- optional live-provider posture kept server-side only

Smoke:

```bash
node platform/user-platforms/skyehands-codex-competitor/skyehands-codex-competitor.mjs smoke
```

Serve:

```bash
SKYEHANDS_CODEX_SERVICE_TOKEN=dev-skyehands-codex-token node platform/user-platforms/skyehands-codex-competitor/skyehands-codex-competitor.mjs serve
```
