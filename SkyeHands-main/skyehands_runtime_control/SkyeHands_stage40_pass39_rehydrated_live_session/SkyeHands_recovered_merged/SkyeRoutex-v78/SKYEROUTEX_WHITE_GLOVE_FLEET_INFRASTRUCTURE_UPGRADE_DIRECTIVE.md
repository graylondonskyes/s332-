# SKYEROUTEX WHITE-GLOVE FLEET INFRASTRUCTURE UPGRADE DIRECTIVE

Status rule: every item in this file starts pending. When an item is truly finished, replace its box with a green check mark `✅`, add the completion date, and add a one-line proof note. Do not mark anything complete on partial plumbing, fake UI, dead buttons, placeholder math, or untested website hookups. If something is not done, leave it blank.

Primary objective: upgrade the existing **Skye Routex + AE FLOW** stack so it can support a full premium private-driver operation on Skyesol: **on-demand bookings, reserved rides, membership/subscription service, favorite-driver preference, white-glove service notes, dispatch, route execution, profitability, and customer/account continuity**.

Core product stance:
- Keep the field-running core real.
- Keep Routex useful even if live website sync is temporarily unavailable.
- Do not destroy the existing routing/economics/proof stack just to bolt on booking UI.
- No fake “favorite driver” guarantees.
- No fake subscriptions that do not actually decrement included time/miles.
- No fake booking statuses that do not map into route/driver execution.
- No second disconnected CRM. Reuse and extend the existing AE FLOW / Routex account logic.
- Premium white-glove service means the app must track service quality, not only trips.

---

## 1) Locked baseline already in place

This directive assumes the current app already has a serious routing core in place and does **not** start from zero:

- Route planning, stop management, and dispatch workflows already exist.
- Route economics, odometer, fuel, expenses, profitability, and closeout already exist.
- Proof capture, photos, signatures, doc vault, and exports already exist.
- Route packs, backup/restore, reminders, analytics, and command-center surfaces already exist.
- AE FLOW and Routex already share account-aware routing behavior.
- The main in-place code surfaces are still the existing app files, not a fresh replacement build.

This means the next work is not “make a routing app.” The next work is to convert the current routing stack into a **premium chauffeur operations system** without breaking what is already real.

---

## 2) Non-negotiable build rules

- [ ] One canonical booking record must exist from website request → dispatch → route stop → closeout → receipt/export.
- [ ] One canonical customer/service profile must exist for rider, household, or business client records.
- [ ] One canonical driver profile must exist for assignment, favorite-driver logic, payout, and service history.
- [ ] One canonical pricing snapshot must be stored on every confirmed booking so later edits cannot corrupt billing history.
- [ ] One canonical subscription ledger must exist for included hours, included miles, overages, pauses, renewals, and expiration.
- [ ] Favorite-driver behavior must explicitly say whether it is “preferred,” “matched,” “unavailable,” or “overridden by dispatch.”
- [ ] Every customer-facing promise must have a storage path, a visible UI state, and an export/audit effect where relevant.
- [ ] White-glove actions must be trackable: door assist, luggage/grocery assist, wait/standby, special notes, recurring rider preferences, and service rating.
- [ ] Routex must remain able to run the day even if the website-side sync queue is down.
- [ ] No lane is complete until tested with fresh records, migrated legacy records, export/restore, and website-linked records where applicable.

---

## 3) Actual files and surfaces to touch

### Existing in-place app files to extend
- `SkyeRoutexFlow/SkyeRoutex/index.html`
- `SkyeRoutexFlow/AE-FLOW/AE-Flow/index.html`

### Files that should not become dumping grounds
- manifest files unless install/caching behavior truly changes
- service worker files unless offline caching/storage behavior truly changes
- logos/icons/readme files used as fake proof of implementation

### If website tie-ins are added
Create a clean, explicit backend lane for Skyesol instead of hiding fake network behavior in the frontend. Do not sprinkle “future API” placeholders across the app.

Recommended new backend package names when implementation begins:
- `skyesol-whiteglove-bookings`
- `skyesol-whiteglove-memberships`
- `skyesol-whiteglove-dispatch`
- `skyesol-whiteglove-payments`
- `skyesol-whiteglove-sync`

Use one naming system and one booking contract across frontend and backend.

---

## 4) Canonical new data contract that must be added before more UI

### 4.1 Service profile contract
Every rider/client record must support:
- profile type: `individual`, `household`, `business`, `vip`, `medical`, `executive`
- display name + legal/billing name when relevant
- primary phone, alternate phone, email
- saved pickup/dropoff addresses
- service area / market / preferred pickup zone
- mobility / assistance flags
- grocery / luggage / elder-assist / child-seat notes when applicable
- access notes, gate notes, building notes, parking notes
- favorite-driver IDs
- household-authorized riders
- membership/subscription linkage
- billing preference / receipt destination
- notes history / service preferences history

