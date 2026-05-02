# LocalSeoSnapshot Proof Status

## Runnable Surface

This folder contains a real browser tool surface:

- local SEO scoring and summary generation
- local persistence
- PDF export wiring
- Netlify lead form markup
- an optional Netlify function for client error reporting

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

## What The Proof Actually Verifies

- the browser UI exposes the scoring form, PDF export, lead capture, and diagnostics controls
- the client script contains real scoring logic and local persistence
- the Netlify function entrypoint parses successfully

## What Is Still Not Proven Here

- live Netlify Forms capture
- live deployed function execution
- browser-session PDF export output

This is a runnable app, but some claims still require a deployed or interactive browser run to prove end to end.
