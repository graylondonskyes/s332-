# SkyeDocxMax Smoke Directive

Run browser smoke through the SkyeHands repo Chromium wrapper. A release is not accepted unless the smoke result JSON records `ok: true`.

Required automated gates:

- `index.html` loads without fatal errors.
- `homepage.html` loads without missing local files.
- `offline.html` loads without missing local files.
- Manifest files parse and icon paths exist.
- Service worker installs and controls a reload.
- New document create/save/reload works.
- Encrypted `.skye` export/import works.
- Wrong passphrase fails cleanly.
- Recovery kit export works.
- TXT and HTML ZIP export downloads are produced.
- Local bridge/outbox/evidence records are written.

