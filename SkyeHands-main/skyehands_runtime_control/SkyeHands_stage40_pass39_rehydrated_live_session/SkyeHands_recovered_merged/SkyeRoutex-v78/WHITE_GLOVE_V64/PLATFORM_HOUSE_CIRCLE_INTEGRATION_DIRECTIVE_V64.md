# PLATFORM HOUSE CIRCLE INTEGRATION DIRECTIVE V64

## What landed in V64
- Real Netlify serverless lane under `netlify/functions/`
- Signed operator cloud sessions via `phc-auth-login`
- Snapshot push/pull via `phc-sync-state`
- Server frame ingest via `phc-sync-frame`
- Server POS ingest queue via `phc-pos-ingest`
- Square-style webhook intake via `phc-webhook-square`
- Server job execution/drain via `phc-job-drain`
- Browser cloud control mesh via `housecircle.integral.v64.js`

## Why this matters
V63 closed the local-control gaps. V64 opens the shared server control plane so Platform House Circle can stop behaving like a tab-only replica mesh and begin acting like a true cross-device stack.

## Honest boundary
This is a shipped serverless lane, not a claim that your production secrets, domain auth, or vendor credentials were already live. The repo now contains the code for those lanes.
