# IN-ORDER INTEGRATION PLAN

## Non-destructive rule for the next real build
No code changes happen until this plan is accepted. When coding is approved, the work should start with file backups, targeted module extraction, and one wave at a time in directive order.

## First honesty pass before any coding
The current directive has one real contradiction that must be normalized before implementation:
- Section 6.4 still leaves route-pack items blank.
- Section 8 already marks route-pack export/import/duplicate-warning as complete.

That must be resolved first so the checklist stays honest.

## Locked donor rule
Use project-doc donors only. Default donors for the remaining work:
- `SuperIDEv2-full-2026-03-09.zip`
- `skydex3.2-agent-command-deck-upgrade.zip`
- `skyetime-hour-logger.zip`
- `SkyeVaultPro-vaultedskye.netlify.app-drive.zip`

Keep `FULLY AGENTsuperide-agent.zip` and `kAIx4nthi4-4.6-deep-refactor.zip` out of the offline MVP unless a later optional hybrid lane is explicitly approved.

## Wave 0 — earliest unchecked items in order
These are the earliest unresolved directive items and must be handled before later roadmap items.

### 0.1 Outcome source-of-truth normalization
Directive items:
- Every outcome state must have a clean source of truth.
- Every quick action added to AE FLOW or Routex must have a working storage path, visible UI confirmation, and export impact where relevant.
- Any feature that needs exact location must clearly state whether it is using exact address, partial address, territory fallback, or manual stop text.
- No lane is complete until tested with new records, legacy records, import/export, and restore.

Planned implementation shape:
- Add one canonical outcome registry shared by AE FLOW and Routex.
- Add one route-location provenance badge system with four fixed labels: exact-address, partial-address, territory-fallback, manual-stop.
- Add one quick-action write-through layer so every quick tap writes to the same canonical stores as the full edit modal.
- Add one export contract table so proof packet, CSV, day ledger, and route pack all read the same normalized values.
- Add one local verification harness using seed fixtures for new records and legacy records.

Primary donors:
- `skyetime-hour-logger/src/lib/core.js` for stable stringify, hash, and export-proof patterns.
- `SuperIDEv2-full-2026-03-09.zip/docs/export-import-fixtures.json` for fixture-driven import/export testing.
- `SuperIDEv2-full-2026-03-09.zip/docs/SMOKE_CONTRACT_MATRIX.md` for a contract-style proof matrix.
- `SkyeVaultPro/assets/js/local-vault.js` for storage normalization patterns.

### 0.2 Signed service summary / delivery confirmation
Directive item:
- Generate a signed service summary or delivery confirmation.

Planned implementation shape:
- Add a generated HTML summary document that binds stop, client, route, outcome, signature, timestamp, proof photos, and notes.
- Save that artifact into the doc vault as a first-class generated document.
- Make it printable offline and pack it into proof packet export.

Primary donors:
- `skyetime-hour-logger/src/lib/core.js` for offline PDF/line-builder logic.
- `SkyeVaultPro/apps/docx/index.html` and `assets/js/local-vault.js` for generated-doc save patterns.

### 0.3 Route-pack honesty normalization
Directive items currently blank in 6.4:
- Export an offline route pack with all stops, notes, documents, proof, and economics.
- Allow import/restore of a route pack into another device copy of the app.
- Add merge/duplicate warning behavior during import.

Plan:
- Do not code this until the directive contradiction is resolved.
- The plan is to split route-pack status into two levels:
  1. base route-pack already landed
  2. full route-pack with docs, proof, economics completeness
- Only the second level should remain open after normalization.

Primary donors:
- `SkyeVaultPro/assets/js/local-vault.js`
- `SuperIDEv2-full-2026-03-09.zip/docs/export-import-fixtures.json`

## Wave 1 — remaining offline-first roadmap blanks in order

### 1.1 QR / code-based quick account lookup
Directive items:
- Generate a quick account code or QR.
- Allow instant lookup of a client record in the field.
- Use it for proof packets, service slips, or handoff confirmation.

Planned implementation shape:
- Start with deterministic short account codes first.
- Add QR rendering only after the short-code contract is fixed.
- Add a lightweight field lookup surface in both AE FLOW and Routex.
- Add account code and QR block to proof sheets, service slips, and delivery confirmation docs.

