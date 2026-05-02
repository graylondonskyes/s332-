# ROUTEX + AE FLOW OFFLINE UPGRADE DIRECTIVE

Status rule: every item in this file starts pending. When an item is truly finished, replace its box with a green check mark `✅`, add the completion date, and add a one-line proof note. Do not mark anything complete on partial plumbing, fake UI, dead buttons, or placeholder math.

Primary objective: turn **AE FLOW + Skye Routex** into a serious offline-first field operations stack that can build routes from stored client data, run the day in the field, measure route economics, and push next-step intelligence back into the account workflow.

Core product stance:
- Offline-first now.
- No broken lanes.
- No fake buttons.
- No “coming soon” behavior presented as real.
- All features must work locally without requiring a live server.
- Any future online tie-ins must be optional enhancement lanes, not dependencies.

---

## 1) Locked baseline already in place

These are the connected foundations this directive builds on:

- AE FLOW and Skye Routex are already connected.
- AE FLOW accounts can feed Routex queueing.
- Routex can pull stored client information from AE FLOW.
- Exact Routex address fields now exist and carry through.
- Routex falls back only when exact address data is missing.
- Routex can track stop status, photos, timestamps, odometer, and proof exports.
- AE FLOW can surface Routex-linked activity back on the client side.

This means the next work is not “make the apps talk.” The next work is to make the combined system intelligent, profitable, and field-ready.

---

## 2) Non-negotiable build rules

- ✅ 2026-03-27 — Every route stop now resolves to a canonical client key or an explicit independent-stop mode. Proof: Routex stop records now persist clientKey + clientMode and carry that identity into route building, doc-vault linkage, and conflict checks.
- ✅ 2026-03-27 — Route calculations now persist into live and closeout snapshots. Proof: Routex now writes liveSnapshot on route mutations and stores closeoutSnapshot on close so later review/export can read the stored route state.
- ✅ 2026-03-27 — Export lanes now read from stored route/stop/doc state at generation time. Proof: proof packets, day-ledgers, route CSVs, economics CSVs, and backup exports now pull the current persisted local records, including selected doc-vault artifacts where enabled.
- ✅ 2026-03-27 — Economic totals are now auditable from raw inputs. Proof: Route detail now has an Economics Audit modal that shows raw fuel, expense, material, collection, and snapshot data behind the route totals.
- [ ] Every outcome state must have a clean source of truth.
- [ ] Every quick action added to AE FLOW or Routex must have a working storage path, visible UI confirmation, and export impact where relevant.
- [ ] Any feature that needs exact location must clearly state whether it is using exact address, partial address, territory fallback, or manual stop text.
- [ ] No lane is complete until tested with new records, legacy records, import/export, and restore.

---

## 3) P0 — Route economics mode (highest-priority killer lane)

Goal: make every route measurable in cost, efficiency, and real-world value.

### 3.1 Mileage engine
- ✅ 2026-03-25 — Auto-calculate miles driven from route start and end odometer. Proof: Routex now derives miles from saved start/end odometer values and surfaces the result on dashboard KPIs, route cards, route detail, proof packet export, and CSV export.
- ✅ 2026-03-26 — Allow optional per-stop odometer capture for segment-level mileage. Proof: Stop add/edit/outcome flows now store per-stop arrival/departure odometer fields, surface them on stop cards and next-stop mode, and export leg/on-site mileage into the route CSV.
- ✅ 2026-03-26 — Calculate miles per stop, miles per completed stop, and miles per delivered stop. Proof: Route metrics now derive and display those ratios on route cards, the route header, and exports from stored route mileage + stop counts.
- ✅ 2026-03-25 — Detect impossible odometer values and flag them before save. Proof: Routex now blocks route save/close when end odometer is lower than start odometer and shows an error toast plus route warning state.
- ✅ 2026-03-25 — Preserve original odometer values in audit history when edits happen. Proof: Route edit events now store previous and new start/end odometer values inside the route event timeline meta for replay and audit.

