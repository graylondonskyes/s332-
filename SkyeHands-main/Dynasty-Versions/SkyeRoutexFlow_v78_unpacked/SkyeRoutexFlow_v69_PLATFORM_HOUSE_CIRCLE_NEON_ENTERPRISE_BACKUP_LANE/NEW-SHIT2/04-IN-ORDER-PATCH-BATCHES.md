# 04 — IN-ORDER PATCH BATCHES

This is the actual implementation packet. Each batch is scoped to the app that already exists here.

## Batch 0 — system contract cleanup before more UI
### Purpose
Close the disconnect that keeps creating fake completion.

### Build inside AE FLOW + Routex
- lock one canonical `outcomeCode` map
- lock one canonical `locationMode` map
- add one shared quick-action event writer
- add one shared legacy hydrator for route, stop, task, doc, and account records
- add one shared export registration list so every new action can declare export impact

### Must touch
- Routex stop outcome handlers
- Routex quick-action handlers
- AE FLOW quick-action/task/result surfaces
- export builders already inside Routex
- backup/restore readers and writers

### Done when
- every outcome writes the same code set
- every quick action shows UI confirmation and writes exportable event data
- every stop visibly says exact / partial / territory fallback / manual
- one fresh record and one legacy record both survive reload and export

---

## Batch 1 — finish route-pack lane properly
### Purpose
Resolve the directive blanks around route packs.

### Build
- finalize pack export manifest
- include routes, stops, economics rows, linked docs, signatures, tasks, reminders, and location quality labels
- import as **new copies** with duplicate warnings
- merge preview before final import

### AE FLOW role
- allow route pack creation from filtered account groups or saved views
- allow account-side visibility into which route packs a client appears in

### Routex role
- actual pack export/import UI
- pack validation summary
- duplicate warnings
- merge or clone decision

### Exports
- route pack JSON
- route pack summary HTML

### Done when
- device A can export a route pack
- device B can preview it before import
- import warns on same-name same-date collisions
- imported copy preserves docs, economics, and task linkage

---

## Batch 2 — signature + signed service summary lane
### Purpose
Finish proof workflows instead of stopping at signatures as isolated assets.

### Build
- signature capture remains tied to stop and client
- generate signed service summary / delivery confirmation HTML from stored route + stop + signature data
- store generated summary in doc vault and export lanes

### AE FLOW role
- account history shows latest signed service summary
- account dossier can open the generated confirmation

### Routex role
- stop-level `Generate Service Summary` action
- route-level `Generate Delivery Confirmation` action when applicable
- generated docs land in doc vault and route pack export

### Done when
- one stop with signature can generate a stored signed summary
- exported proof packet includes summary and signature

---

## Batch 3 — QR/account-code lookup lane
### Purpose
Make field lookup fast without online dependency.

### Build
- generate compact account code for every account
- optionally generate QR payload from the same code
- Routex lookup modal can search by code or scan result text
- proof packets and service summaries show the code

### AE FLOW role
- account card / dossier shows code + print-safe QR asset
- account export includes code

### Routex role
- quick lookup by code
- start route / independent stop creation from scanned lookup result

### Done when
- account code resolves the correct client offline
- printed or exported doc carries the same code

---

## Batch 4 — voice-note lane
### Purpose
Finish media note support where supported by the browser/device.

### Build
- capability check for MediaRecorder
- record, attach, and persist voice note blobs or converted files
- attach to stop, route, or account
- include in backup/restore and route pack export metadata

### AE FLOW role
- account dossier can list voice notes
- tasks/reminders can reference latest voice note

### Routex role
- stop modal and route detail can record or attach voice note

### Done when
- supported devices can create and replay a voice note offline after reload
- unsupported devices fail gracefully without fake buttons

---

## Batch 5 — lead heat / account potential scoring
### Purpose
Turn route history into future priority.

### Build
- calculate heat from attempt/success ratio, freshness, collections health, cost pressure, and repeat value
- surface score and explanation
- use score in AE FLOW sorting and route-builder presets

### AE FLOW role
- heat badge on account cards
- saved views can filter by score band
- route builder can sort by heat descending

### Routex role
- route detail shows average heat of loaded stops
- closeout updates the underlying account heat inputs

### Done when
- score changes after real route outcomes and collections updates
- score persists, exports, and survives restore

---

## Batch 6 — manual pseudo-map board
### Purpose
Provide offline run support without pretending a real map exists.

### Build
- ordered stop chips
- manual directional text
- travel note block between stops
- focus mode and next-stop launch from the board

### AE FLOW role
- builder can pre-seed board notes from territory and route hint

### Routex role
- board view per route
- reorder persists back to stop order
- notes export into proof/pack/ledger where relevant

### Done when
- route can be run from board only
- reordering there persists everywhere else

---

## Batch 7 — multi-day trip packs
### Purpose
Handle routes that exceed one day without breaking daily economics.

### Build
- trip wrapper containing multiple route days
- lodging and daily rollups
- day-close inside trip-close
- trip-level summary export

### AE FLOW role
- account history can show trip-linked activity
- route builder can assign selected accounts into day 1 / day 2 / day 3 buckets

### Routex role
- trip create/edit
- per-day route assignment
- per-day closeout and trip summary

### Done when
- two-day route group can close each day separately and roll into one trip packet

---

## Batch 8 — finish definition-of-done machinery itself
### Purpose
Make the directive honest in practice, not only in wording.

### Build
- test checklist modal or internal validation pass per lane
- record fresh / legacy / export-import / restore proof states
- only then allow directive checkmark updates

### Done when
- no lane is marked complete without proof metadata

---

## Batch 9 — optional hybrid tie-ins only after offline directive completion
These are allowed later, not before:
- geocoding/map enrichment
- sync between devices
- push-to-calendar
- cloud mirror backup
- live traffic APIs
- customer messaging triggers

These remain optional enhancement lanes and must never become offline blockers.
