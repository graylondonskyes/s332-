# SuperIDEv3 Canonical Completion Tracker

Project root: `SuperIDEv3`

This is the only file that should carry completion state for the merged SuperIDEv3 system.

Supporting references:
- `LOSS_MAP.md` records donor-to-target recovery gaps only.
- `ROUTE_MAP.md` records target route inventory and route acceptance rules only.
- `SMOKE_PLAN.md` records required smoke coverage and release proof only.
- `MERGE_ORDER.md` records implementation order only.

Completion rule:
- Use `✅` only for verified present or code-backed work.
- Use `☐` for open work.
- Do not mark anything complete from screenshots, naming, or document-only claims.

## Product Goal

Produce two deployable outputs from this folder:

1. `SkyeDocxMax` as a standalone document-authoring, publishing, export/import, and governance app.
2. `SuperIDEv3` as the full merged command system containing preserved Dynasty product surfaces plus embedded `SkyeDocxMax` and lifted 3.3.0 backend lanes.

Replacement rule:
- `SkyeDocxMax` supersedes `SkyeDocxPro` in the final SuperIDEv3 runtime.
- `SkyeDocxPro` remains a donor/source label only until parity is proven.

## Verified Snapshot — 2026-04-28

✅ Source donor lanes are present:
- `SuperIDEv2`
- `SuperIDEv2-Sovereign-Author-Publishing-System-3.3.0-live-lane-pass (1)`

✅ Standalone `SkyeDocxMax` exists as code-backed output with standalone status and smoke documentation.

✅ Dynasty donor lane contains a Vite/React app structure with `src`, `public`, `netlify/functions`, `worker`, and `dist`.
✅ Dynasty donor local `check:provider-strings` passed during the 2026-04-27 scan.
✅ Dynasty donor local `check:gateway-only` passed during the 2026-04-27 scan.
☐ Dynasty donor local `check:secure-defaults` failed during the 2026-04-27 scan.
☐ Dynasty donor local `npm run build` did not complete in this environment because `vite` failed with `Permission denied`.

✅ 3.3.0 donor lane contains `build320/app`, `build320/server`, `build320/platform`, `build320/scripts`, `build320/smoke`, and `build320/artifacts`.
☐ 3.3.0 donor lane still self-reports partial completion rather than full production closure.

✅ `SuperIDEv3.8/` now exists as the active primary build target.
✅ A canonical merged SuperIDEv3 runtime folder now exists with its own frontend package, public surface, and lifted server code.
✅ `SuperIDEv3.8` local `npm run build` passed on 2026-04-28.
✅ Focused preview-route smoke passed on 2026-04-28 for `/`, `/workspace`, `/catalog`, `/publishing`, `/commerce`, `/submissions`, `/evidence`, `/settings`, `/SkyeDocxMax/index.html`, `/SkyeChat/index.html`, and `/Neural-Space-Pro/index.html`.
✅ Standalone `SkyeDocxMax` browser smoke passed on 2026-04-28 against the `SuperIDEv3.8` preview target.
✅ Embedded `SkyeDocxMax` route smoke passed on 2026-04-30 for `/skydocxmax` and `/skydocx`, verifying the SuperIDEv3.8 shell embeds `/SkyeDocxMax/index.html?embed=1&ws_id=primary-workspace`.
✅ `GET /api/health` returned `200` and `GET /api/auth/verify` without a bearer token returned `401` on 2026-04-28.
☐ `GET /api/runtime/readiness` still returns `409` because runtime config blockers remain unresolved.
☐ No canonical merged SuperIDEv3 route registry exists yet.
☐ Full canonical merged SuperIDEv3 smoke proof does not yet exist across the required API and embedded-app flows.

## Completion Scoreboard

### 1. Canonical Merge Target

✅ Create `SuperIDEv3.8/`.
✅ Preserve donor lanes under `SuperIDEv3.8/source-lanes/` or documented mounts.
✅ Choose one canonical runtime stack.
✅ Create one canonical package entrypoint.
✅ Create one canonical app shell.
✅ Create one canonical server entrypoint.
☐ Create one canonical route registry.
☐ Create one canonical navigation registry.

