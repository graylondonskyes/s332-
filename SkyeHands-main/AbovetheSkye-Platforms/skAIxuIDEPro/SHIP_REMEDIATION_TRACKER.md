# skAIxuIDEpro Ship Remediation Tracker

Last updated: 2026-04-29

## Objective

Move the platform from:

- mixed archive bundle with overstatements and broken entry points

to:

- a release-candidate standalone platform whose remaining dependencies are primarily deploy-side provider/runtime configuration

## Remediation implemented in this pass

### Security hardening

- Locked `GET /.netlify/functions/logs` behind admin auth.
- Made log ingestion authenticated by default.
- Added explicit opt-in env override for public log ingestion:
  - `ALLOW_PUBLIC_LOG_INGEST=true`

Files:

- [netlify/functions/logs.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/logs.js:1)

### Identity error handling

- `identity-login` no longer returns fake success on failure.
- `identity-signup` no longer returns fake success on failure.

Files:

- [netlify/functions/identity-login.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/identity-login.js:1)
- [netlify/functions/identity-signup.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/identity-signup.js:1)

### Runtime honesty

- `server.js` no longer silently depends on a baked-in remote gateway.
- Remote gateway proxying is now explicit via `KAIXU_GATEWAY_URL`.
- Default local-server stance is static hosting plus helper endpoints only.
- Legacy Python helper server now respects `KAIXU_GATEWAY_URL` and the canonical `skAIxuide` route.

File:

- [server.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/server.js:1)

### Broken route and asset fixes

- Fixed launcher links to `skAIxuide` and `SkyesOverLondon.html`.
- Replaced dead `GotSOLE` launcher target with the archive catalog.
- Fixed `SmartIDE` link casing.
- Added compatibility redirect shims for older lowercase references.
- Added root `manifest.json` and `sw.js`.
- Pointed launcher/IDE icon references at real assets.
- Pointed IDE manifest/service worker icon paths at real shared image assets.

Files:

- [index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/index.html:1)
- [skAIxuide/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/index.html:1)
- [skAIxuide/manifest.json](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/manifest.json:1)
- [skAIxuide/sw.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/sw.js:1)
- [manifest.json](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/manifest.json:1)
- [sw.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/sw.js:1)
- [skyesoverlondon.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skyesoverlondon.html:1)
- [skAIxuide/smartide.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/smartide.html:1)
- [skaixuide/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/index.html:1)
- [GotSOLE/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/GotSOLE/index.html:1)

### Launcher diagnostics cleanup

- Removed the dead `/api/kaixu-chat` assumption from `skyehawk`.
- Normalized diagnostics and deep links to the actual `skAIxuide` route.

File:

- [skyehawk.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skyehawk.js:1)

### CDN de-risking and degraded-mode support

- Added a repo-local runtime guard layer that:
  - stubs `lucide`, `marked`, `DOMPurify`, and Netlify Identity when CDN scripts fail
  - surfaces a visible degraded-mode banner instead of silent failure
  - adds a local JSON bundle export fallback when `JSZip` is unavailable
- Hardened the root launcher so it still works as a 2D app directory when `three.js` is unavailable.
- Hardened the flagship IDE so the editor, preview, chat, and export flows stay usable even when the 3D layer or ZIP helper CDN is missing.
- Wired the runtime guard into core operator surfaces:
  - launcher
  - `skAIxuide/index.html`
  - login
  - admin
  - diagnostics
  - key auxiliary IDE pages
- Expanded `verify:release` to assert the runtime guard file exists and core guarded pages still resolve their local references.
- Vendored the browser-ready libraries that had proven local sources elsewhere in the workspace:
  - `three`
  - `marked`
  - `DOMPurify`
  - `JSZip`
- Downloaded and vendored the previously unresolved CDN-only bundles:
  - Tailwind browser runtime
  - Lucide browser bundle
  - Mermaid browser bundle
  - Netlify Identity widget
