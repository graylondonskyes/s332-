# NeuralSpacePro Proof Status

Status: `partial`

Runtime shape:
- real static browser workspace shell
- self-contained local proof runtime for same-origin chat/health/session testing
- Firebase auth and Firestore wiring referenced in-page
- chat gateway route wired to `/.netlify/functions/gateway-chat`
- editor and preview canvas surfaces present

Local proof:
- `node smoke/smoke-proof.mjs`

What this proof covers:
- required static files exist
- the app shell contains the auth, workspace, and gateway route wiring it advertises
- settings use a same-origin or configured runtime base instead of a browser-held provider key field
- a local proof runtime in this folder serves the shell plus same-origin `/.netlify/functions/gateway-chat` and `/v1/sessions` lanes
- the service worker and manifest contract exist

What this proof does not claim:
- no live gateway/provider execution proof beyond the local proof harness
- no backend deployment proof
- no proof that a deployed same-origin or configured runtime lane is live
- no proof that external CDN dependencies are available at runtime