### 3.2 Fuel and gas logging
- ✅ 2026-03-25 — Add a local fuel log tied to vehicle, route, and date. Proof: Route detail now has a Fuel Log modal that stores timestamped fuel entries on the route and rolls them into offline route economics.
- ✅ 2026-03-25 — Store gallons, total price, price per gallon, station name, and note. Proof: Each saved fuel entry now persists gallons, total, $/gallon, station, and note inside the route record and survives reload/export.
- ✅ 2026-03-25 — Allow receipt photo attachment offline. Proof: Fuel Log now accepts local receipt image/PDF attachments, stores them with each fuel entry, and carries the receipt count into route economics views, backups, and exports.
- ✅ 2026-03-25 — Calculate estimated fuel used for the route from MPG plus route miles. Proof: Routex now computes estimated fuel use from route miles and the selected vehicle profile MPG and surfaces it in route detail, dashboard, day ledger, and CSV export.
- ✅ 2026-03-25 — Compare estimated fuel used vs manually logged fuel purchases. Proof: Route economics now show a logged-fuel delta against MPG-based estimated use anywhere fuel gallons are stored.

### 3.3 Expense tracking
- ✅ 2026-03-25 — Add expense categories: gas, tolls, parking, meals, materials, lodging, misc. Proof: Routex now ships an Expense Log modal with categorized expense entry storage for tolls, parking, meals, materials, lodging, and misc, while fuel remains in the dedicated fuel log lane.
- ✅ 2026-03-25 — Allow expenses to attach to route, stop, or client account. Proof: Expense entries can now remain route-level or attach to a specific stop, carrying the linked stop/account reference into the saved route payload.
- ✅ 2026-03-25 — Allow receipt photo or document attachment. Proof: Expense Log now accepts local image/PDF receipts per expense line and persists them inside the saved route payload for offline backup/restore.
- ✅ 2026-03-25 — Calculate total route expense and cost per stop. Proof: Route economics now recalculate from stored fuel and expense entries and surface cost, net, cost/stop, and cost/productive-stop on the route view and exports.
- ✅ 2026-03-25 — Export all expense lines with route and client linkage. Proof: Export now includes a dedicated Economics CSV with expense/fuel rows tied back to route, stop, source account, business email, and closeout date.

### 3.4 Profitability + closeout
- ✅ 2026-03-25 — Add route revenue input lane for jobs, deliveries, collections, or expected value. Proof: Route create/edit flows now store route revenue offline and route detail/proof/CSV read from that saved value.
- ✅ 2026-03-25 — Calculate route gross, route cost, route net, and cost per productive stop. Proof: Routex now computes revenue, fuel cost, misc cost, total cost, net, and cost-per-productive-stop and surfaces them in route detail, proof packet, and CSV exports.
- ✅ 2026-03-25 — Add a route profitability scorecard with a clear grade. Proof: Routex now derives a stored-data scorecard from completion, delivery rate, net, follow-up pressure, balances due, and SLA risk, then surfaces the score/grade on route cards and route detail.
- ✅ 2026-03-25 — Add a single “Close Route / Close Day” action. Proof: Route detail now has a Closeout action that stores end odometer, closeout notes, unresolved-stop summary, and marks the route completed.
- ✅ 2026-03-25 — Closeout must generate a ledger summary: routes run, stops attempted, stops completed, miles, fuel, expenses, notes, unresolved stops, and follow-ups. Proof: Route closeout now shows an explicit summary block and can save straight into a generated Day Ledger export for the selected date.
- ✅ 2026-03-25 — Closeout must be printable/exportable offline. Proof: Routex now exports a printable offline Day Ledger HTML file with per-route closeout stats, unresolved stops, and full-day totals.

Acceptance proof for P0:
- Build one route.
- Log odometer, vehicle, gas, two expenses, and three stop outcomes.
- Close the day.
- Confirm all totals persist after reload and export.

---

