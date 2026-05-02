# BusinessLaunchGo Proof Status

## Runnable Surface

This folder contains a real browser app surface:

- `index.html` + `assets/app.js` + `assets/zip.js`
- browser-local launch-pack generation
- browser PDF export
- Netlify form markup for lead capture
- optional Netlify function hooks for client error reporting, Neon lead upsert, Neon health, and blob storage

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

## What The Proof Actually Verifies

- the main app shell exists and exposes the ZIP, PDF, lead-form, and diagnostics controls
- the browser app is wired to the documented function endpoints
- the SQL schema and Netlify function entrypoints are present
- the Netlify function files parse successfully with `node --check`

## What Is Still Not Proven Here

- a live Netlify deployment
- a working Neon database connection
- working blob persistence in a deployed environment

This is a truthful source/proof lane for what is implemented in-repo. It is not a claim that the optional hosted integrations are already live.
