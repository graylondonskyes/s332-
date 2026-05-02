# White-Glove Batch Map v39

## Batch 0 — system contract cleanup
Partially landed in code.

Landed:
- canonical bookingStatus map
- canonical serviceProfileType map
- canonical serviceType map
- canonical favoriteDriverState map
- canonical membershipPlanType map
- shared event writer
- shared pricing snapshot schema
- shared export registration via docs/export lanes

Not yet fully landed:
- migration hydrator across old Routex route + stop + account records
- direct reuse inside all older route-pack / backup / restore paths

## Batch 1 — service profile / rider / household lane
Substantially landed in code.

Landed:
- service profile mode
- individual / household / business / vip / medical / executive profiles
- household authorized riders
- rider preference card fields
- white-glove notes history starter fields
- membership + favorite-driver linkage

## Batch 2 — premium service catalog and pricing engine
Substantially landed in code.

Landed:
- service catalog entries for reserve, now, airport, errand, standby, recurring
- market multiplier handling
- hourly minimums
- included miles
- overage rules
- wait billing rules
- rush fee support
- manual override note + total
- quote preview
- frozen pricing snapshot

Not yet fully landed:
- full customer-facing quote doc flow beyond current receipt/service docs
- deeper operator override auditing across all surfaces

## Batch 3 — booking intake + operator dispatch board
Partially landed in code.

Landed:
- booking creation lane
- operator dispatch assignment
- assign/reassign style controls
- route/stop materialization refs
- standby and wait state capture during closeout
- website-source attribution and visible local outbox rows

Not yet fully landed:
- dedicated visual dispatch board columns
- route-window conflict warnings
- double-booking warnings
- recurring booking templates

## Batch 4 — subscription / membership ledger lane
Substantially landed in code.

Landed:
- membership plan records
- included hours / miles
- remaining balances
- member-rate vs included-block billing mode selection on bookings
- decrement logic on closeout
- AE FLOW continuity display

Not yet fully landed:
- pause / resume / cancel workflows
- renewal due automation
- month-close ledger export

## Batch 5+ 
Not yet fully landed. This pass created a serious foundation but did not honestly finish the deeper fleet/dispute/website/profitability/migration/proof layers.