- Rewired the launcher and flagship IDE surfaces to prefer those local vendor copies.

Files:

- [s0l26/runtime-guards.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/s0l26/runtime-guards.js:1)
- [vendor/three/three.min.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/three/three.min.js:1)
- [vendor/marked/marked.min.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/marked/marked.min.js:1)
- [vendor/dompurify/purify.min.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/dompurify/purify.min.js:1)
- [vendor/jszip/jszip.min.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/jszip/jszip.min.js:1)
- [vendor/tailwind/tailwindcdn.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/tailwind/tailwindcdn.js:1)
- [vendor/lucide/lucide.min.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/lucide/lucide.min.js:1)
- [vendor/mermaid/mermaid.min.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/mermaid/mermaid.min.js:1)
- [vendor/netlify-identity/netlify-identity-widget.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/vendor/netlify-identity/netlify-identity-widget.js:1)
- [index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/index.html:1)
- [skAIxuide/index.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/index.html:1)
- [skAIxuide/login.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/login.html:1)
- [skAIxuide/admin_panel.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/admin_panel.html:1)
- [skAIxuide/diagnostics.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/diagnostics.html:1)
- [skAIxuide/Features&Specs.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/Features&Specs.html:1)
- [skAIxuide/SmartIDE.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/SmartIDE.html:1)
- [skAIxuide/tutorial.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/tutorial.html:1)
- [skAIxuide/CODEPULSE.html](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/skAIxuide/CODEPULSE.html:1)
- [scripts/release-readiness.mjs](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/scripts/release-readiness.mjs:1)

### Browser smoke automation

- Added a Playwright-based browser smoke script:
  - [scripts/smoke-interactions-playwright.mjs](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/scripts/smoke-interactions-playwright.mjs:1)
- Added `npm run verify:browser-smoke` in:
  - [package.json](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/package.json:1)
- Current automated browser scope is intentionally narrow and stable:
  - login page boots with vendored auth runtime present
  - login page degrades honestly when the identity widget is blocked
  - root launcher exposes an explicit smoke readiness hook and boots in normal mode
  - root launcher exposes a stable 2D degraded mode when the Three.js runtime is blocked
  - flagship IDE exposes an explicit smoke readiness hook once the editor shell is usable
  - flagship IDE remains smoke-usable when the Three.js runtime is blocked
- Verified result on local static server:
  - `login-normal` passed
  - `login-degraded` passed
  - `launcher-normal` passed
  - `launcher-degraded` passed
  - `skaixuide-normal` passed
  - `skaixuide-degraded` passed

Note:

- The heavier launcher and flagship IDE pages are now browser-smoked through page-specific readiness hooks rather than full cinematic/bootstrap timing.
- The launcher loading path was smoothed by moving spinner/bar motion onto compositor-friendly transforms and by stopping the intro rain loop when the intro closes.
- The IDE splash path was smoothed by using transform-based loading bar motion, longer logo easing, and compositor hints on splash/logo layers.

### Function smoke and curated release package

- Reordered the logs function so protected read/write paths enforce member/admin auth before opening the database.
- Hardened public `site-config` reads so local or blob-unconfigured environments return default config in degraded mode instead of throwing.
- Added a real optional kAIxU failover lane:
  - primary path remains `OPENAI_API_KEY` plus `OPENAI_MODEL` / `OPENAI_FALLBACK_MODEL`
  - failover path is `KAIXU_FAILOVER_GATEWAY_URL` with optional `KAIXU_FAILOVER_GATEWAY_TOKEN`
  - missing primary key can route to failover
  - retryable primary provider failures can route to failover
  - model-not-found errors still try configured model fallbacks before failing over
- Updated `runtime-status` so it reports concrete `missing_env` groups instead of implying production readiness without deploy vars.
- Added direct Netlify function smoke coverage for:
  - `runtime-status`
  - `site-config`
  - `auth-me`
  - `gateway-chat`
  - `gateway-stream`
  - `admin-overview`
  - authenticated logs read/write behavior
