# SkyeDocxMax Build Directive

Purpose: make the document lane outcome unambiguous before implementation starts.

## Final Outcome

✅ Build `SkyeDocxMax` as a standalone app.
☐ Embed `SkyeDocxMax` inside final `SuperIDEv3`.
☐ Replace `SkyeDocxPro` in final SuperIDEv3 navigation, route naming, app manifests, smoke plans, release notes, and operator-facing labels.
✅ Keep `SkyeDocxPro` only as a donor/source reference until parity is proven.

## Confirmed Donor Sources

✅ Dynasty lane includes `SkyeDocxPro/`.
✅ Dynasty lane includes `public/SkyeDocxPro/`.
✅ Dynasty lane includes `dist/SkyeDocxPro/`.
✅ Separate v13 donor exists at `SuperIDEv3/SkyeDocxPro-v13/SkyeDocxPro/SkyeDocxPro`.
✅ Dynasty README documents SkyeDocxPro enterprise controls, standalone path, product page path, and sync script behavior.

## Required SkyeDocxMax Capabilities

✅ Rich document editor is preserved or improved.
✅ Local document vault behavior is preserved where present.
✅ Save, autosave, reload recovery, and project state persistence work.
✅ `.skye` export/import works.
✅ Optional AES-GCM encrypted `.skye` export/import works where donor behavior exists.
✅ Recovery/failsafe kit behavior is preserved where donor behavior exists.
✅ Review console, comments, timeline, suggestion mode, templates, metadata, page breaks, and governance controls are preserved where donor behavior exists.
✅ Standalone local handoff outbox works when final SuperIDEv3 publishing API is unavailable.
✅ SkyeBlog handoff is queued through standalone bridge records for launch article or editorial reuse.
✅ SkyeChat/intelligence handoff is queued through standalone bridge/outbox records for document-aware collaboration.
✅ SkyeDrive/SkyeVault handoff is queued through standalone bridge/outbox records where those surfaces are present.
✅ Evidence lane records document export, import, publish, and cross-app handoff actions locally in standalone mode.

## Standalone App Requirements

✅ Standalone path: `/SkyeDocxMax/index.html`.
✅ Standalone product page: `/SkyeDocxMax/homepage.html`.
✅ Standalone manifest names the app `SkyeDocxMax`.
✅ Standalone service worker/offline behavior is either preserved or explicitly replaced with stronger SuperIDEv3-compatible behavior.
✅ Standalone app can run without opening the full SuperIDEv3 shell.
✅ Standalone app can authenticate or degrade gracefully according to final auth rules.

## Embedded SuperIDEv3 Requirements

☐ Embedded route: `/skydocxmax`.
☐ Legacy route: `/skydocx` redirects or aliases to `/skydocxmax`.
☐ SuperIDEv3 app launcher shows `SkyeDocxMax`, not `SkyeDocxPro`.
☐ Embedded app uses shared SuperIDEv3 auth/session state.
☐ Embedded app uses shared SuperIDEv3 persistence where configured.
☐ Embedded app communicates with publishing, catalog, commerce, SkyeBlog, SkyeChat, and evidence lanes through typed contracts.

## Anti-Theater Rules

✅ Do not call standalone rename complete unless every visible standalone label, route, manifest, smoke test, and release note uses `SkyeDocxMax`.
✅ Do not call standalone complete unless `/SkyeDocxMax/index.html` loads and passes editor/export/import smoke.
☐ Do not call embedded complete unless `/skydocxmax` loads inside SuperIDEv3 and passes editor/export/import/cross-app smoke.
☐ Do not delete or archive SkyeDocxPro donor paths until SkyeDocxMax parity smoke passes.
☐ Do not mark communication complete unless real code moves document context across app boundaries and the smoke checks prove the receiving lane changed state.

## First Implementation Order

✅ Inventory donor SkyeDocxPro features and controls.
✅ Create `SuperIDEv3/SkyeDocxMax/` as the standalone app location.
✅ Port the strongest SkyeDocxPro standalone app into SkyeDocxMax naming.
✅ Preserve behavior first; improve architecture only after parity is proven.
✅ Add standalone smoke for load, save, export, import, encrypted import/export, and reload persistence.
☐ Embed SkyeDocxMax in SuperIDEv3 route/navigation registry.
☐ Add cross-app contracts for publishing, catalog, SkyeBlog, SkyeChat, storage, and evidence.
☐ Add embedded smoke for route, editor, save, export/import, publishing handoff, and evidence record.
☐ Retire final-facing SkyeDocxPro labels only after smoke passes.
