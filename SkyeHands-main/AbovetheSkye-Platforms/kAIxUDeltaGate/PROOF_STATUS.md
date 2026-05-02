# Proof Status

- Status: `partial`
- Surface type: `gateway directive shell plus self-contained local proof API`
- Proof command: `node smoke/smoke-proof.mjs`

## What this folder proves

- `index.html` is a runnable static page with embedded directive content and a live tester UI.
- The directive PDF is present beside the page.
- The local page points at a real external gateway URL and includes health/models/generate examples.
- The page now includes an explicit local proof boundary that separates the shell from remote gateway behavior.
- The local page now includes a fully local request-planning lane that validates the base URL, assembles the request contract, and generates curl guidance without calling the remote worker.
- `runtime/local-runtime.mjs` serves a same-origin proof API for `/v1/health`, `/v1/models`, `/v1/generate`, `/v1/stream`, and recorded local request history.

## What this folder does not prove yet

- This lane does not prove the remote gateway is healthy right now.
- This lane does not prove provider-backed generation or streaming from the external worker.
- This folder is not the production gateway implementation itself; it is the directive/test surface plus a deterministic local proof API around it.

## Current certification call

This is a real static command surface with an honest local planning lane, but remote gateway behavior remains out of scope for this local proof.
