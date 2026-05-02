# SkyeDocxMax Donor Feature Inventory

Source donor: `SuperIDEv3/SkyeDocxPro-v13/SkyeDocxPro/SkyeDocxPro`

Standalone target: `SuperIDEv3/SkyeDocxMax`

Status date: 2026-04-27

## Preserved Standalone Surfaces

✅ Product homepage: `homepage.html`
✅ Editor app: `index.html`
✅ Offline fallback: `offline.html`
✅ PWA manifests: `manifest.json`, `manifest.webmanifest`
✅ Service worker: `service-worker.js`
✅ Local icon assets: `assets/icons/*`

## Preserved Editor/Vault Capabilities

✅ Rich document editor boot.
✅ Document creation.
✅ Local IndexedDB document vault.
✅ Document search/list.
✅ Autosave.
✅ Reload persistence.
✅ Version snapshots.
✅ Backup/restore code path retained.
✅ Plain-text export.
✅ HTML ZIP export.
✅ Secure encrypted `.skye` export.
✅ Secure encrypted `.skye` import.
✅ Recovery/failsafe kit generation.
✅ Backward import compatibility for donor payloads tagged `SkyeDocxPro`.

## Preserved Governance Controls

✅ Suggestion mode.
✅ Suggestion log.
✅ Comment thread creation.
✅ Comments side panel.
✅ Version timeline modal.
✅ Document templates.
✅ Document metadata editor.
✅ Page break insertion.
✅ Encryption/recovery help modal.

## Preserved Cross-App/Communication Controls

✅ AI Draft button exists.
✅ Push Chat button exists.
✅ Push Email button exists.
✅ Push Blog button exists.
✅ Push Drive button exists.
✅ Push BookX button exists.
✅ Device share button exists.
✅ Standalone local outbox records are written when SuperIDE APIs are absent.
✅ Standalone local bridge records are written.
✅ Standalone local suite intent records are mirrored.
✅ Standalone local evidence records are written.

## Added Hardening

✅ Local `.skye` secure runtime: `_shared/skye/skyeSecure.js`.
✅ Local standalone auth/session helpers: `_shared/auth-unlock.js`, `_shared/standalone-session.js`.
✅ Local fallback runtime: `js/fallback-runtime.js`.
✅ Repo-local browser smoke support through SkyeHands `.ms-playwright`.
✅ Boot smoke: `smoke-standalone.mjs`.
✅ Full completion smoke: `smoke-full-standalone.mjs`.

## Not In Standalone Scope Yet

☐ Embedded `/skydocxmax` route inside final SuperIDEv3.
☐ Final SuperIDEv3 navigation replacement of SkyeDocxPro.
☐ Final SuperIDEv3 typed API contracts for `/api/skydocxmax/*`.
☐ SuperIDEv3-side receiving lanes for publishing/catalog/commerce/evidence.

Those items remain intentionally open until the standalone SkyeDocxMax lane is accepted and the SuperIDEv3 integration phase begins.
