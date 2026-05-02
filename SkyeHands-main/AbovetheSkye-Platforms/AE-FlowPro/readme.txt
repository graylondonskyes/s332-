AE FLOW by Skyes Over London — Netlify Drop Folder

Deploy:
1) Drag-and-drop the folder into Netlify manual deploy, or zip and upload.
2) Ensure publish directory is the folder root (the same folder containing index.html).

PWA:
- After deploy, open the site on mobile → Share → "Add to Home Screen" (iOS) or Install prompt (Android/Chrome).
- Works offline after first load.

Files:
- index.html
- sw.js
- manifest.webmanifest
- icons (.png)
- _headers (prevents stale SW/manifest caching)
- runtime/local-runtime.mjs (same-folder local runtime lane for recovery journal + backup snapshots)

3D Cosmos Background:
- Uses Three.js for a vibrant animated cosmos behind the UI.
- Three.js is cached by the service worker after first online load.
- If you load the app while fully offline before caching, the app falls back to the original gradient background.


v1.2 Offline Upgrade:
- Added weighted route scoring and account forecast board.
- Added priority and deal-stage graphs.
- Added forecast CSV and executive snapshot HTML export.
- Added client-side encrypted secure mirror / encrypted backup tools.
- Still static + Netlify Drop ready. No backend required.


Version 1.3 hotfix: restored summary/share handler, repaired import boot path, and added backward-compatible backup normalization for older AE FLOW exports.

Version 1.4 local runtime lane:
- Added a same-folder runtime at runtime/local-runtime.mjs so the browser app can persist recovery journal history and backup snapshots into this folder on the same origin.
- The Settings tab now exposes runtime lane status, manual runtime snapshot capture, recovery journal export, and journal clearing.
- Smoke proof now exercises the real runtime endpoints instead of only checking static strings.
