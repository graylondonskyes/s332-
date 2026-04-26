# SkyeHands Codex Control Plane

Additive three-lane Codex wrapper for SkyeHands.

## Lanes

1. `sdk-wrapper` — server-side Codex task intake, repo scan, bounded patch plan, and live CLI adapter boundary.
2. `app-server-bridge` — session bridge with JSON-RPC-shaped proof events and live app-server command boundary.
3. `ci-github-automation` — GitHub Actions workflow renderer, PR proof contract, and proof artifact policy.

## Smoke

```bash
node platform/user-platforms/skyehands-codex-control-plane/skyehands-codex-control-plane.mjs smoke
```

## Serve

```bash
SKYEHANDS_CODEX_SERVICE_TOKEN=dev-skyehands-codex-token node platform/user-platforms/skyehands-codex-control-plane/skyehands-codex-control-plane.mjs serve
```

Live execution is intentionally gated behind server-side configuration. Proof mode never claims a live Codex call.
