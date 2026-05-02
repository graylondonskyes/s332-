# SkyeGateFS13 Integration Dossier: superidev3-8

- Generated: `2026-04-30T01:12:17.349Z`
- App path: `/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/SuperIDEv3.8`
- Gate env var: `SKYGATEFS13_ORIGIN`

## Summary

- Scanned files: 651
- Legacy endpoints found: 21
- Auth indicators found: 9
- Netlify redirect hits: 50

## Legacy Endpoints

- `/api/auth-login`
- `/api/auth-logout`
- `/api/auth-me`
- `/api/auth-password-reset-confirm`
- `/api/auth-password-reset-request`
- `/api/auth-pin-set`
- `/api/auth-pin-unlock`
- `/api/auth-signup`
- `/api/token-issue`
- `/api/token-list`
- `/api/token-revoke`
- `/auth/contacts`
- `/auth/gmail`
- `/auth/login`
- `/auth/logout`
- `/auth/me`
- `/auth/refresh`
- `/auth/register`
- `/auth/signup`
- `/auth/userinfo`
- `/auth/verify`

## Auth Indicators

- `ADMIN_JWT_SECRET`
- `ADMIN_PASSWORD`
- `SkyeStandaloneSession`
- `TOKEN_MASTER_SEQUENCE`
- `auth-pin-set`
- `auth-pin-unlock`
- `kx.api.accessToken`
- `kx.api.tokenEmail`
- `requireUser`

## Recommendations

- Route primary identity through SkyeGateFS13 `/auth/*`, `/oauth/*`, and `/.well-known/*`.
- Keep `/api/auth-*` only as same-origin compatibility adapters backed by SkyeGateFS13.
- Gate token issue/list/revoke behind central identity, and mirror issuance activity into the parent gate ledger.
- Reduce local storage/session helpers to client bridges only; do not mint primary identity locally.
- Patch local protected routes so `requireUser` or equivalent trusts SkyeGateFS13 bearer/cookie identity first.
- Set SKYGATEFS13_ORIGIN in the consumer runtime so same-origin adapters can call the deployed SkyeGateFS13.
- Mirror login, token issuance, gateway use, and GitHub/Netlify push actions into SkyeGateFS13 parent audit/usage tables.

## Endpoint Hits

