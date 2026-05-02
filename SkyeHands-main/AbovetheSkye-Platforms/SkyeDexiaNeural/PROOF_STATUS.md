# Proof Status

- Status: `partial`
- Surface type: `real browser UI with remote-worker dependency`
- Proof command: `node smoke/smoke-proof.mjs`

## What this folder proves

- The folder contains two runnable local HTML editions and a release manifest:
  - `index.html`
  - `neural-space-pro.html`
  - `RELEASE_MANIFEST.json`
- `index.html` contains a local browser interface with a worker URL/settings model, health/status/build route references, canvas rendering, and Three.js-based 3D mode.
- `index.html` contains a local browser interface with a worker URL/settings model, health/status/build/project/artifact route references, canvas rendering, and Three.js-based 3D mode.
- Worker secret handling is session-scoped instead of persistent browser storage.
- `runtime/local-runtime.mjs` can serve the UI and the local proof worker contract from this folder on one origin, including project and artifact inspection lanes.
- The release manifest documents the worker contract and edition split with a conservative `partial` status.

## What this folder does not prove yet

- This lane does not prove the remote worker is live or healthy right now.
- This lane does not prove the CDN-hosted Three.js script loads in a live browser session.
- This lane does not prove a live provider-backed website build outside the local proof harness.

## Current certification call

This is a real local UI surface with a self-contained proof runtime lane, but it still depends on live worker availability, browser execution, and real providers for full production proof.