### 4.2 Driver profile contract
Every driver record must support:
- display name
- active / inactive / suspended status
- vehicle qualifications / class permissions
- service score / quality score
- markets served
- shift windows / blackout windows
- favorite count / preferred-rider count
- assist capability flags
- payout profile / pay model
- incident count / service recovery notes

### 4.3 Vehicle profile contract
Every vehicle record must support:
- class: sedan / suv / xl / specialty
- seat count and cargo notes
- MPG or cost model
- fuel type
- white-glove capability tags
- service due / registration / insurance reminders
- active market
- dispatch eligibility

### 4.4 Booking contract
Every booking must support:
- request source: website / operator / imported / phone / returning-member / concierge
- service type: now / reserve / airport / errand / hourly standby / recurring
- customer/service profile link
- requested market / zone
- pricing tier + pricing version
- hourly minimum
- included miles per booked hour or included mileage bundle
- overage rules
- wait/standby rule
- assigned driver + assigned vehicle
- booking status timeline
- favorite-driver preference state
- route link once dispatched
- route stop link once materialized
- service notes, rider notes, operator notes
- receipt / invoice / proof linkage after closeout

### 4.5 Subscription / membership contract
Every membership/subscription must support:
- plan type: access-only / monthly included-hours / monthly included-hours-and-miles / corporate retainer
- billing cadence
- active window start/end
- included hours
- included miles
- remaining hours
- remaining miles
- member pricing tier overrides
- rollover or no-rollover rule
- household rider cap
- suspension / pause / cancel status
- renewal note / failure note / manual override note

### 4.6 Dispatch + execution contract
Every assigned booking must support:
- dispatch status: requested / quoted / confirmed / assigned / en_route / arrived / rider_boarded / in_service / completed / cancelled / no_show
- ETA / promised window
- arrival timestamp
- boarded timestamp
- assistance events
- wait-start / wait-end
- stop sequence for multi-stop rides
- return-leg support
- route economics linkage
- driver payout linkage

---

## 5) Batch 0 — system contract cleanup before new customer UI

### Purpose
Stop the future app from becoming a routing app plus a disconnected rides app.

### Build inside existing surfaces
- lock one canonical `bookingStatus` map
- lock one canonical `serviceProfileType` map
- lock one canonical `serviceType` map
- lock one canonical `favoriteDriverState` map
- lock one canonical `membershipPlanType` map
- add one shared event writer for booking / dispatch / service-quality events
- add one shared pricing snapshot schema
- add one shared migration hydrator for route, stop, account, booking, subscription, driver, and vehicle records
- add one shared export registration list for every new booking/driver/subscription action

### Must touch
- Routex route + stop builders
- Routex dispatch/assignment logic
- Routex economics/export builders
- AE FLOW account/dossier logic
- existing backup/restore and route-pack logic

### Done when
- the same booking can be seen as request, dispatch unit, route stop, and closed trip without duplicate records
- pricing snapshot survives edits and export
- one legacy route record and one new booking-linked route both survive reload and restore

---

## 6) Batch 1 — service profile / rider / household lane

### Purpose
Make the app understand who is being served, not only where a stop is.

### Build
- add service profile mode on top of existing account logic
- add individual rider, household, and business service profiles
- add household authorized riders / shared addresses
- add rider preference card: temperature, music, quiet ride, accessibility notes, grocery help, luggage help, pickup-side note, call/text preference
- add white-glove notes history that persists across future bookings
- add membership badge + favorite-driver badge on the service profile
- add client-value / frequency / service-score summary

### AE FLOW role
- dossier must show service profile type, recurring rider info, household members, favorite drivers, membership state, and recent ride history
- account-side tasks/reminders must support renewal, follow-up, recovery, and VIP service callbacks

### Routex role
- stop creation must be able to pull from service profiles, not only business-style account data
- stop cards must show service notes, access notes, and rider preference notes cleanly

### Done when
- a repeat rider can be selected from stored profiles and their preferences flow into the booking and stop automatically
- a household can share one payer but multiple riders without breaking history

---

## 7) Batch 2 — premium service catalog and pricing engine

### Purpose
Make the pricing real enough to run both on-demand and subscription service without hand math.

### Build
- add service catalog entries for at least:
  - reserve sedan
  - now sedan
  - reserve suv
  - now suv
  - airport meet/greet
  - errand / grocery assist
  - hourly standby
  - recurring ride block
- add market/zone pricing tables for Phoenix / Glendale / Scottsdale / Mesa / Valley-wide extensions
- add hourly minimums
- add included miles per booked hour
- add extra-mile overage rules
- add wait/standby billing rules
- add rush / same-day dispatch fees
- add optional manual operator override with audit note
- add quote preview before confirmation
- freeze the pricing snapshot onto the booking at confirmation time
- generate customer-facing quote and trip receipt docs from stored values

