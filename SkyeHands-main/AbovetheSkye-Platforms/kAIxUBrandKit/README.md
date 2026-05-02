# SkyesOverLondon Brand Kit + kAIxU (Netlify)

This repo deploys a single-page Brand Identity Kit (two export cards) with a **kAIxU Studio** panel.
Your managed gateway lane stays server-side using Netlify Functions.

## Deploy (required)
This project uses Netlify Functions. Deploy via Git (Netlify connected to your repo). Drag-and-drop will not run functions.

## Netlify Environment Variables
Set in Netlify:
- `KAIXU_SERVER_LANE` = your server-managed gateway lane token
- `KAIXU_GATEWAY_BASE` = your Gateway13 site origin (example: `https://skyesol.netlify.app`)

Back-compat:
- Earlier managed-lane env aliases and `KAIXU_API_KEY` are accepted if `KAIXU_SERVER_LANE` is not set.

Optional:
- `KAIXU_MODEL` = override server-side model selection

## File layout
- `index.html`
- `netlify.toml`
- `netlify/functions/kaixu-generate.js`
- `netlify/functions/client-error-report.js`

## Notes
- If logo URL export has cross-origin issues, upload the logo file instead (best).
- Client-side errors are posted to `/.netlify/functions/client-error-report` for logging.
- The UI now keeps a local project library in browser storage so brand states can be saved, reloaded, exported, and re-imported without deployment services.

## Proof coverage
- Run `npm run smoke:contract-proof` for the bounded local proof.
- It proves the local export UI markers, project-library markers, and truthful validation/error contracts for the two Netlify Functions in this folder.
- It does not prove live gateway inference without deployed environment values.
