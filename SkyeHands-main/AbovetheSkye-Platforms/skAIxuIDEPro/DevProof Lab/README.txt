SOLE Nexus • Valuation Studio (Netlify Drop app)

What this is
- A client-side app with a cinematic console UI that:
  1) Scans a website ZIP locally in the browser
  2) Produces a deterministic proof-asset appraisal (no sales/traffic valuation)
  3) Exports a branded PDF (Skyes Over London / SOLE Nexus)

Deploy (fastest)
1) Download this folder as a ZIP.
2) Go to Netlify → Sites → “Add new site” → Deploy manually.
3) Drag-and-drop the ZIP.
4) Your app is live.

Use
1) Upload your site ZIP (the same ZIP you drag into Netlify when deploying a site).
2) The app scans and fills metrics + notes.
3) Click Auto-calc (or edit the total) and ensure the breakdown matches.
4) Click Export Branded PDF.

Notes
- This version uses CDN libraries:
  - JSZip
  - jsPDF
  - jsPDF-AutoTable
  If you want a fully-offline build (no CDNs), say so and I’ll vendor everything locally.

Files
- index.html (UI)
- style.css (theme)
- app.js (scanner + valuation engine + PDF export)
- _redirects (404 → / fallback)
- 404.html (safe redirect)


UI
- This build uses a 'Royal Night Sky' animated starfield canvas + glassmorphism panels + gold/purple neon.



AI valuation (kAIxuGateway13 routing)
- You can choose who performs the valuation:
  - kAIxu Analyst (skAIxU-Pro2 via gateway)
  - kAIxU-Prime6.7 Analyst (OpenAI via gateway)
  - skAIxU Flow3.9 Analyst (Anthropic via gateway)
  - Custom provider/model (still via gateway)
- You must supply a Kaixu Key (kAIxU Server Lane). No provider keys are ever used.
- In production on Netlify, all AI calls go to /api/... and are redirected to the runtime gateway lane (see netlify.toml).

If the gateway returns:
- 401 → invalid/missing Kaixu Key
- 402 → monthly cap reached (stop calling until top-up)
- 429 → rate limited
- 500 → gateway/provider error


AI features (IMPORTANT)
- Netlify Drop deployments do not reliably honor netlify.toml redirects. This app therefore includes the required proxy in _redirects:
  /api/* <same-origin-runtime-gateway>/:splat 200!
- The UI calls /api/.netlify/functions/gateway-chat and /api/.netlify/functions/gateway-stream, which are proxied to kAIxuGateway13.


AI headers
- All gateway requests include headers: x-kaixu-app and x-kaixu-build.

Client error reporting
- Client-side errors (before gateway) are POSTed to /.netlify/functions/client-error-report.
- Open Diagnostics to confirm the function is reachable.
