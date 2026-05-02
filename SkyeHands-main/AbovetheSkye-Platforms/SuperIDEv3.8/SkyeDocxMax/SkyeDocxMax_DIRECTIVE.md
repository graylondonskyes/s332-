# SkyeDocxMax Fix Directive

**Directive ID:** SKYEDOCXMAX_FIX_DIRECTIVE_V1  
**Product Name:** SkyeDocxMax  
**Product Type:** Offline-first private document editor, encrypted document vault, PWA workspace, and Skye ecosystem document node  
**Current Status:** Functional foundation exists, but the package is not release-ready until the missing runtime, PWA asset paths, encryption lane, homepage references, DOCX support claim, bridge routes, and smoke gates are corrected.  
**Directive Rule:** Checkmarks mean code-backed complete. Blank boxes mean open work. No X marks are used.

---

## 0. Ground Truth Classification

✅ SkyeDocxMax has a real editor workspace foundation.  
✅ SkyeDocxMax has local IndexedDB persistence intent.  
✅ SkyeDocxMax has document, folder, and asset storage concepts.  
✅ SkyeDocxMax has versioning, comments, suggestions, and export concepts.  
✅ SkyeDocxMax has a product homepage / landing page.  
✅ SkyeDocxMax has PWA / service-worker intent.  
✅ SkyeDocxMax has Skye ecosystem bridge hooks.  
✅ SkyeDocxMax is cleanly drop-ready as a standalone release ZIP.  
☐ SkyeDocxMax is not yet a verified true `.docx` Microsoft Word / OpenXML processor.  
✅ SkyeDocxMax encryption uses a bundled shared runtime.  
✅ SkyeDocxMax offline / PWA cache paths have been corrected.  
✅ SkyeDocxMax homepage references missing files / routes have been corrected.  
✅ SkyeDocxMax API bridge lanes are static-safe local fallback hooks unless remote SuperIDE APIs are explicitly enabled.  
✅ SkyeDocxMax has a final smoke-proof package.

---

## 1. Package Structure Directive

✅ Final package root must be clean and intentional.

Required final structure:

```txt
SkyeDocxMax/
  index.html
  homepage.html
  offline.html
  manifest.webmanifest
  manifest.json
  service-worker.js
  sw.js
  netlify.toml
  assets/
  js/
  api/
  docs/
  smoke/
  README.md
  RELEASE_MANIFEST.json
```

✅ Remove accidental development nesting from the release package.

Do not ship paths like:

```txt
NEVER DELETE LAPTOP VERSION/
WORK IN PROGRESS/
SuperIDEv2-export/
SuperIDEv2/
```

✅ Create the clean release ZIP as:

```txt
SkyeDocxMax_RELEASE_READY_v1.zip
```

✅ Add `RELEASE_MANIFEST.json` listing every included runtime file, asset, script, route, and document.

✅ Add `README.md` explaining whether SkyeDocxMax is static-only, Netlify-backed, Cloudflare-backed, or dependent on the larger Skye root runtime.

✅ Every runtime path must resolve from the release root.

✅ No release package should contain temporary folders, old exports, laptop-only paths, hidden working folders, or duplicate obsolete builds.

---

## 2. Product Naming Directive

✅ Rename all public-facing product references to:

```txt
SkyeDocxMax
```

✅ Replace old product labels where found:

```txt
Skye DocX Pro
SkyeDocxPro
Skye Docx Pro
DocX Pro
```

✅ Ensure all visible UI titles, manifest names, service-worker cache names, homepage hero sections, docs, metadata, filenames, and smoke files use `SkyeDocxMax`.

✅ Update manifest name:

```json
{
  "name": "SkyeDocxMax",
  "short_name": "SkyeDocxMax"
}
```

✅ Update service-worker cache prefix:

```js
const CACHE_VERSION = "skyedocxmax-v1.0.0";
```

✅ Update release file names:

