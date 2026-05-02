# SkyeMediaCenter Proof Status

## Conservative Status

`partial`

## Runnable Surface

This folder contains a real browser shell and real local handler code:

- `public/index.html`
- `public/admin.html`
- `public/skygate-auth.js`
- `netlify/functions/media-assets.js`
- `netlify/functions/media-file.js`
- `netlify/functions/media-search.js`
- `netlify/functions/media-publish.js`
- `netlify/functions/media-stats.js`
- `netlify/functions/skygate-session.js`

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

## What The Proof Verifies

- the upload and admin browser surfaces are wired to a local SkyGate session bootstrap for protected actions
- local operator credentials can be verified in-folder and mint a signed admin session token
- browser auth storage is session-scoped in the local upload and admin surfaces
- the browser upload shell matches the local `media-assets` upload contract
- the admin upload modal matches the same local upload contract
- authenticated local upload works and persists an asset
- draft assets stay protected until explicitly published
- published assets can be retrieved through the local `media-file` handler
- public asset listing and search return the uploaded asset
- authenticated publish, stats, and delete handlers work against the local file-backed store

## What Is Still Not Proven Here

- real identity-provider handoff into SkyGate tokens
- deployed Netlify runtime behavior
- CDN/media delivery behavior outside the local handler store

This is evidence for the local handler surface that exists in-repo, including both a local proof bootstrap and a credential-checked local operator session path that the browser can use during proof. It is not a claim that production identity handoff or deployed media delivery is fully authenticated end to end in this folder alone.
