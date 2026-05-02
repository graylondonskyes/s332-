# SuperIDEv3 Smoke Plan

Purpose: record required smoke coverage and release proof only.

Canonical status owner:
- `SuperIDEv3-integration.md`

This file should not carry overall completion claims or merge sequencing.

## Source-Lane Smoke Before Merge

☐ Smoke Dynasty lane app launch.
☐ Smoke Dynasty Neural Space Pro launch.
☐ Smoke Dynasty SkyeChat launch.
☐ Smoke Dynasty SkyeDocxPro launch.
☐ Smoke SkyeDocxPro v13 donor launch.
☐ Smoke Dynasty SkyeBlog launch.
☐ Smoke Dynasty route navigation.
☐ Smoke 3.3.0 app launch.
☐ Smoke 3.3.0 operator gate.
☐ Smoke 3.3.0 publishing package generation.
☐ Smoke 3.3.0 payment session route boundary.
☐ Smoke 3.3.0 submission job route boundary.
☐ Smoke 3.3.0 evidence dashboard.

## Final App UI Smoke

✅ Home loads.
✅ Workspace loads.
✅ Neural Space Pro loads.
✅ SkyeChat loads.
✅ Standalone SkyeDocxMax loads.
✅ Embedded SkyeDocxMax loads inside SuperIDEv3.
✅ `/skydocx` redirects or aliases to `/skydocxmax`.
☐ SkyeBlog loads.
☐ SkyDex loads.
☐ SovereignVariables loads.
✅ Catalog loads.
✅ Publishing loads.
✅ Commerce loads.
✅ Submissions load.
✅ Evidence loads.
✅ Settings loads.
☐ Every visible navigation button routes correctly.
☐ Every visible action button has a real handler.
☐ Every visible action button changes state, creates output, or calls an API.
☐ Every panel is readable inside viewport bounds.
☐ Every modal can open and close.
☐ Every error state is visible and not silent.

## Final API Smoke

✅ Health route returns typed runtime summary.
☐ Auth login route succeeds with valid configured test credentials.
☐ Auth login route fails with bad credentials.
☐ Auth verify route accepts valid session.
✅ Auth verify route rejects missing session.
☐ Auth refresh route rotates valid session.
☐ Auth logout route revokes session.
☐ Payment checkout route creates a session or returns missing-config failure.
☐ Stripe webhook route verifies signature or returns signature failure.
☐ Session reconcile route returns typed result.
☐ Publishing package route emits package output.
☐ Publishing binary route emits binary output.
☐ Catalog route persists title state.
☐ Release history route records release event.
☐ Submission job route creates typed job.
☐ Submission dispatch route respects live boundary.
☐ Submission status route returns typed status.
☐ Submission cancel route changes job state.
☐ Evidence routes return current artifacts.

## Persistence Smoke

☐ Catalog survives reload.
☐ Workspace files survive reload.
☐ Owned library state survives reload.
☐ Release history survives reload.
☐ Submission jobs survive reload.
☐ Auth revocation survives reload where storage is configured.
☐ Runtime journal writes audit event.
☐ Runtime journal reads audit event.
☐ Export/import preserves project state.
✅ SkyeDocxMax standalone document save survives reload.
☐ SkyeDocxMax embedded document save survives reload.
✅ SkyeDocxMax export/import preserves rich document state, metadata, review state, and encrypted `.skye` behavior where configured.
✅ SkyeDocxMax standalone governance controls pass browser smoke.
☐ SkyeDocxMax can send a publishing package request through the final SuperIDEv3 publishing API.
✅ SkyeDocxMax can send or receive cross-app context through the standalone bridge/outbox/evidence layer.

## No-Theater Failure Smoke

✅ Missing auth fails loudly.
☐ Missing payment credentials fail loudly.
☐ Missing portal credentials fail loudly.
☐ Missing publishing input fails loudly.
☐ Missing SkyeDocxMax document input fails loudly.
☐ Broken SkyeDocxMax to SuperIDEv3 communication fails smoke.
☐ Missing route fails smoke.
☐ Missing button fails smoke.
☐ Fake success fails smoke.
☐ Stale artifact fails smoke.
☐ Hash mismatch fails smoke.

## Release Gates

☐ Protected file hashes are current.
☐ Artifact freshness check passes.
☐ Route map check passes.
✅ Focused UI smoke passes for the current `SuperIDEv3.8` preview target.
☐ API smoke passes.
☐ Source-lane parity smoke passes.
✅ SkyeDocxMax standalone parity smoke passes against SkyeDocxPro donor behavior.
✅ SkyeDocxMax embedded route smoke passes inside SuperIDEv3.
☐ SkyeDocxMax embedded editor/save/export/import parity smoke passes inside SuperIDEv3.
☐ Final release checklist generated.
☐ Final release artifacts generated.

## Current Evidence — through 2026-04-30

✅ `npm run build` passed in `SuperIDEv3.8`.
✅ Focused preview-route smoke returned `200` for `/`, `/workspace`, `/catalog`, `/publishing`, `/commerce`, `/submissions`, `/evidence`, `/settings`, `/SkyeDocxMax/index.html`, `/SkyeChat/index.html`, and `/Neural-Space-Pro/index.html`.
✅ `public/SkyeDocxMax/smoke-standalone.mjs` passed against `http://127.0.0.1:4178/SkyeDocxMax/index.html`.
✅ `GET /api/health` returned `200`.
✅ `GET /api/auth/verify` without a bearer token returned `401`.
✅ `npm run smoke:skydocxmax-embedded -- http://127.0.0.1:4179` passed through the repo Chromium wrapper for `/skydocxmax` and `/skydocx`, verifying both routes render the integrated shell and embed `/SkyeDocxMax/index.html?embed=1&ws_id=primary-workspace`.
☐ `GET /api/runtime/readiness` returned `409` with blockers: `auth-secret-default`, `stripe-secret-missing`, `stripe-webhook-secret-missing`, and missing submission endpoints for `apple_books`, `kobo`, `kdp_ebook`, and `kdp_print_prep`.
☐ Full all-surfaces Playwright interaction smoke is not yet a closure gate because it still needs a narrowed canonical route list for the primary build.