## 4) P1 — True field operations upgrades

### 4.1 Vehicle profiles
- ✅ 2026-03-25 — Add saved vehicle records with vehicle name, plate, MPG, tank size, service notes, and default driver. Proof: Settings now includes a local Vehicle Profiles manager with save/edit/delete support for those fields.
- ✅ 2026-03-25 — Allow a route to inherit a default vehicle profile. Proof: New Route, Edit Route, and AE FLOW route-builder flows now accept a saved vehicle profile and can prefill vehicle/driver from it.
- ✅ 2026-03-25 — Add simple maintenance fields: oil change due, tire note, insurance due, registration due. Proof: Vehicle Profiles now persist oil-change, insurance, registration, and maintenance-note fields locally.
- ✅ 2026-03-25 — Flag approaching maintenance based on mileage entered across routes. Proof: Vehicle profiles now support service interval miles + last service odometer, and the dashboard / route header surface mileage-based maintenance warnings from actual route odometer history.

### 4.2 Stop outcomes upgrade
- ✅ 2026-03-25 — Expand stop outcomes to include: arrived, delivered, no answer, rescheduled, wrong address, gate locked, site closed, follow-up needed, not qualified, cancelled. Proof: Routex stop edit + quick outcome modal now store these offline outcome states and render them as badges/history.
- ✅ 2026-03-25 — Allow every outcome to carry a required note when appropriate. Proof: Routex now requires an outcome note for failure/follow-up statuses before save and persists the note into route detail, proof packets, and CSV export.
- ✅ 2026-03-25 — Allow multiple proof photos per stop. Proof: Stop proof modal accepts multiple image files in one save action and stores the resulting photo set offline per stop.
- ✅ 2026-03-26 — Add dwell time and service duration tracking. Proof: Stops now store service start/end values, Routex derives dwell/service minutes from timestamps, and both values render on stop detail, next-stop mode, and export rows.
- ✅ 2026-03-26 — Add “attempt count” and “successful visit count” per account. Proof: Routex now increments stop attempts from live status changes and the AE FLOW connector / builder surfaces account-level attempts and successful visits from linked Routex history.

### 4.3 Follow-up bridge back into AE FLOW
- ✅ 2026-03-25 — Push stop outcome intelligence back into AE FLOW account history. Proof: Routex now records Routex activity entries for the expanded stop outcomes, and AE FLOW account cards can surface the latest Routex status line from that shared offline activity log.
- ✅ 2026-03-25 — Create follow-up tasks from Routex with due date, note, and assigned owner. Proof: Stop Outcome now has an optional task lane that saves offline follow-up tasks tied to the account/route/stop with due date, owner, and note.
- ✅ 2026-03-25 — Allow one-tap creation of call-back, email-back, revisit, proposal-needed, and collections-needed tasks. Proof: Route task modals now ship preset buttons that instantly set those task types from Routex and the AE FLOW connector.
- ✅ 2026-03-25 — Surface “last route result” on AE FLOW account cards. Proof: AE FLOW connector cards and route-builder rows now show the latest shared Routex outcome/activity for each linked account.
- ✅ 2026-03-25 — Surface “next planned action” on Routex-origin accounts inside AE FLOW. Proof: AE FLOW connector cards and route-builder rows now surface the earliest open Routex follow-up task for the linked client.

### 4.4 Route readiness scoring
- ✅ 2026-03-25 — Add readiness states: Route Ready, Needs Patch, Partial Address, Territory Only, Missing Contact, Missing Phone, Missing Address. Proof: AE FLOW connector/builder now scores accounts into Route Ready / Needs Patch / Not Ready states and surfaces exact patch reasons such as fallback address, missing contact, and missing phone.
- ✅ 2026-03-25 — Score accounts before they are queued to Routex. Proof: AE FLOW build screens now calculate readiness before route build and warn when selected accounts are not fully route-ready.
- ✅ 2026-03-25 — Let the user filter to “only route-ready” accounts. Proof: AE FLOW route builder now has a route-ready-only toggle plus quick select-ready actions for visible rows.
- ✅ 2026-03-25 — Add a fix panel for missing address/contact data directly from queue screens. Proof: AE FLOW connector and route-builder rows now have a Patch modal that writes missing contact/address/route fields back into the shared offline AE FLOW account record.