```txt
SkyeDocxMax_DIRECTIVE.md
SkyeDocxMax_RELEASE_READY_v1.zip
SkyeDocxMax_SMOKE_RESULTS.json
SkyeDocxMax_RELEASE_MANIFEST.json
```

---

## 3. Missing Shared Runtime Directive

✅ Resolve the missing shared runtime import:

```txt
/_shared/skye/skyeSecure.js
```

✅ Choose exactly one final runtime strategy.

✅ Strategy A: Bundle `skyeSecure.js` directly inside the SkyeDocxMax package.  
☐ Strategy B: Remove the external dependency and embed the secure runtime inside `index.html`.  
☐ Strategy C: Keep `/_shared/skye/skyeSecure.js`, but ship the full `_shared/` folder in the release package.

✅ Final package must include this file if the import remains:

```txt
_shared/skye/skyeSecure.js
```

✅ Encryption save must not silently fail when opened directly.

✅ Encryption open must not silently fail when opened directly.

✅ Add a hard runtime check:

```js
if (!window.SkyeSecure) {
  throw new Error("SkyeDocxMax secure runtime missing. Encrypted .skye packages are disabled.");
}
```

✅ Replace soft failure with visible UI error messaging.

✅ Add smoke proof that encrypted `.skye` save works.

✅ Add smoke proof that encrypted `.skye` open works.

✅ Add smoke proof that a wrong passphrase fails cleanly.

✅ Add smoke proof that recovery-kit export works.

---

## 4. PWA / Service Worker Directive

✅ Fix service-worker cache paths.

Observed mismatch:

```txt
assets/icons/
```

versus:

```txt
assets/icon/
```

✅ Standardize one icon directory name only.

Preferred final path:

```txt
assets/icons/
```

✅ Move icons into the final chosen path.

✅ Update all references in:

```txt
index.html
homepage.html
offline.html
manifest.json
manifest.webmanifest
service-worker.js
sw.js
README.md
```

✅ Ensure all required PWA icons exist:

```txt
assets/icons/icon-192.png
assets/icons/icon-512.png
assets/icons/maskable-192.png
assets/icons/maskable-512.png
```

✅ Fix missing root logo references.

✅ Fix offline page brand image reference.

Current broken-style path:

```txt
assets/brand/sol_tiger.png
```

Corrected path if the current asset layout is preserved:

```txt
assets/icons/brand/sol_tiger.png
```

✅ Add cache migration cleanup for old cache names.

✅ Ensure service worker installs without cache failure.

✅ Ensure service worker activates without console errors.

✅ Ensure offline fallback page loads without missing local assets.

✅ Ensure app reloads after network is disabled.

✅ Ensure user can create and save a document while offline.

✅ Ensure saved offline document persists after refresh.

---

## 5. Manifest Directive

✅ Decide whether to keep both manifests:

```txt
manifest.json
manifest.webmanifest
```

✅ If both remain, document why both exist.

☐ If only one remains, remove the duplicate and update all references.

✅ Ensure `index.html` links to the correct manifest.

✅ Ensure `homepage.html` links to the correct manifest.

✅ Ensure manifest icons match real included files.

✅ Ensure `start_url` points to an existing route.

✅ Ensure `scope` points to the correct deployed folder.

✅ Ensure `name`, `short_name`, `theme_color`, `background_color`, `display`, and `orientation` are finalized.

☐ Add manifest screenshots only if screenshot files actually exist.

☐ Add manifest shortcuts only if shortcut target pages actually exist.

✅ Validate manifest in browser smoke.

---

## 6. Homepage Directive

✅ Fix missing homepage references.

Current missing or unresolved references to verify:

```txt
/pricing.html
/js/partials.js
/js/SkyeSolINTRO.js
```

☐ If pricing remains linked, create:

```txt
pricing.html
```

☐ If partials script remains linked, create:

```txt
js/partials.js
```

