# SkyeGateFS13 Integration Dossier: 0s-auth-sdk

- Generated: `2026-04-30T01:12:13.416Z`
- App path: `/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/SkyeSol/skyesol-main/0s-auth-sdk`
- Gate env var: `SKYGATEFS13_ORIGIN`

## Summary

- Scanned files: 2
- Legacy endpoints found: 1
- Auth indicators found: 1
- Netlify redirect hits: 0

## Legacy Endpoints

- `/auth/login`

## Auth Indicators

- `SkyeStandaloneSession`

## Recommendations

- Route primary identity through SkyeGateFS13 `/auth/*`, `/oauth/*`, and `/.well-known/*`.
- Reduce local storage/session helpers to client bridges only; do not mint primary identity locally.
- Set SKYGATEFS13_ORIGIN in the consumer runtime so same-origin adapters can call the deployed SkyeGateFS13.
- Mirror login, token issuance, gateway use, and GitHub/Netlify push actions into SkyeGateFS13 parent audit/usage tables.

## Endpoint Hits

- `/auth/login` in `0s-login.html`

## Redirect Hits

- None

