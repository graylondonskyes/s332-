# Skyes Over London — kAIxU PDF Suite (SVS + kAIxuGateway13)

This build routes **100%** of AI/LLM requests through **kAIxuGateway13** (no direct provider endpoints, no provider SDKs).

## Gateway Endpoints
- POST `/.netlify/functions/gateway-chat`
- POST `/.netlify/functions/gateway-stream`
- GET  `/.netlify/functions/health`

Auth mode:
server-managed lane or same-origin session-backed gateway access

## How this app calls the gateway
This repo uses a Netlify redirect:
  /api/*  ->  https://skyesol.netlify.app/.netlify/functions/:splat

So the app calls:
- POST /api/gateway-stream
- POST /api/gateway-chat
- GET  /api/health

## Runtime Lane
This app now expects a server-managed or same-origin runtime gateway lane.
Browser-held bearer key storage is disabled in the active client path.

## Vault / Blobs (Optional)
- Set DATABASE_URL to enable the Neon Vault (run metadata + JSON)
- Netlify Blobs stores PDFs and uploads

## Quick Test
1) tool.html#diagnostics -> Ping
2) Verify the runtime lane is healthy
3) Run any tool -> Export PDF
4) Export or import the active local workspace
5) Save Run / Save PDF (if Vault enabled)

## Proof coverage
- Run `npm run smoke:static-proof` for the local bounded proof.
- It proves the static suite shell, deep-link pages, same-origin runtime config, workspace import/export controls, service-worker presence, and client export hooks.
- It does not prove live gateway output, redirect wiring, or optional vault/blob persistence.