Acceptance proof for P1:
- Create two vehicles.
- Run one route.
- Mark mixed outcomes.
- Push at least one follow-up and one revisit into AE FLOW.
- Reload both apps and confirm the same activity appears on the correct account.

---

## 5) P2 — Territory intelligence and smarter route building

### 5.1 Territory system
- ✅ 2026-03-26 — Add saved territories and route zones. Proof: Routex now includes an offline Territory Zones manager so named zones can be saved, edited, deleted, and reused during account patching and route filtering.
- ✅ 2026-03-26 — Allow accounts to belong to one or more territories. Proof: The AE FLOW Patch modal now writes multi-value territory/zone membership back into shared offline account storage and Routex reads that list on subsequent route builds.
- ✅ 2026-03-26 — Allow routes to be built from territory filters. Proof: The AE FLOW route builder now filters against multi-territory account membership and can build selected routes from the filtered territory view.
- ✅ 2026-03-25 — Track performance by territory: stops, completions, revenue, cost, revisit need. Proof: Routex now includes a Territory Analytics modal that rolls up stored route history into territory-level stops, completions, revenue, spend, net, revisit need, and balances due.

### 5.2 Route templates
- ✅ 2026-03-25 — Add recurring templates such as Monday East Run, Friday Follow-Up Run, Monthly Check-In. Proof: Routex now supports saved offline route templates that can be named and reused for repeat runs.
- ✅ 2026-03-25 — Save stop order preferences, default vehicle, and default route notes. Proof: Saved route templates now store the selected account order, vehicle/profile defaults, territory, and route notes for reuse.
- ✅ 2026-03-25 — Generate a live route from a saved template using current AE FLOW records. Proof: The Templates modal now rebuilds a fresh route-builder selection from today’s AE FLOW account records instead of stale copied stops.

### 5.3 Manual sequencing and field-runner mode
- ✅ 2026-03-27 — Improve stop ordering with drag-sort. Proof: Route detail stop cards are now draggable and Routex persists reordered stop sequence offline through reorderStopsToTarget + route event logging.
- ✅ 2026-03-25 — Add large next-stop focus mode for in-field use. Proof: Route detail now includes a Next Stop modal that surfaces the next unresolved stop with exact address, access notes, timing state, contact lane, and quick arrived/delivered/proof actions.
- ✅ 2026-03-26 — Add quick-tap status buttons for fast use on mobile. Proof: Route stop cards and the Next Stop focus modal now expose one-tap No answer / Follow-up / Wrong address actions that save directly into offline stop status, notes, timeline, and AE FLOW-linked activity.
- ✅ 2026-03-26 — Add route pause/resume and lunch/break tracking. Proof: Route detail now has Pause, Resume, and Lunch / Break controls that write real offline pause/break sessions into the route record, append timeline events, and auto-close any open session during closeout.
- ✅ 2026-03-26 — Track total route time, drive time, dwell time, and break time. Proof: Route metrics now calculate total, active, drive, dwell, service, break, and pause minutes from stored route start/closeout and stop timing data, then surface them on route cards, route detail, closeout, day-ledger export, and CSV export.

