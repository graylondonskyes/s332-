# SkyeLeadVault Proof Status

## Conservative Status

`partial`

## Runnable Surface

This folder contains a real browser shell and real local handler code:

- `public/index.html`
- `public/admin.html`
- `public/skygate-auth.js`
- `netlify/functions/leads.js`
- `netlify/functions/lead-scoring.js`
- `netlify/functions/lead-analytics.js`
- `netlify/functions/skygate-session.js`

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

## What The Proof Verifies

- the public lead form is wired to the local lead handler
- the admin browser surface is wired to a local SkyGate session bootstrap for protected actions
- local operator credentials can be verified in-folder and mint a signed admin session token
- browser admin stage filters and transitions use the same canonical stage names as the local handler
- the local SkyGate bootstrap can mint a bearer token accepted by the protected handlers
- lead creation works in the local handler
- authenticated lead activity logging works
- authenticated stage advancement and analytics access work
- the scoring handler returns a real score breakdown for the created lead
- browser auth storage is session-scoped in the local admin surface

## What Is Still Not Proven Here

- real identity-provider handoff into SkyGate tokens
- deployed Netlify function behavior
- hosted storage or CRM sync outside the local file-backed handler

This is a real local proof lane for the implemented handler surface, including both a local proof bootstrap and a credential-checked local operator session path that the browser can use during proof. It is not a claim that production identity handoff or deployed auth behavior is fully certified inside this folder alone.