### 2. Preserved Product Surfaces

✅ `/` merged command home exists.
✅ `/workspace` merged workspace exists.
✅ `/neural-space-pro` exists in the merged runtime.
✅ `/skyechat` exists in the merged runtime.
✅ Standalone `SkyeDocxMax` exists.
✅ Embedded `/skydocxmax` exists in the merged runtime.
✅ `/skydocx` redirects or aliases to `/skydocxmax`.
☐ `/skyeblog` exists in the merged runtime.
☐ `/skydex` exists in the merged runtime.
☐ `/sovereign-variables` exists in the merged runtime.

### 3. Lifted Backend Lanes

✅ Final auth/session routes are mounted behind the merged runtime.
☐ Final publishing package routes are mounted behind the merged runtime.
☐ Final publishing binary routes are mounted behind the merged runtime.
☐ Final commerce/payment routes are mounted behind the merged runtime.
☐ Final catalog/library routes are mounted behind the merged runtime.
☐ Final submission job routes are mounted behind the merged runtime.
☐ Final evidence/release-gate routes are mounted behind the merged runtime.
✅ Final runtime journal/persistence layer is mounted behind the merged runtime.

### 4. Cross-Lane Integration

☐ Embedded `SkyeDocxMax` matches standalone `SkyeDocxMax` document behavior.
☐ Embedded `SkyeDocxMax` matches standalone `SkyeDocxMax` export/import behavior.
☐ Embedded `SkyeDocxMax` matches standalone `SkyeDocxMax` governance behavior.
☐ `SkyeDocxMax` can call final publishing APIs.
☐ `SkyeDocxMax` can exchange typed state with auth, catalog, blog, chat, and evidence lanes.
☐ UI controls call real routes or real local persistence, not placeholder handlers.

### 5. Release Proof

✅ Merged runtime local build succeeds.
✅ Focused required app routes have merged-runtime smoke proof.
☐ Required API routes have merged-runtime smoke proof.
☐ Required persistence flows have merged-runtime smoke proof.
✅ Missing-session auth failure state fails loudly.
☐ Required failure states fail loudly.
☐ Release artifacts are generated from the merged runtime.
☐ Final completion status is backed by current smoke evidence.

## Critical Blockers

✅ A merged runtime exists.
☐ No merged route registry exists yet.
☐ Full merged smoke proof is incomplete because only focused route smoke and standalone browser smoke have passed so far.
☐ Dynasty donor secure-defaults gate currently fails.
✅ Primary frontend build proof now exists in `SuperIDEv3.8/`.
☐ Runtime readiness fails with config blockers: `auth-secret-default`, `stripe-secret-missing`, `stripe-webhook-secret-missing`, and missing submission endpoints for `apple_books`, `kobo`, `kdp_ebook`, and `kdp_print_prep`.

## Immediate Next Work

1. Replace ad hoc route aliasing with one explicit merged route registry inside the app shell.
2. Extend embedded `SkyeDocxMax` parity smoke beyond route/embed proof into editor save, export/import, governance, and cross-app handoff behavior.
3. Clear runtime readiness blockers by replacing default auth secrets and wiring payment and submission configuration.
4. Connect the shell’s existing older frontend API calls to the lifted canonical `/api/*` server routes.
5. Run the remaining merged-runtime API, embedded-app, and persistence smoke against the new target.

## Non-Negotiable Merge Rules

☐ Do not replace Neural Space Pro with a generic panel.
☐ Do not replace SkyeChat with a decorative panel.
☐ Do not downgrade SkyeDocxPro donor behavior to a plain textarea while renaming it.
☐ Do not remove donor folders before merged-runtime parity is proven.
☐ Do not call payment complete without route proof and boundary proof.
☐ Do not call submission live without boundary proof.
☐ Do not call any route complete until UI and smoke both verify it.
☐ Do not raise completion status from docs alone.