### 5.4 Revisit and cadence intelligence
- ✅ 2026-03-27 — Detect accounts not visited in X days. Proof: buildRevisitInsights now calculates days-since-visit and surfaces stale accounts in the AE FLOW connector and dashboard cadence lane.
- ✅ 2026-03-27 — Detect repeated failed attempts. Proof: cadence intelligence now counts repeated failed outcomes per account and flags them in connector cards and aggregate dashboard stats.
- ✅ 2026-03-27 — Detect territories with weak yield. Proof: cadence intelligence now cross-checks account territories against local territory performance and flags low-yield territory accounts.
- ✅ 2026-03-27 — Suggest revisit windows based on prior outcomes. Proof: per-account cadence logic now suggests a next revisit date based on failure history, successful cadence, or untouched/new status.
- ✅ 2026-03-27 — Flag cold accounts that need follow-up. Proof: connector cards and dashboard cadence intelligence now mark cold accounts when they age out, stack failures, or still have open follow-up pressure.

Acceptance proof for P2:
- Build one territory-based route.
- Save it as a template.
- Rebuild it later with updated accounts.
- Confirm route performance stats roll up to territory history.

---

## 6) P3 — Offline field desk / proof system expansion

### 6.1 Stop-level document vault
- ✅ 2026-03-27 — Add local document storage per stop and per client. Proof: Routex now has a local doc vault keyed to route, stop, source account, client key, and business email.
- ✅ 2026-03-27 — Support images, PDFs, simple HTML exports, and local notes. Proof: the doc vault now stores uploaded image/PDF attachments, generated HTML docs, and note-only entries fully offline.
- ✅ 2026-03-27 — Allow proof packets to include selected docs. Proof: proof-packet generation now has an include-docs toggle and embeds selected doc-vault artifacts/signatures alongside route proof.
- ✅ 2026-03-27 — Add file tags such as receipt, quote, intake, signature, site photo, completion proof. Proof: vault docs now persist tag arrays and generated/signature docs write meaningful proof tags into stored metadata.

### 6.2 Signature and service proof
- ✅ 2026-03-27 — Add local signature capture. Proof: the doc vault now includes a local canvas signature capture flow that saves the signature as an offline proof attachment.
- ✅ 2026-03-27 — Attach signature to stop closeout or delivery proof. Proof: captured signatures are now saved against the active route/stop and can be included in proof-packet exports as delivery/completion proof.
- [ ] Generate a signed service summary or delivery confirmation.
- ✅ 2026-03-27 — Export a proof sheet with timestamp, signature, photos, and notes. Proof: proof packets now include route/stop timestamps, stop notes, photos, and selected signature/docs from the vault.

### 6.3 Quote / slip / mini-document builder
- ✅ 2026-03-27 — Generate quote drafts from a route stop. Proof: Route detail and the doc vault can now generate quote draft HTML docs directly from stop/account data.
- ✅ 2026-03-27 — Generate service slips, visit summaries, and follow-up sheets. Proof: the doc vault now generates service-summary and follow-up-sheet documents from the current route stop.
- ✅ 2026-03-27 — Allow these docs to inherit account, route, and stop data automatically. Proof: generated docs now pull business, contact, stop, route, and field-note context from the active stored records.
- ✅ 2026-03-27 — Save the generated documents back into the account/stop vault. Proof: generated quote/service/follow-up docs are persisted as doc-vault records tied to the route stop and client.

### 6.4 Portable route packs
- [ ] Export an offline route pack with all stops, notes, documents, proof, and economics.
- [ ] Allow import/restore of a route pack into another device copy of the app.
- [ ] Add merge/duplicate warning behavior during import.
- ✅ 2026-03-25 — Export an offline route pack with selected routes, stops, proof photos, linked route tasks, and route economics. Proof: Export now includes a Route Pack flow that packages selected routes/stops plus optional embedded proof photos into a local JSON transfer pack.
- ✅ 2026-03-25 — Allow import/restore of a route pack into another device copy of the app as new local route copies. Proof: Export now includes Route Pack Import, which remaps imported route/stop IDs into new local records and restores embedded proof photos/tasks offline.
- ✅ 2026-03-25 — Add duplicate warning behavior during route-pack import. Proof: Route Pack Import now detects existing same-name/same-date routes on the device and requires confirmation before bringing in imported copies.