Primary donors:
- `skydex3.2-agent-command-deck-upgrade.zip` for dashboard / command surface patterns.
- `skyetime-hour-logger` for export-proof formatting.
- `SkyeVaultPro` for storing the generated lookup artifact.

### 1.2 Voice-note lane
Directive items:
- Store voice note attachments when supported by the device/browser.
- Attach them to the stop, route, or account.

Planned implementation shape:
- Device-capability gate first.
- Record locally into a media-note store.
- Attach by entity type plus entity id.
- Surface playback in dossier, stop view, and route detail.
- Include voice-note references in backup, restore, and route-pack export.

Primary donors:
- `SkyeVaultPro/assets/js/local-vault.js` for blob/media persistence.
- `skydex3.2-agent-command-deck-upgrade.zip` for media-panel UI patterns.

### 1.3 Lead heat / account potential scoring
Directive items:
- Score accounts by visit success, route cost, repeat value, collections health, and freshness.
- Use the score to prioritize future routes.

Planned implementation shape:
- Build one deterministic local scoring engine with explicit weights.
- Surface the score in AE FLOW list, dossier, builder, and Routex queue suggestions.
- Keep the first version transparent with an inspectable score breakdown.

Primary donors:
- `skyetime-hour-logger` for metrics rollups and summary logic.
- `skydex3.2-agent-command-deck-upgrade.zip` for scorecard / command-center style UI.

### 1.4 Manual pseudo-map board
Directive items:
- Add a board view with ordered stop chips, travel notes, and directional text.
- Keep it offline and text-driven for now.
- Reserve true map APIs for optional future hybrid mode.

Planned implementation shape:
- Build a text-driven board only.
- No live maps in the offline MVP.
- Use ordered stop chips, manual travel notes, direction blocks, and route sequence panels.
- Integrate with drag-sort and next-stop mode.

Primary donors:
- `skydex3.2-agent-command-deck-upgrade.zip` for command-deck board layout patterns.
- `SuperIDEv2` public shell patterns for multi-panel layout behavior.

### 1.5 Multi-day trip packs
Directive items:
- Support routes that span multiple days.
- Track lodging, day closeouts, and daily route rollups inside one trip pack.

Planned implementation shape:
- Introduce trip entity above route.
- Route belongs to trip or standalone mode.
- Each trip gets day ledger slices, lodging entries, and per-day closeout.
- Trip pack export wraps all included routes plus aggregated economics.

Primary donors:
- `skyetime-hour-logger` for session/day rollup patterns.
- `SkyeVaultPro` for pack persistence.

## Wave 2 — optional hybrid adapters only after offline core is locked
Directive items:
- Optional geocoding/map enrichment when online.
- Optional sync between devices.
- Optional push-to-calendar for follow-ups.
- Optional cloud backup mirror.
- Optional live traffic/map APIs.
- Optional customer messaging triggers.

Plan:
- Treat each hybrid tie-in as a separate adapter module.
- None of these should alter the offline schema contract.
- None of these should be allowed to own the source of truth.
- These should remain disabled by default.

Allowed donor pool for this wave only:
- `FULLY AGENTsuperide-agent.zip`
- `kAIx4nthi4-4.6-deep-refactor.zip`
- `SuperIDEv2-full-2026-03-09.zip`

## Wave 3 — global definition-of-done enforcement
Directive items:
- The feature works in AE FLOW and/or Routex where expected.
- The feature persists after reload.
- The feature survives export and import where applicable.
- The feature behaves correctly on fresh records and older legacy records.
- The feature has no dead buttons or fake status states.
- The feature has at least one proof workflow tested end-to-end.
- The checkbox is changed to ✅ with a date and a proof note.

Plan:
- Convert these from passive checklist text into a required release gate for every wave.
- No feature gets a green check without a proof row and a fixture row.
- Keep the directive honest by linking each future check to a concrete proof artifact.

## Recommended implementation sequence when coding is approved
1. Normalize directive contradiction around route-pack status.
2. Finish Wave 0 completely.
3. Finish Wave 1 in exact order.
4. Leave Wave 2 disabled unless explicitly approved.
5. Use Wave 3 gate rules on every completed line item.