### Routex role
- route economics must read from the booking pricing snapshot, not recalculate later from mutated settings
- day ledger must separate retail, member-rate, included-block usage, and overage revenue

### AE FLOW role
- profile history must show last quoted tier, last paid tier, and current member pricing status

### Done when
- a reserve booking, a now booking, and a member booking all produce different correct stored economics without manual spreadsheet cleanup

---

## 8) Batch 3 — booking intake + operator dispatch board

### Purpose
Turn Routex into the execution core for website-origin bookings.

### Build
- add booking inbox for website requests
- add operator quote/confirm flow
- add dispatch board for unassigned, assigned, live, and exception bookings
- add assign/reassign driver controls
- add assign/reassign vehicle controls
- add route materialization from confirmed bookings
- add multi-stop booking support
- add standby / wait-state support
- add no-show and late-arrival resolution states
- add recurring booking template support
- add route-window conflict warnings
- add double-booking warnings for rider, driver, and vehicle

### Website tie-in requirement
- website requests must create real booking records, not emails pretending to be bookings
- failed sync must push into a visible local outbox / retry queue
- a booking created from the website must appear in Routex with source attribution

### Done when
- one website-origin request can be quoted, assigned, run, closed, and exported without retyping the customer data into another screen

---

## 9) Batch 4 — subscription / membership ledger lane

### Purpose
Make the subscription side real instead of decorative.

### Build
- access membership plans
- monthly included-hours plans
- monthly included-hours-and-miles plans
- membership plan catalog
- subscription ledger and decrement logic
- remaining-hours and remaining-miles display
- member-rate pricing override support
- household rider cap logic
- pause / resume / cancel logic
- renewal due reminders
- failed-renewal / expired-member state
- manual operator adjustment with audit note
- month-close ledger export

### AE FLOW role
- dossier must show plan, active window, balance remaining, next renewal, and recent usage draws
- task lane must support renewal follow-up and failed-payment recovery tasks

### Routex role
- booking confirmation must be able to choose member-rate, included-block draw, or normal retail
- closeout must decrement the correct ledger and write the usage event

### Done when
- a member ride can consume included time/miles, show the remaining balance immediately, and export the ledger correctly

---

## 10) Batch 5 — favorite-driver, availability, and assignment intelligence

### Purpose
Support the premium continuity promise without lying.

### Build
- favorite-driver requests on service profiles
- driver availability calendar / shift windows
- market-specific driver eligibility
- vehicle-class eligibility by driver
- favorite-driver preference matching
- explicit fallback states when the favorite driver is unavailable
- recurring preferred-driver rider pairings
- dispatch override notes when favorite requests cannot be honored
- driver acceptance / decline / reassignment tracking
- service-quality score and repeat-rider score on driver profiles

### Routex role
- dispatch board must visibly show whether the assigned driver is favorite, requested favorite unavailable, or general dispatch
- route cards and stop cards must show continuity notes cleanly

### Done when
- a rider can prefer a driver, the app can attempt to honor it, and the stored record still truthfully says what happened

---

## 11) Batch 6 — white-glove trip execution lane

### Purpose
Make the actual service quality visible in the trip record.

### Build
- pickup ready state
- arrived state
- rider boarded state
- in-service state
- completed state
- wait/standby timer
- grocery/luggage/door-assist event capture
- special assistance note capture
- return-leg support
- errand-run support with multiple short stops
- rider handoff notes for household or executive assistant bookings
- service recovery notes when something goes wrong
- post-trip service rating capture

### Routex role
- stop detail must support premium chauffeur actions, not only delivery-style proof
- proof packet must be able to include service summary, wait time, assistance notes, and rider confirmation where relevant

### Done when
- one grocery-assist ride and one standby/hourly booking can both be closed correctly without abusing the delivery-style stop model

---

## 12) Batch 7 — payment, receipts, and payout lane

### Purpose
Close the money loop for both operator and driver.

### Build
- booking charge summary
- member-rate vs retail-rate receipt logic
- included-block draw receipts
- overage receipts
- tip / gratuity storage if used
- manual cash / external payment note if needed
- payout ledger by driver
- payout model support: hourly, per-service, hybrid, guaranteed-minimum, bonus
- route-day payout export
- dispute / adjustment note support
- refund / credit note support

### Routex role
- day ledger must show booked revenue, recognized revenue, overage revenue, wait revenue, adjustments, payout liability, and estimated net

### Done when
- the same completed booking can generate both a customer receipt and a driver payout event from the same stored record

---

## 13) Batch 8 — Skyesol website integration lane

### Purpose
Make the app truly support the infrastructure when mounted on the live website.