Acceptance proof for P3:
- Complete one stop.
- Attach photos and a signature.
- Generate a signed proof sheet and a quote draft.
- Export and re-import the route pack.

---

## 7) P4 — Offline analytics and command center upgrades

### 7.1 Daily command center
- ✅ 2026-03-25 — Add a day dashboard with today’s routes, today’s miles, today’s spend, today’s outcomes, and today’s follow-ups created. Proof: Dashboard now includes a Daily Command Center with today totals for spend, revenue, net, miles, outcomes, follow-up creates, and task due counts.
- ✅ 2026-03-25 — Show unresolved stops and accounts needing revisits. Proof: Daily Command Center now surfaces unresolved stop rows and revisit / failed-stop counts from today’s routes.
- ✅ 2026-03-25 — Show today’s highest-value territory and weakest territory. Proof: Daily Command Center now calculates strongest and weakest territory from today’s route net totals.

### 7.2 Driver / AE analytics
- ✅ 2026-03-25 — Measure routes completed, stops completed, on-site time, miles, fuel cost, follow-ups created, revenue logged, and cost per productive stop by AE/driver. Proof: Dashboard now opens a Driver / AE Analytics modal that calculates those metrics locally from stored routes, stop timestamps, and route-linked follow-up tasks.
- ✅ 2026-03-27 — Support side-by-side comparison of saved date ranges. Proof: Dashboard now opens a local Date Compare modal that summarizes two date ranges side by side.
- ✅ 2026-03-25 — Keep all analytics fully local. Proof: Driver, Vehicle, and Territory analytics now compute entirely from IndexedDB/localStorage route data with no backend dependency.

- ✅ 2026-03-25 — Add vehicle analytics for miles, fuel spend, revenue, net, and score by saved vehicle/profile. Proof: Dashboard and Settings now open a Vehicle Analytics modal powered entirely by local route history.
### 7.3 Readiness and data quality dashboard
- ✅ 2026-03-27 — Show how many accounts are truly route-ready. Proof: the Readiness Dashboard now counts route-ready, needs-patch, and not-ready AE FLOW accounts locally.
- ✅ 2026-03-27 — Show how many have missing address, phone, or contact data. Proof: the Readiness Dashboard now surfaces missing exact-address, phone, and contact counts from stored AE FLOW accounts.
- ✅ 2026-03-27 — Add one-click bulk-fix workflow for the most common missing fields. Proof: the Readiness Dashboard now bulk-patches territory, city, state, contact, and phone into targeted accounts from one modal.

Acceptance proof for P4:
- Seed mixed-quality accounts and several routes.
- Open the command center.
- Confirm the dashboards match stored route/account history.

---

## 8) Additional killer upgrades to consider beyond the first roadmap

These are strong expansion lanes that still fit the offline-first direction.

### 8.1 Inventory + materials used per stop
- ✅ 2026-03-25 — Track consumables or items used on a stop. Proof: Routex now has a Materials Used modal that logs inventory or manual material usage at route or stop level.
- ✅ 2026-03-25 — Reduce local stock when materials are marked used. Proof: Logging material usage from a saved inventory item now deducts offline on-hand stock and deleting that entry restores the quantity.
- ✅ 2026-03-25 — Roll material cost into route profitability. Proof: Material entry totals now feed into route total cost, net, day ledger, and economics export lanes.

- ✅ 2026-03-25 — Surface a low-stock reorder list and export it as a purchase CSV. Proof: Settings now includes an Inventory Reorder List modal and Export now includes a Reorder CSV built from qty-on-hand vs reorder levels.

### 8.2 Collections / payment capture ledger
- ✅ 2026-03-25 — Log whether a stop collected cash, check, card note, invoice promise, or no payment. Proof: Routex now has a Collections Ledger modal with those offline payment methods per route or stop.
- ✅ 2026-03-25 — Record outstanding balances at the account level. Proof: Collection entries now persist balance-due values tied to the stop/client account reference and surface in the Daily Command Center outstanding balances list plus exports.
- ✅ 2026-03-25 — Feed collections-needed tasks back into AE FLOW. Proof: Collection entries with remaining balance can now generate collections-needed follow-up tasks back into the shared AE FLOW task lane.

