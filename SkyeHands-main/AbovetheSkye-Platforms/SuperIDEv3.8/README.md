# SuperIDEv3.8 Primary Runtime

`SuperIDEv3.8` is the primary local runtime for the SuperIDEv3 rebuild.

What is implemented here:

- Dynasty Vite/React shell copied into one canonical frontend runtime
- standalone `SkyeDocxMax` promoted into `public/SkyeDocxMax`
- backward-compatible `public/SkyeDocxPro` alias retained during merge
- 3.3.0 local `/api/*` server lifted into `server/create-server.cjs`
- source-lane references recorded in `source-lanes/README.md`
- lower-case product route aliases added under `public/`
- primary auth now bridged to central `SkyeGateFS13`
- local API smoke and embedded SkyeDocxMax browser smoke

Auth bridge:

- `SuperIDEv3.8` is no longer supposed to be a primary login authority.
- browser `/api/auth-*` compatibility routes now delegate to `SkyeGateFS13`
- local app/org/workspace data still lives here, but primary identity is expected from the central gate
- set `SKYGATEFS13_ORIGIN` to the deployed `SkyeGateFS13` base URL so Netlify functions can call `/auth/*`

Run locally:

```bash
npm run server:run
npm run dev
```

Suggested operator API base for the frontend:

```text
http://127.0.0.1:4318
```

Build locally:

```bash
npm run build
```

## Local Proof Lanes

```bash
node scripts/smoke-proof-contract.cjs
node scripts/smoke-api.cjs
node scripts/smoke-skydocxmax-embedded.mjs <local-runtime-url>
```

## Honest Runtime Boundaries

This folder proves the local SuperIDEv3.8 shell, local API surface, and embedded SkyeDocxMax mount. It does not by itself prove deployed SkyeGateFS13 auth, live provider-backed execution, external storage, real payment processors, or production submission endpoints.
