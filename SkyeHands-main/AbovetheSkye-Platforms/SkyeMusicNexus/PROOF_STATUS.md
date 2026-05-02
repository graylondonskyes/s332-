# SkyeMusicNexus Proof Status

## Conservative Status

`partial`

## Runnable Surface

This folder contains a real browser shell and real local handler code:

- `public/index.html`
- `public/admin.html`
- `public/skygate-auth.js`
- `netlify/functions/music-artists.js`
- `netlify/functions/music-releases.js`
- `netlify/functions/music-payments.js`
- `netlify/functions/music-analytics.js`
- `netlify/functions/skygate-session.js`

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

## What The Proof Verifies

- the artist and admin browser surfaces are wired to a local SkyGate session bootstrap for protected actions
- local operator credentials can be verified in-folder and mint a signed admin session token
- browser auth storage is session-scoped in the local artist and admin surfaces
- artist registration works in the local handler layer
- release submit, review, publish, and stream reporting work
- payment credit, ledger, payout request, and payout queue flows work
- admin analytics accepts the locally bootstrapped token
- public artist and release read endpoints return the created records

## What Is Still Not Proven Here

- real identity-provider handoff into SkyGate tokens
- live DSP/distribution integrations
- deployed runtime behavior

This is a truthful local proof lane for the handler surface that exists in-repo, including both a local proof bootstrap and a credential-checked local operator session path that the browser can use during proof. It does not certify production identity handoff or live distribution behavior on its own.
