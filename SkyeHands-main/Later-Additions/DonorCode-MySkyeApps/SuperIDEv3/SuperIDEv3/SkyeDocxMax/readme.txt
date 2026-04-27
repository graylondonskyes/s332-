SkyeDocxMax — Standalone Offline Installable PWA

Deploy:
- Drop this folder into Netlify (Publish directory: root)
- Visit the site once online, then use the browser install prompt:
  - Chrome/Edge (desktop): Install icon in address bar
  - Android: Add to Home screen / Install app
  - iOS Safari: Share → Add to Home Screen

Offline:
- After the first successful load, the service worker caches the full app shell + external CDN dependencies,
  so the app launches from the home-screen icon fully offline.

Notes:
- This build is the standalone SkyeDocxMax lane.
- SkyeDocxPro remains a donor source only; final user-facing document work should happen here.
- When SuperIDE APIs are unavailable, cross-app actions queue local outbox, bridge, intent, and evidence records in localStorage instead of pretending the backend succeeded.