- `/api/auth-me` in `SkyeDocxMax/_shared/auth-unlock.js`
- `/api/token-issue` in `SkyeDocxMax/_shared/auth-unlock.js`
- `/api/auth-pin-unlock` in `SkyeDocxMax/_shared/auth-unlock.js`
- `/api/auth-login` in `SkyeDocxMax/_shared/standalone-session.js`
- `/api/auth-signup` in `SkyeDocxMax/_shared/standalone-session.js`
- `/api/auth-me` in `SkyeDocxMax/index.html`
- `/auth/me` in `netlify/functions/_shared/auth.ts`
- `/auth/gmail` in `netlify/functions/_skymail_standalone/_gmail.js`
- `/auth/contacts` in `netlify/functions/_skymail_standalone/_gmail.js`
- `/auth/userinfo` in `netlify/functions/_skymail_standalone/_gmail.js`
- `/auth/login` in `netlify/functions/auth-login.ts`
- `/auth/logout` in `netlify/functions/auth-logout.ts`
- `/auth/signup` in `netlify/functions/auth-signup.ts`
- `/api/auth-me` in `public/API-Playground/index.html`
- `/api/auth-login` in `public/API-Playground/index.html`
- `/api/auth-signup` in `public/API-Playground/index.html`
- `/api/auth-pin-unlock` in `public/API-Playground/index.html`
- `/api/token-issue` in `public/API-Playground/index.html`
- `/api/token-list` in `public/API-Playground/index.html`
- `/auth/login` in `public/GoogleBusinessProfileRescuePlatform/docs/phase-4-ledger.md`
- `/auth/register` in `public/GoogleBusinessProfileRescuePlatform/docs/phase-4-ledger.md`
- `/auth/logout` in `public/GoogleBusinessProfileRescuePlatform/docs/phase-4-ledger.md`
- `/api/auth-me` in `public/REACT2HTML/index.html`
- `/api/auth-me` in `public/SKNore/index.html`
- `/api/auth-signup` in `public/SKNore/index.html`
- `/api/auth-login` in `public/SKNore/index.html`
- `/api/auth-logout` in `public/SKNore/index.html`
- `/api/auth-me` in `public/SkyeBlog/index.html`
- `/api/auth-me` in `public/SkyeBookx/index.html`
- `/api/auth-me` in `public/SkyeChat/index.html`
- `/api/auth-signup` in `public/SkyeChat/index.html`
- `/api/auth-login` in `public/SkyeChat/index.html`
- `/api/auth-logout` in `public/SkyeChat/index.html`
- `/api/auth-me` in `public/SkyeDocxMax/_shared/auth-unlock.js`
- `/api/token-issue` in `public/SkyeDocxMax/_shared/auth-unlock.js`
- `/api/auth-pin-unlock` in `public/SkyeDocxMax/_shared/auth-unlock.js`
- `/api/auth-login` in `public/SkyeDocxMax/_shared/standalone-session.js`
- `/api/auth-signup` in `public/SkyeDocxMax/_shared/standalone-session.js`
- `/api/auth-me` in `public/SkyeDocxMax/index.html`
- `/api/auth-me` in `public/SkyeDocxPro/_shared/auth-unlock.js`
- `/api/token-issue` in `public/SkyeDocxPro/_shared/auth-unlock.js`
- `/api/auth-pin-unlock` in `public/SkyeDocxPro/_shared/auth-unlock.js`
- `/api/auth-login` in `public/SkyeDocxPro/_shared/standalone-session.js`
- `/api/auth-signup` in `public/SkyeDocxPro/_shared/standalone-session.js`
- `/api/auth-me` in `public/SkyeDocxPro/index.html`
- `/api/auth-me` in `public/Smokehouse/index.html`
- `/api/auth-login` in `public/Smokehouse/index.html`
- `/api/auth-signup` in `public/Smokehouse/index.html`
- `/api/auth-pin-unlock` in `public/Smokehouse/index.html`
- `/api/token-issue` in `public/Smokehouse/index.html`
- `/api/auth-me` in `public/_shared/auth-unlock.js`
- `/api/token-issue` in `public/_shared/auth-unlock.js`
- `/api/auth-pin-unlock` in `public/_shared/auth-unlock.js`
- `/api/auth-login` in `public/_shared/standalone-session.js`
- `/api/auth-signup` in `public/_shared/standalone-session.js`
- `/api/auth-login` in `public/netlify.toml`
- `/api/auth-signup` in `public/netlify.toml`
- `/api/auth-logout` in `public/netlify.toml`
- `/api/auth-me` in `public/netlify.toml`
- `/api/auth-password-reset-request` in `public/netlify.toml`
- `/api/auth-password-reset-confirm` in `public/netlify.toml`
- `/api/auth-pin-set` in `public/netlify.toml`
- `/api/auth-pin-unlock` in `public/netlify.toml`
- `/api/token-issue` in `public/netlify.toml`
- `/api/token-list` in `public/netlify.toml`
- `/api/token-revoke` in `public/netlify.toml`
- `/api/auth-password-reset-request` in `public/recover-account/index.html`
- `/api/auth-password-reset-confirm` in `public/recover-account/index.html`
- `/auth/login` in `server/create-server.cjs`
- `/auth/verify` in `server/create-server.cjs`
- `/auth/refresh` in `server/create-server.cjs`
- `/auth/logout` in `server/create-server.cjs`
- `/api/auth-me` in `src/App.tsx`
- `/api/token-issue` in `src/App.tsx`
- `/api/token-list` in `src/App.tsx`
- `/api/token-revoke` in `src/App.tsx`
- `/api/auth-pin-set` in `src/App.tsx`
- `/api/auth-pin-unlock` in `src/App.tsx`
- `/api/auth-password-reset-request` in `src/App.tsx`
- `/api/auth-password-reset-confirm` in `src/App.tsx`
- `/api/auth-signup` in `src/App.tsx`
- `/api/auth-login` in `src/App.tsx`
- `/api/auth-logout` in `src/App.tsx`

## Redirect Hits

