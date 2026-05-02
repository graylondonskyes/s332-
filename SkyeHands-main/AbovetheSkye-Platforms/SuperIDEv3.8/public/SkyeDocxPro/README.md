# SkyeDocxMax

SkyeDocxMax is a standalone, offline-first private document editor and encrypted document vault.

## Runtime Model

SkyeDocxMax is releaseable as a static PWA. The editor, local vault, encrypted `.skye` package handling, export flows, and local cross-app queueing run from this folder without requiring the larger SuperIDEv3 runtime.

Optional Skye ecosystem bridge actions are static-safe:

- If a compatible SuperIDE/Skye backend is available, bridge buttons attempt those API calls.
- If no backend is available, bridge actions write local outbox, bridge, intent, and evidence records into browser storage.
- The release package does not require Netlify Functions or Cloudflare Workers for core document work.

## Supported Formats

Working:

- Encrypted `.skye` export/import
- `.txt` export
- HTML ZIP export
- Browser PDF/print flow

Not currently claimed as complete:

- Microsoft Word/OpenXML `.docx` import/export

The product name contains `Docx` as a brand name. This release is not a verified OpenXML processor until a dedicated `.docx` lane is implemented and smoked.

## Storage

Documents, folders, assets, comments, suggestions, versions, metadata, and local bridge records are stored in browser storage. Users should export backups before clearing browser data.

## Encryption

Encrypted `.skye` packages use the bundled runtime at `_shared/skye/skyeSecure.js`. Recovery/failsafe kit generation is supported for encrypted exports.

## PWA

The PWA uses:

- `manifest.webmanifest`
- `manifest.json` for compatibility with static hosts that probe this filename
- `service-worker.js`
- `offline.html`

Both manifests are intentionally retained and must stay equivalent.

## Browser Smoke

From the SkyeHands root, start a local static server:

```bash
cd Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax
python3 -m http.server 4177
```

Run the full smoke:

```bash
cd /home/lordkaixu/ALPHA-13/s332-/SkyeHands-main
tools/browser-smoke/with-repo-chromium.sh node Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax/smoke-full-standalone.mjs <standalone-preview-url>/index.html
```

## Release Files

- `RELEASE_MANIFEST.json` lists release files.
- `SkyeDocxMax_SMOKE_RESULTS.json` records the latest full browser smoke result.
- `SkyeDocxMax_RELEASE_READY_v1.zip` is the clean static release package.
