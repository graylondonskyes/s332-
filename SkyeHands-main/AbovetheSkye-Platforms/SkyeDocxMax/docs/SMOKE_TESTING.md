# Smoke Testing

Use the SkyeHands repo Chromium wrapper so browser smoke does not depend on a system browser.

```bash
tools/browser-smoke/with-repo-chromium.sh node Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax/smoke-full-standalone.mjs <standalone-preview-url>/index.html
```

Release smoke must cover:

- App, homepage, and offline page load.
- Manifest and icon files resolve.
- Service worker installs and controls reload.
- IndexedDB document persistence survives refresh.
- `.skye` encrypted export/import roundtrip works.
- Wrong passphrase fails visibly.
- TXT and HTML ZIP exports download.
- Bridge actions write local fallback records.