- Added a repeatable curated release package builder at:
  - `dist/skaixuidepro-release`
- Added explicit package artifact verification:
  - `npm run verify:release-package`
- Added production env contract verification:
  - `npm run verify:prod-env`
- The release package includes the launcher, flagship IDE, auth/admin/diagnostics surface, promoted launcher target apps, runtime guards, vendored browser libraries, Netlify functions, manifest/PWA assets, and ship documentation.
- The release package validates core package HTML references after copying so the package does not ship with missing promoted route targets.
- The release package excludes non-promoted archive/editorial bulk, local Netlify state, and `node_modules` by default.

Files:

- [netlify/functions/_lib/kaixu-openai.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/_lib/kaixu-openai.js:1)
- [netlify/functions/runtime-status.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/runtime-status.js:1)
- [netlify/functions/logs.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/logs.js:1)
- [netlify/functions/site-config.js](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/netlify/functions/site-config.js:1)
- [scripts/smoke-functions.mjs](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/scripts/smoke-functions.mjs:1)
- [scripts/build-release-package.mjs](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/scripts/build-release-package.mjs:1)
- [scripts/verify-production-env.mjs](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/scripts/verify-production-env.mjs:1)
- [scripts/verify-release-package.mjs](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/scripts/verify-release-package.mjs:1)
- [dist/skaixuidepro-release/RELEASE_PACKAGE_MANIFEST.json](/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/AbovetheSkye-Platforms/skAIxuIDEPro/dist/skaixuidepro-release/RELEASE_PACKAGE_MANIFEST.json:1)

## Remaining work before stronger release claims

### Current blocker status

The remaining blocker for production success is deploy-side configuration and credentials, not missing core code implementation.

Required env groups:

1. AI gateway:
   - either `OPENAI_API_KEY`
   - or `KAIXU_FAILOVER_GATEWAY_URL`
2. Database:
   - either `NEON_DATABASE_URL`
   - or `NETLIFY_DATABASE_URL`

Recommended env vars:

- `ADMIN_EMAILS`
- `OPENAI_MODEL`
- `OPENAI_FALLBACK_MODEL`
- `DEFAULT_MONTHLY_REQUEST_CAP`
- `DEFAULT_MONTHLY_TOKEN_CAP`
- `KAIXU_FAILOVER_GATEWAY_TOKEN` when using an authenticated failover gateway

After vars are installed, run authenticated deploy-environment smoke validation for successful:

   - `gateway-chat`
   - `gateway-stream`
   - identity login
   - admin overview

### Added verification command

- Run `npm run verify:release`
- Run `npm run verify:functions`
- Run `npm run verify:browser-smoke` against a local static or deploy preview server
- Run `npm run package:release`
- Run `npm run verify:release-package`
- Run `npm run verify:prod-env`
- This checks:
  - key files exist
  - root launcher and IDE local links resolve
  - core runtime modules import
  - unauthenticated protected functions fail with `401` before DB/provider access
  - public runtime/config functions return local-safe responses
  - login, launcher, and flagship IDE browser-smoke in normal and degraded runtime modes
  - curated release package can be rebuilt
  - curated release package contains the critical runtime, function, vendor, and verification files
  - production env contract reports exactly which deploy vars remain unset

### Positioning after this pass

Safe:

- orchestrated AI IDE
- server-side AI lane
- identity-gated workspace and usage tracking
- admin oversight and caps
- linked ecosystem launcher
- degraded-mode survival when major CDN helper scripts fail
- repo-hosted frontend runtime for the active launcher, IDE, admin, diagnostics, and key support pages
- curated release package available under `dist/skaixuidepro-release`
- optional kAIxU failover gateway lane is implemented

Still unsafe:

- full archive-wide production hardening
- claiming live production success before installing env vars and running deploy-environment smoke