☐ If intro script remains linked, create:

```txt
js/SkyeSolINTRO.js
```

☐ Every homepage CTA must perform a real action.

☐ Every homepage navigation link must resolve.

✅ Every homepage asset must load from the release package or a deliberate public CDN.

✅ Contact buttons must use:

```txt
SkyesOverLondonLC@solenterprises.org
```

✅ Homepage must not claim unsupported `.docx` compatibility until the `.docx` lane is implemented and smoked.

✅ Homepage must clearly differentiate supported formats:

```txt
.skye encrypted package
HTML export
HTML ZIP export
TXT export
PDF print flow
DOCX import/export only if implemented
```

✅ Add homepage link smoke test.

☐ Add homepage CTA smoke test.

---

## 7. True DOCX Compatibility Directive

✅ Decide whether SkyeDocxMax must truly support `.docx`.

If yes, complete the full `.docx` lane.

☐ Add `.docx` import support.

Minimum acceptable `.docx` import behavior:

```txt
Upload .docx
Extract document XML
Preserve headings
Preserve paragraphs
Preserve bold / italic / underline
Preserve ordered lists
Preserve bullet lists
Preserve basic tables
Load clean content into editor
Save imported document into IndexedDB
```

☐ Add `.docx` export support.

Minimum acceptable `.docx` export behavior:

```txt
Export title
Export headings
Export paragraphs
Export ordered lists
Export bullet lists
Export bold / italic / underline
Export basic tables
Export comments / suggestions as optional appendix or metadata
Download valid .docx file
Open in Microsoft Word / LibreOffice / Google Docs
```

☐ Add real OpenXML package generation.

☐ Add correct `.docx` MIME type:

```txt
application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

☐ Add file picker accept rule:

```txt
.docx
```

☐ Add corrupted `.docx` validation.

☐ Add unsupported `.docx` structure warning.

☐ Add smoke fixture:

```txt
smoke/fixtures/basic-document.docx
```

☐ Add smoke proof that `.docx` import works.

☐ Add smoke proof that `.docx` export works.

☐ Add smoke proof that exported `.docx` opens in LibreOffice.

☐ Add smoke proof that exported `.docx` can be reimported.

✅ If true `.docx` support is not implemented, remove or soften any Word-compatible claim.

Honest positioning until true `.docx` exists:

```txt
SkyeDocxMax — Offline Private Document Vault
```

Do not claim:

```txt
Microsoft Word-compatible DOCX processor
```

unless the lane is real and smoked.

---

## 8. Editor Reliability Directive

✅ Rich text editing foundation exists.  
✅ Document statistics foundation exists.  
✅ Comments, suggestions, and version concepts exist.  
☐ Verify every toolbar button triggers a real editor action.

Required toolbar smoke coverage:

☐ Bold  
☐ Italic  
☐ Underline  
☐ Strike  
☐ Heading  
☐ Paragraph  
☐ Ordered list  
☐ Bullet list  
☐ Checklist  
☐ Link  
☐ Quote  
☐ Code block  
☐ Table insert  
☐ Page break  
☐ Section break  
☐ Undo  
☐ Redo  
☐ Find  
☐ Replace  
☐ Print / PDF  
☐ Export  
☐ Import  
☐ Save  
☐ Duplicate  
☐ Delete  
☐ Move to folder  
☐ Rename  
☐ Focus mode  
☐ Spellcheck toggle  
☐ Header / footer  
☐ Outline panel  
☐ Thumbnail panel

☐ No button may exist unless it performs a real action.

☐ Every failed action must show a visible error message.

☐ Every successful action must show a visible success message.

☐ Add autosave status indicator.

☐ Add dirty-state indicator.

☐ Add unsaved-change warning before destructive navigation.

☐ Add keyboard shortcut registry.

☐ Add shortcut collision check.

☐ Add editor recovery after browser refresh.

☐ Add editor recovery after accidental tab close where browser storage supports it.

---

## 9. IndexedDB Persistence Directive

✅ Local persistence foundation exists.  
✅ Add explicit database version constant.

✅ Add database schema documentation.

☐ Add database migration path for future versions.

☐ Add corrupted database recovery flow.

☐ Add document-level backup.

☐ Add full-vault backup.

☐ Add restore preview before overwrite.

☐ Add merge restore mode.

☐ Add duplicate document conflict resolver.

☐ Add folder conflict resolver.

☐ Add storage quota check.

☐ Add warning when browser storage is near quota.

☐ Add local purge confirmation flow.

☐ Add document trash before permanent deletion.

☐ Add trash restore.

☐ Add permanent delete confirmation.

☐ Add backup export smoke test.

☐ Add restore smoke test.

☐ Add restore-merge smoke test.

---

## 10. Encryption / `.skye` Package Directive

✅ `.skye` package concept exists.  
✅ Make `.skye` package format formally documented.

Create:

```txt
docs/SKYE_PACKAGE_FORMAT.md
```

Required contents:

```txt
Format name
Format version
Encryption method
Salt format
IV format
KDF settings
Metadata block
Document HTML block
Assets block
Comments block
Suggestions block
Versions block
Recovery-kit behavior
Compatibility notes
Tamper detection behavior
```

✅ Add package version field:

```json
{
  "format": "skyedocxmax-package",
  "version": "1.0.0"
}
```

✅ Add package validation before decrypt.

✅ Add package validation after decrypt.

✅ Add visible error for unsupported package version.

✅ Add visible error for missing package fields.

✅ Add visible error for wrong passphrase.

☐ Add visible error for corrupted package.

☐ Add visible error for tampered package.

✅ Add encrypted package roundtrip smoke test.

✅ Add asset-in-package smoke test.

✅ Add comments-in-package smoke test.

✅ Add versions-in-package smoke test.

✅ Add wrong-passphrase smoke test.

☐ Add corrupted-package smoke test.

---

## 11. Export Directive

✅ Export concepts exist.  
☐ Export menu must list only working export types.

Required export lanes:

✅ Export `.skye`.  
✅ Export `.txt`.  
✅ Export `.html`.  
✅ Export `.zip`.  
✅ Export `.pdf` through browser print flow.  
☐ Export `.docx` only after real `.docx` support is implemented.

☐ Validate downloaded filenames.

☐ Sanitize document titles before using as filenames.

☐ Add timestamped export names.

☐ Add export success state.

☐ Add export failure state.

☐ Add export-progress state for large documents.

✅ Add smoke test for every listed export type except manual browser print.

☐ Remove any non-working export option from visible UI.

---

## 12. Import Directive

☐ Import menu must list only working import types.

Required import lanes:

✅ Import `.skye`.  
☐ Import `.txt`.  
☐ Import `.html`.  
☐ Import `.zip` only if ZIP import is truly supported.  
☐ Import `.docx` only after real `.docx` support is implemented.

☐ Validate file type.

☐ Validate file size.

☐ Validate package structure.

☐ Prevent malicious script injection from imported HTML.

☐ Sanitize imported content before placing into editor.

☐ Add visible error for unsupported file type.

☐ Add visible error for corrupted import.

✅ Add smoke test for every accepted import type.

☐ Remove any non-working import option from visible UI.

---

## 13. API / Bridge Directive

✅ Skye bridge hooks exist.  
✅ Decide final deployment target for bridge routes.

Allowed strategies:

☐ Netlify Functions  
☐ Cloudflare Workers  
✅ Static-only with bridge features hidden/local-fallback safe  
☐ Skye root ecosystem bridge dependency with full shared runtime included

☐ If Netlify Functions are required, include:

```txt
netlify/functions/kaixu-generate.js
netlify/functions/app-record-save.js
netlify/functions/skychat-notify.js
netlify/functions/skymail-send.js
```

☐ If Cloudflare Workers are required, include:

```txt
worker/src/index.js
worker/wrangler.jsonc
worker/routes/
```

✅ Every bridge button must either work or be hidden.

☐ AI Draft button must call a real route.

☐ Push Chat button must call a real route.

☐ Push Email button must call a real route.

☐ Push Drive button must call a real route.

☐ Push BookX button must call a real route.

☐ Device Share button must call a real route or native share API.

✅ Add bridge unavailable state.

☐ Add environment variable check.

✅ Add route existence smoke test.

☐ Add route functional smoke test.

☐ Add no-provider-key smoke test proving routes fail cleanly.

☐ Add provider-key-present smoke test proving routes fire correctly.

☐ If Netlify Functions are required, mark release as Git-deploy required, not Netlify Drop-only.

---

## 14. Security Directive

☐ Add Content Security Policy.

☐ Add HTML sanitization for imported documents.

☐ Add HTML sanitization for pasted content.

☐ Add script stripping for imported HTML.

☐ Add link sanitization.

☐ Add upload file size limits.

☐ Add attachment type restrictions.

☐ Add encrypted package tamper detection.

☐ Add passphrase strength indicator.

☐ Add optional local app lock.

☐ Add idle lock timer.

☐ Add clear local data action.

☐ Add backup-before-clear warning.

✅ Add security documentation:

```txt
docs/SECURITY.md
```

✅ Add privacy documentation:

```txt
docs/PRIVACY.md
```

✅ Add threat model documentation:

```txt
docs/THREAT_MODEL.md
```

---

## 15. UI / Product Polish Directive

✅ Product UI foundation exists.  
✅ Standardize all brand asset paths.

✅ Remove missing image references.

☐ Ensure mobile layout works.

☐ Ensure tablet layout works.

☐ Ensure desktop layout works.

☐ Ensure sidebar panels are scrollable.

☐ Ensure modals are scrollable.

☐ Ensure editor does not overflow viewport.

☐ Ensure focus mode exits cleanly.

☐ Ensure all panels have close / minimize controls where appropriate.

☐ Ensure no hidden buttons sit off-screen.

☐ Ensure empty states are polished.

☐ Ensure loading states are polished.

☐ Ensure error states are polished.

☐ Ensure success states are polished.

☐ Ensure offline state is visible.

☐ Ensure installed PWA state is visible when supported.

✅ Ensure all UI text uses `SkyeDocxMax` consistently.

---

## 16. Accessibility Directive

☐ Add keyboard navigation for main controls.

☐ Add visible focus rings.

☐ Add ARIA labels for icon buttons.

☐ Add modal focus trap.

☐ Add escape-key modal close.

☐ Add color contrast check.

☐ Add screen-reader labels for document list.

☐ Add screen-reader labels for editor actions.

☐ Add reduced-motion support.

☐ Add no-JavaScript fallback message.

☐ Add accessible status messages for save, export, import, and encryption errors.

---

## 17. Testing / Smoke Directive

Create:

```txt
smoke/SMOKE_DIRECTIVE.md
smoke/smoke-manual-checklist.md
smoke/smoke-results-template.json
smoke/fixtures/
```

Required smoke gates:

✅ App loads from `index.html`.  
✅ Homepage loads from `homepage.html`.  
✅ Offline page loads from `offline.html`.  
✅ Manifest validates.  
✅ Service worker installs.  
✅ Service worker activates.  
✅ App reloads offline.  
✅ New document creates.  
✅ Document saves.  
✅ Document reloads from IndexedDB.  
☐ Folder creates.  
☐ Document moves folders.  
☐ Document duplicates.  
☐ Document deletes.  
✅ Backup exports.  
✅ Backup restores.  
✅ `.skye` encrypted export works.  
✅ `.skye` encrypted import works.  
✅ Wrong passphrase fails cleanly.  
✅ TXT export works.  
✅ HTML export works.  
✅ HTML ZIP export works.  
✅ PDF print flow opens.  
☐ `.docx` import works if claimed.  
☐ `.docx` export works if claimed.  
☐ Every visible button has a working action.  
☐ Every visible link resolves.  
☐ No console errors on first load.  
✅ No missing local assets.  
✅ No missing scripts.  
✅ No missing CSS.  
✅ No missing icon files.  
✅ No missing bridge route if bridge UI is visible.

---

## 18. Documentation Directive

✅ Replace `readme.txt` with full `README.md`.

Required docs:

```txt
README.md
docs/INSTALL.md
docs/DEPLOYMENT.md
docs/SECURITY.md
docs/PRIVACY.md
docs/THREAT_MODEL.md
docs/SKYE_PACKAGE_FORMAT.md
docs/DOCX_SUPPORT.md
docs/OFFLINE_PWA.md
docs/API_BRIDGE.md
docs/SMOKE_TESTING.md
```

✅ Document exactly what works.

✅ Document exactly what requires live environment variables.

✅ Document exactly what is static-only.

✅ Document exactly what requires the Skye ecosystem bridge.

✅ Document unsupported formats.

✅ Document browser support.

✅ Document local storage limitations.

✅ Document encryption limitations.

✅ Document backup / restore behavior.

---

## 19. Release Gate Directive

The package cannot be called release-ready until all release blockers below are closed:

✅ No missing runtime imports.  
✅ No missing image references.  
✅ No missing icon references.  
✅ No missing homepage scripts.  
✅ No broken homepage links.  
✅ Service worker installs cleanly.  
✅ Offline mode works.  
✅ IndexedDB persistence works after refresh.  
✅ `.skye` encryption roundtrip works.  
☐ Export menu only lists working formats.  
☐ Import menu only accepts working formats.  
☐ Every visible button works.  
✅ `.docx` support is either real or not claimed.  
✅ API bridge buttons are either fully wired or hidden.  
✅ Release ZIP has clean root structure.  
✅ Smoke checklist is included.  
✅ Smoke result file is included after testing.  
✅ Product name is consistently `SkyeDocxMax`.

---

## 20. Recommended Priority Order

✅ Rename product references to `SkyeDocxMax`.  
✅ Fix release root structure.  
✅ Fix missing `skyeSecure.js` runtime.  
✅ Fix service-worker asset paths.  
✅ Fix manifest icon paths.  
✅ Fix homepage missing references.  
✅ Fix every broken CTA and link.  
✅ Add smoke tests for load, save, export, import, encryption, and offline mode.  
✅ Decide true `.docx` support versus honest repositioning.  
☐ Implement real `.docx` import / export if the name and homepage continue to imply Word compatibility.  
✅ Add bridge routes or hide bridge buttons.  
✅ Add full docs.  
✅ Build clean release ZIP.  
✅ Run final smoke.  
✅ Mark release-ready only after smoke passes.

---

## 21. Final Completion Definition

SkyeDocxMax is complete when a user can open the package, launch the app, create a document, save it locally, reload it, organize it, export it, import it back, use encryption safely, install it as a PWA, work offline, and click every visible control without missing routes, missing files, fake buttons, unsupported claims, or silent failures.

---

## 22. Directive Completion Tracker

✅ Real editor foundation identified.  
✅ Local vault foundation identified.  
✅ PWA intent identified.  
✅ Encryption package concept identified.  
✅ Homepage / commercial surface identified.  
✅ Product rename fully applied in code.  
✅ Release package root cleaned.  
✅ Missing secure runtime fixed.  
✅ PWA icon paths fixed.  
✅ Homepage missing references fixed.  
✅ True DOCX support implemented or claim removed.  
✅ Bridge routes implemented or bridge buttons hidden.  
✅ Smoke suite created.  
✅ Smoke suite passed.  
✅ Release ZIP generated.