- `public/ContractorNetwork/netlify.toml:13` → `from = "/api/health"`
- `public/ContractorNetwork/netlify.toml:14` → `to = "/.netlify/functions/health"`
- `public/ContractorNetwork/netlify.toml:18` → `from = "/api/intake"`
- `public/ContractorNetwork/netlify.toml:19` → `to = "/.netlify/functions/intake"`
- `public/ContractorNetwork/netlify.toml:23` → `from = "/api/admin/login"`
- `public/ContractorNetwork/netlify.toml:24` → `to = "/.netlify/functions/admin-login"`
- `public/ContractorNetwork/netlify.toml:28` → `from = "/api/admin/submissions"`
- `public/ContractorNetwork/netlify.toml:29` → `to = "/.netlify/functions/admin-submissions"`
- `public/ContractorNetwork/netlify.toml:33` → `from = "/api/admin/submission/*"`
- `public/ContractorNetwork/netlify.toml:34` → `to = "/.netlify/functions/admin-submission/:splat"`
- `public/ContractorNetwork/netlify.toml:38` → `from = "/api/admin/export"`
- `public/ContractorNetwork/netlify.toml:39` → `to = "/.netlify/functions/admin-export"`
- `public/ContractorNetwork/netlify.toml:43` → `from = "/api/admin/file/*"`
- `public/ContractorNetwork/netlify.toml:44` → `to = "/.netlify/functions/admin-file/:splat"`
- `public/netlify.toml:16` → `from = "/api/health"`
- `public/netlify.toml:17` → `to = "/.netlify/functions/health"`
- `public/netlify.toml:21` → `from = "/api/intake"`
- `public/netlify.toml:22` → `to = "/.netlify/functions/intake"`
- `public/netlify.toml:26` → `from = "/api/admin/login"`
- `public/netlify.toml:27` → `to = "/.netlify/functions/admin-login"`
- `public/netlify.toml:31` → `from = "/api/admin/submissions"`
- `public/netlify.toml:32` → `to = "/.netlify/functions/admin-submissions"`
- `public/netlify.toml:36` → `from = "/api/admin/submission/*"`
- `public/netlify.toml:37` → `to = "/.netlify/functions/admin-submission/:splat"`
- `public/netlify.toml:41` → `from = "/api/admin/export"`
- `public/netlify.toml:42` → `to = "/.netlify/functions/admin-export"`
- `public/netlify.toml:46` → `from = "/api/admin/file/*"`
- `public/netlify.toml:47` → `to = "/.netlify/functions/admin-file/:splat"`
- `public/netlify.toml:51` → `from = "/api/auth-login"`
- `public/netlify.toml:52` → `to = "/.netlify/functions/auth-login"`
- `public/netlify.toml:56` → `from = "/api/auth-signup"`
- `public/netlify.toml:57` → `to = "/.netlify/functions/auth-signup"`
- `public/netlify.toml:61` → `from = "/api/auth-logout"`
- `public/netlify.toml:62` → `to = "/.netlify/functions/auth-logout"`
- `public/netlify.toml:66` → `from = "/api/auth-me"`
- `public/netlify.toml:67` → `to = "/.netlify/functions/auth-me"`
- `public/netlify.toml:71` → `from = "/api/auth-password-reset-request"`
- `public/netlify.toml:72` → `to = "/.netlify/functions/auth-password-reset-request"`
- `public/netlify.toml:76` → `from = "/api/auth-password-reset-confirm"`
- `public/netlify.toml:77` → `to = "/.netlify/functions/auth-password-reset-confirm"`
- `public/netlify.toml:81` → `from = "/api/auth-pin-set"`
- `public/netlify.toml:82` → `to = "/.netlify/functions/auth-pin-set"`
- `public/netlify.toml:86` → `from = "/api/auth-pin-unlock"`
- `public/netlify.toml:87` → `to = "/.netlify/functions/auth-pin-unlock"`
- `public/netlify.toml:91` → `from = "/api/token-issue"`
- `public/netlify.toml:92` → `to = "/.netlify/functions/token-issue"`
- `public/netlify.toml:96` → `from = "/api/token-list"`
- `public/netlify.toml:97` → `to = "/.netlify/functions/token-list"`
- `public/netlify.toml:101` → `from = "/api/token-revoke"`
- `public/netlify.toml:102` → `to = "/.netlify/functions/token-revoke"`