### Build
- customer booking request form on Skyesol
- returning-customer login or lookup lane
- member dashboard for remaining balance and recent rides
- favorite-driver preference UI
- dispatch/operator sync inbox
- secure booking update endpoint
- secure membership ledger endpoint
- secure driver availability / assignment endpoint
- sync retry / offline outbox behavior
- routex-side import of website-created bookings into live dispatch

### Hard rule
Website integration must not make the field app useless when the website lane is unavailable. Routex still has to be able to run local dispatch and later sync.

### Done when
- a real booking can be created from the website and then appear inside the operator app without copy/paste
- if sync is unavailable, the app visibly queues the action instead of pretending it succeeded

---

## 14) Batch 9 — analytics and command-center upgrade for chauffeur operations

### Purpose
Upgrade analytics from courier-style route tracking to premium service economics.

### Build
- bookings by market
- bookings by tier
- member vs retail mix
- favorite-driver match rate
- driver continuity score
- driver service score
- revenue by driver
- revenue by vehicle class
- revenue by zone
- wait-time revenue
- overage revenue
- subscription utilization rate
- unused membership liability / breakage view
- repeat-rider rate
- cancellation / no-show rate
- route profitability vs booking profitability comparison

### Done when
- operator can see whether premium service is actually profitable by zone, driver, and plan type

---

## 15) Batch 10 — documents, compliance, and premium service proof

### Purpose
Make the system strong enough for real premium operations and later disputes.

### Build
- trip receipt HTML
- premium service summary HTML
- airport meet/greet card or signage doc
- member usage summary doc
- driver incident report doc
- service recovery note doc
- cancellation/no-show proof note
- stored terms acknowledgement / policy reference on booking where needed
- export bundle for trip dispute review

### Routex role
- document vault must tie docs to booking, route, stop, service profile, and driver where relevant
- proof packets must support both delivery-style and chauffeur-style evidence

### Done when
- a disputed or VIP trip can be reconstructed from stored docs, status history, timing, and service notes

---

## 16) Batch 11 — import, restore, and migration hardening for the new infrastructure

### Purpose
Do not let the new fleet layers break portability.

### Build
- backup/restore support for service profiles, drivers, vehicles, pricing tables, memberships, bookings, payout ledgers, and website-sync outbox rows
- import preview for the new record classes
- duplicate detection and merge logic for service profiles and drivers
- route-pack support for booking-linked service runs
- migration path for old Routex-only records with no booking contract yet

### Done when
- a backup from one device can be restored into another and still preserve the full booking → route → receipt chain

---

## 17) Batch 12 — definition-of-done machinery for the new white-glove lanes

### Purpose
Keep the directive honest.

### Build
- proof checklist per lane
- stored proof states for: fresh booking, legacy migrated route, member booking, website-origin booking, export/import roundtrip
- operator validation snapshot for website sync health
- clear blocker reporting when a lane is only UI-deep

### Done when
- no white-glove lane can be marked complete until the proof metadata exists

---

## 18) Acceptance proof sequence for the whole expansion

Do not call the infrastructure complete until all of the following are real:

### Scenario A — retail reserve ride
- create a new rider/service profile
- quote a reserve sedan or reserve suv booking
- assign a driver and vehicle
- run the trip
- close it with white-glove notes
- export customer receipt and operator ledger summary

### Scenario B — on-demand ride with favorite-driver preference
- create a rider with a favorite driver
- place a now booking
- show either matched favorite-driver or truthful unavailable fallback state
- complete the ride and store the service history

### Scenario C — subscription ride
- create a subscription with included time/miles
- book a member ride against it
- close the ride
- verify remaining balance is decremented correctly
- export the membership ledger line

### Scenario D — website-origin booking
- create the booking from the live website lane
- pull it into Routex/dispatch
- assign driver and vehicle
- complete the service
- verify export and customer history reflect the website source

### Scenario E — backup and restore
- export backup or route pack containing the new records
- restore into another copy
- verify service profiles, bookings, favorite drivers, subscriptions, and receipts still line up

---

## 19) Post-core optional expansion lanes

These are allowed after the real foundation is complete:
- corporate account portal
- executive assistant booking delegation
- airport flight tracking tie-in
- luxury class upsell lane
- recurring medical transport templates
- SMS/email automation tied to live sync
- enterprise reporting pack
- dynamic pricing / demand scoring
- cross-device live dispatch mirror

These remain optional until the core premium white-glove infrastructure is actually finished.

---

## 20) Final rule

This upgrade is complete only when the app can truthfully do **all** of the following in one system:
- accept a premium ride request
- understand who the rider is
- understand whether they are a retail or subscription client
- understand whether they prefer a driver
- price the service correctly
- dispatch it correctly
- run it correctly in the field
- close it with proof and service notes
- generate the right customer and operator records
- preserve the whole chain through export, restore, and website sync

Anything less than that is still partial.
