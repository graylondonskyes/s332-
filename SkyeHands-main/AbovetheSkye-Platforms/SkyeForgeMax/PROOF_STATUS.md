# SkyeForgeMax Proof Status

## Conservative Status

`partial`

## Runnable Surface

This folder contains a real static command shell, a self-contained local runtime server, and real runtime-state artifacts:

- `index.html`
- `assets/forge.js`
- `runtime/local-runtime.mjs`
- `runtime/store.json`
- `runtime/artifacts/*`

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

Optional local runtime server:

```bash
node runtime/local-runtime.mjs
```

## What The Proof Verifies

- the static shell exists and is wired to the documented `/v1/state` and `/v1/e2e/run` endpoints
- the shell can also fall back to `runtime/store.json` when `/v1/state` is absent, using only files in this folder
- the browser runtime script parses successfully
- a self-contained local runtime in this folder serves the shell, `/health`, `/v1/state`, `/v1/local-proof/latest`, and `/v1/proof-runs`
- the self-contained local `/v1/e2e/run` endpoint writes a local proof artifact and audit event
- the local runtime store contains workspace, provider-binding, quality, valuation, and audit state
- representative runtime artifacts exist on disk

## What Is Still Not Proven Here

- deployed runtime behavior
- live provider credentials
- remote integration success

This folder now has a real local API lane inside the folder, and the proof exercises it directly. It still does not certify deployed execution or live provider-backed integrations.
