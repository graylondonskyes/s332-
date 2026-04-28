# Deployment

SkyeDocxMax deploys as static files. The standalone release does not require SuperIDEv3, Netlify Functions, Cloudflare Workers, or a server database for its core editor, vault, `.skye` encryption, exports, and local bridge outbox.

Recommended static entry points:

- `index.html`: editor workspace.
- `homepage.html`: product page.
- `offline.html`: PWA fallback.
- `manifest.webmanifest`: install manifest.
- `service-worker.js`: offline shell cache.

Bridge routes are intentionally local-first in this package. Final SuperIDEv3 integration can replace the local outbox with live `/api/skydocxmax/*` routes.

