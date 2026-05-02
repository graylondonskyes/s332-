# ValleyVerified-v2 Proof Status

## Runnable Surface

This folder contains a real operator-facing app plus local API surfaces:

- browser dashboard for job posting, contractor onboarding, and board refresh
- local operator session login for same-folder runtime exercise
- Netlify functions for jobs, contractors, claims, and fulfillment
- shared auth/store libraries
- an integration contract file for the wider estate

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
node smoke/browser-smoke.mjs
```

## What The Proof Actually Verifies

- the operator dashboard controls exist
- the frontend is wired to the documented function and local session lanes
- the function files and shared libraries exist and parse successfully
- the integration contract file is present
- a local smoke run can log in an operator, post a job, onboard a contractor, claim the job, and fulfill it
- a browser smoke can drive the same flows against an in-folder local runtime server that serves the dashboard plus Netlify function endpoints

## What Is Still Not Proven Here

- live SkyGate-backed authentication with production secrets
- live external notifications or payment providers
- a deployed end-to-end contractor claim and fulfillment run

This is a real platform slice, but some enterprise claims still depend on live deployment inputs and runtime exercise.
