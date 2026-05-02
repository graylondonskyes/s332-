# AE-FlowPro Proof Status

Status: `local-runtime-ready`

Runtime shape:
- real static browser PWA
- local device persistence via `localStorage`
- offline service worker present
- client-side export, share, and encrypted backup flows present
- same-folder Node runtime lane at `runtime/local-runtime.mjs`
- runtime-backed recovery journal and backup snapshot lane under `runtime/data/`

Local proof:
- `node smoke/smoke-proof.mjs`

What this proof covers:
- required static files exist
- the main app shell exposes the recovery journal and same-folder runtime controls
- the browser script probes the same-origin runtime, records recovery events, and can push runtime snapshots
- the local runtime serves the app shell and exposes `/api/runtime/status`, `/api/runtime/journal`, and `/api/runtime/snapshots`
- the smoke proof writes a real journal row and a real backup snapshot artifact through the runtime lane

What this proof does not claim:
- no server-backed sync or team collaboration proof
- no live deployment proof
- no first-load offline proof for the remote Three.js background dependency
