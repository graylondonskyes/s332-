# Offline PWA

SkyeDocxMax registers `service-worker.js` and precaches the app shell, local runtime files, icons, manifest, homepage, and offline page.

Offline behavior:

- First connected load installs and activates the service worker.
- Later navigations fall back to cached `index.html` or `offline.html`.
- IndexedDB saves continue while offline.
- Export and import actions that do not require a remote provider continue locally.

The app should be smoke tested from a local or deployed HTTP origin. Opening via `file://` is not a valid PWA smoke path.