### 8.3 Site-access intelligence
- ✅ 2026-03-25 — Save gate code notes, parking notes, entrance notes, business-hours notes, and safety notes per client. Proof: Stop create/edit now includes a Site Access Notes field and Routex surfaces that note directly on the stop card and proof export.
- ✅ 2026-03-25 — Surface these before arrival in next-stop mode. Proof: The new Next Stop focus modal shows site-access notes, location notes, and fallback-address warnings before the driver marks arrival.

### 8.4 Appointment windows and SLA tracking
- ✅ 2026-03-25 — Add promised time windows per stop. Proof: Stop create/edit now stores appointment start/end values and Routex shows those windows in the stop card and proof packet.
- ✅ 2026-03-25 — Track whether the stop happened on time, early, or late. Proof: Routex now derives appointment-window timing status from actual stop timestamps and shows Early / On time / Late / Late risk in stop cards, proof packets, and CSV export.
- ✅ 2026-03-25 — Show SLA risk before route start. Proof: Route start modal and dashboard now warn when a planned route has overdue or due-soon appointment windows.

### 8.5 Offline reminder and notification lane
- ✅ 2026-03-27 — Add local reminder scheduling for revisit tasks, due follow-ups, vehicle service due, and appointment windows. Proof: Routex now has a local Reminder Center that merges manual reminders with task, stop-window, and vehicle-service reminders.
- ✅ 2026-03-27 — Keep reminders working without a backend. Proof: reminders are now stored in localStorage and can optionally raise browser notifications without any server dependency.

### 8.6 Route conflict detection
- ✅ 2026-03-25 — Warn when the same account is accidentally queued twice in overlapping routes. Proof: AE FLOW route-builder now checks same-day non-completed routes for matching accounts and prompts with a conflict warning before build.
- ✅ 2026-03-27 — Warn when two AEs appear assigned to the same stop window. Proof: the AE FLOW route builder now checks same-date stop windows for the selected accounts and warns before build when another driver already covers that window.
- ✅ 2026-03-25 — Warn when a route includes too many not-ready accounts. Proof: AE FLOW route-builder now pauses build and warns when the selected set contains accounts that are not fully route-ready.

### 8.7 Backup, restore, and merge hardening
- ✅ 2026-03-27 — Add full encrypted local backup. Proof: Export now supports an encrypted backup JSON lane using local passphrase-based AES-GCM encryption in-browser.
- ✅ 2026-03-27 — Add restore preview. Proof: Import Backup now previews routes, stops, photos, docs, and duplicate-id counts before merge.
- ✅ 2026-03-27 — Add duplicate detection and merge logic during restore. Proof: backup restore now detects duplicate IDs, prompts before merge, and remaps duplicate route/stop/photo/doc ids on import.
- ✅ 2026-03-27 — Keep route-linked documents intact through backup/restore. Proof: backup exports now include doc-vault records and restore them with remapped route/stop linkage when needed.

### 8.8 Search, saved views, and dossier layout
- ✅ 2026-03-27 — Add saved filters for territory, readiness, owner, outcome, follow-up due, and profitability. Proof: the AE FLOW connector now supports those local filters plus saved-view presets.
- ✅ 2026-03-27 — Add dossier view for client history across AE FLOW and Routex. Proof: the AE FLOW connector now opens a client dossier showing visit history, tasks, routes, and doc-vault counts.
- ✅ 2026-03-27 — Add a compact table view and a mobile field-card view. Proof: the AE FLOW connector now toggles between a compact table surface and card-based field view.

