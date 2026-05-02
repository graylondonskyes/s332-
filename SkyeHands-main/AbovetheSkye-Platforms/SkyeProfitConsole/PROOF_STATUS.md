# Proof Status

- Status: `partial`
- Surface type: `redirect alias`
- Proof command: `node smoke/smoke-proof.mjs`

## What this folder proves

- The folder contains a local redirect page that forwards to `Skye Profit Console/index.html`.
- The redirect copy now states more plainly that this folder is an alias surface only.
- The redirect now points at a main shell that contains the worksheet, ledger lane, and in-folder local runtime subset.
- The alias now also carries explicit noindex and noscript markers so it behaves more honestly as a redirect-only preservation surface.

## What this folder does not prove yet

- This folder is not its own app.
- It does not contain the real profit-console runtime.
- It only preserves an alternate folder name and forwards the browser to the main shell.

## Current certification call

This is a real runnable alias page, but it is only a redirect surface.
