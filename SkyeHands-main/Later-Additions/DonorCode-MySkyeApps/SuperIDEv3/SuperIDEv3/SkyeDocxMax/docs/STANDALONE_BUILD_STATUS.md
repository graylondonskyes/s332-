# SkyeDocxMax Standalone Build Status

Status date: 2026-04-27

## Completed

- Created standalone app folder at `SuperIDEv3/SkyeDocxMax`.
- Promoted SkyeDocxMax naming across the standalone app, homepage, offline page, manifests, service worker, and readme.
- Preserved the SkyeDocxPro v13 donor behavior as the base rich editor lane.
- Added local SkyeDocxMax `.skye` secure runtime at `_shared/skye/skyeSecure.js`.
- Kept backward import compatibility for older `.skye` files whose payload app id is `SkyeDocxPro`.
- Added local standalone auth/session helpers under `_shared/`.
- Fixed app icon references to local bundled icons.
- Fixed service worker precache paths and standardized on `assets/icons`.
- Added local fallback runtime at `js/fallback-runtime.js` so the app does not blank if CDN editor/helper libraries are unavailable.
- Added local outbox, bridge, intent, and evidence records for cross-app actions when SuperIDE APIs are unavailable.
- Added Playwright smoke harness at `smoke-standalone.mjs`.
- Added full completion smoke harness at `smoke-full-standalone.mjs`.
- Installed repo-local Playwright Chromium under `SuperIDEv3/.ms-playwright`.
- Updated `smoke-standalone.mjs` to default to the repo-local browser path.
- Added `verify-browser-smoke-env.mjs` so future agents can prove Chromium, headless shell, FFmpeg, Playwright, and Playwright Core are present before running smoke.
- Added `SuperIDEv3/BROWSER_SMOKE_ENVIRONMENT.md` as the canonical browser-smoke setup note.

## Verified

- `manifest.json` and `manifest.webmanifest` parse as valid JSON.
- Standalone helper scripts pass Node syntax checks.
- Service worker passes Node syntax checks.
- Local secure `.skye` runtime passes ESM syntax checks.
- Inline scripts in `index.html` pass syntax parsing.

## Browser Smoke Status

- Local server starts on port `4177`.
- Playwright smoke harness runs against repo-local Chromium.
- Live browser smoke passed against `http://127.0.0.1:4177/index.html`.
- Smoke verified app boot, editor readiness, secure `.skye` runtime readiness, cross-app bridge button injection, document creation/opening, and encrypted payload round trip.
- Full standalone browser completion smoke passed through the SkyeHands root Chromium wrapper.
- Full smoke verified secure `.skye` export/import, recovery kit generation, HTML ZIP export, TXT export, local outbox, local evidence, local bridge records, local intent records, service worker control, and reload persistence.
- Expanded full smoke verified governance controls: comments, suggestion mode, version timeline, template creation, metadata save, page-break marker persistence, and governance persistence through export/import/reload paths.

## Current Standalone Entry Points

- Editor: `SuperIDEv3/SkyeDocxMax/index.html`
- Product page: `SuperIDEv3/SkyeDocxMax/homepage.html`
- Offline fallback: `SuperIDEv3/SkyeDocxMax/offline.html`
- Manifest: `SuperIDEv3/SkyeDocxMax/manifest.webmanifest`

## Completion Command

From the SkyeHands root:

```bash
tools/browser-smoke/with-repo-chromium.sh node Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax/smoke-full-standalone.mjs http://127.0.0.1:4177/index.html
```

Latest expanded result: passed.