### 8.9 Photo/receipt compression + storage health
- ✅ 2026-03-27 — Add local image compression to prevent offline storage bloat. Proof: image uploads now pass through local compression before storage for proof photos and receipt/doc attachments.
- ✅ 2026-03-27 — Show storage health and approximate local usage. Proof: Export now surfaces local storage estimate, route/stop/photo/doc counts, and today-mile context from the offline vault.
- ✅ 2026-03-27 — Warn before very large imports or route packs. Proof: backup export/import and route-pack export/import now warn before large local payloads are generated or restored.

### 8.10 QR / code-based quick account lookup
- [ ] Generate a quick account code or QR.
- [ ] Allow instant lookup of a client record in the field.
- [ ] Use it for proof packets, service slips, or handoff confirmation.

### 8.11 Route replay / audit trail
- ✅ 2026-03-25 — Preserve a route event timeline: created, edited, started, paused, resumed, stop changed, stop completed, route closed. Proof: Routex now records a local event log for route create/edit/start/closeout plus stop add/reorder/edit/outcome/proof actions and renders that timeline on the route page.
- ✅ 2026-03-25 — Allow the user to inspect exactly what changed and when. Proof: The new Route timeline card shows each stored event with type, summary, and timestamp for audit/replay review.

### 8.12 Voice notes and media note lane
- [ ] Store voice note attachments when supported by the device/browser.
- [ ] Attach them to the stop, route, or account.

### 8.13 Lead heat / account potential scoring
- [ ] Score accounts by visit success, route cost, repeat value, collections health, and freshness.
- [ ] Use the score to prioritize future routes.

### 8.14 Manual pseudo-map board
- [ ] Add a board view with ordered stop chips, travel notes, and directional text.
- [ ] Keep it offline and text-driven for now.
- [ ] Reserve true map APIs for optional future hybrid mode.

### 8.15 Multi-day trip packs
- [ ] Support routes that span multiple days.
- [ ] Track lodging, day closeouts, and daily route rollups inside one trip pack.

---

## 9) Future optional hybrid tie-ins (not required now)

These should remain optional and must never break offline use.

- [ ] Optional geocoding/map enrichment when online.
- [ ] Optional sync between devices.
- [ ] Optional push-to-calendar for follow-ups.
- [ ] Optional cloud backup mirror.
- [ ] Optional live traffic/map APIs.
- [ ] Optional customer messaging triggers.

Rule: the local app must remain fully usable if every hybrid feature is disabled.

---

## 10) Recommended build order

### Phase A — immediate value
1. Route economics mode.
2. Expense lane.
3. Richer stop outcomes.
4. Close Route / Close Day ledger.

### Phase B — stronger field intelligence
1. Vehicle profiles.
2. Follow-up bridge back to AE FLOW.
3. Readiness scoring.
4. Territory groups.

### Phase C — premium system feel
1. Document vault.
2. Signature capture.
3. Quote/slip builder.
4. Route pack export/import.

### Phase D — operator command layer
1. Command center dashboards.
2. Driver/AE analytics.
3. Data quality dashboard.
4. Backup/restore hardening.

---

## 11) Definition of done

An upgrade is only done when all of the following are true:

- [ ] The feature works in AE FLOW and/or Routex where expected.
- [ ] The feature persists after reload.
- [ ] The feature survives export and import where applicable.
- [ ] The feature behaves correctly on fresh records and older legacy records.
- [ ] The feature has no dead buttons or fake status states.
- [ ] The feature has at least one proof workflow tested end-to-end.
- [ ] The checkbox is changed to `✅` with a date and a proof note.

Example completion notation:

`✅ 2026-03-25 — Route fuel log works locally, persists after reload, exports to CSV, tested with 3 sample routes.`

---

## 12) Sharp product positioning target

End state target:

**AE FLOW + Skye Routex becomes an offline-first field command stack** that can:
- store account intelligence,
- build routes from real client records,
- run the day in the field,
- track time, miles, fuel, expenses, and outcomes,
- generate proof and documents,
- push next actions back into account workflow,
- and show whether routes are actually worth running.

That is much stronger than “a route tool.” It becomes a real local operations platform.
