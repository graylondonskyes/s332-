# Repo Live Proof Status

Last verified: `2026-05-01`

Current status: `passing`

## Runnable Surface

This folder is a static browser tool surface, not a server-backed platform. It exposes:

- ZIP and folder intake
- a browser-side prepare/run/report shell
- local command preset persistence
- local run report history persistence
- an inline module boot path
- the COOP/COEP headers the runtime expects

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

## What The Proof Actually Verifies

- the browser UI exposes the file intake and run/report controls
- the inline boot script is present
- the local runtime helper persists command presets and run-report history
- the Netlify headers needed for the intended browser runtime are present
- a browser smoke renders the saved preset selector and local report-history surface in a live page
- the local `brand-logo.svg` asset loads without failed requests during smoke
- the smoke surface completes without page errors or failed network requests

## What Is Still Not Proven Here

- live WebContainer startup in a browser
- real package install or command execution

This is a real static tool surface, but its heavier runtime behavior still needs a browser-session proof to claim end-to-end execution.
