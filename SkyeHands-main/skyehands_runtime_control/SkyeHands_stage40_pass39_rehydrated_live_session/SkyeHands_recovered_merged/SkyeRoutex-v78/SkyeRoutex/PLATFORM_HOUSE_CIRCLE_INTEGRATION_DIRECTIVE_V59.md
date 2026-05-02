# PLATFORM HOUSE CIRCLE INTEGRATION DIRECTIVE · V59

## Objective
Make Platform House Circle a native lane inside SkyeRoutexFlow instead of a second app bolted onto the side.

## What landed in V59
- Added a new **Platform House** workspace directly into the Routex shell.
- Added a shared local hospitality state engine inside `housecircle.integral.v59.js`.
- Added native records for:
  - locations
  - guests
  - events
  - campaigns
  - drops
  - memberships
  - bridge queue
  - unified timeline
- Added Routex → Platform House writeback so new/updated stops can sync into hospitality state.
- Added Platform House → Routex conversion so events, campaigns, and drops can become:
  - Routex follow-up tasks
  - full Routex route missions
- Added unified export/import for the hospitality lane.
- Added a first-run intro helper in `housecircle.integral.tours.v59.js`.
- Added a smoke script in `PLATFORM_HOUSE_CIRCLE_SMOKE_V59.js`.

## Architectural rule
SkyeRoutexFlow remains the platform shell and execution spine.
Platform House Circle is the hospitality/member/campaign/event intelligence lane that now lives *inside* that shell.

This pass does **not** iframe or link out to a second product surface.
It normalizes shared records and writes them into one command surface.

## Shared record model
### Shared location
A venue/property/restaurant/site record used by:
- Routex stops
- AE FLOW accounts
- events
- campaigns
- drops
- memberships

### Shared guest/member
A human relationship record used by:
- venue contact data
- guest/member tiering
- spend + visit history
- Routex writeback

### Bridge queue
Tracks hospitality work that was converted into:
- Routex follow-up tasks
- Routex route missions

### Unified timeline
Tracks:
- hospitality edits
- bridge actions
- Routex stop writebacks

## Files added
- `housecircle.integral.v59.js`
- `housecircle.integral.tours.v59.js`
- `PLATFORM_HOUSE_CIRCLE_SMOKE_V59.js`
- `package.json`

## Index changes
`index.html` now loads:
- `housecircle.integral.v59.js`
- `housecircle.integral.tours.v59.js`

## Smoke
Run:
```bash
node PLATFORM_HOUSE_CIRCLE_SMOKE_V59.js
```

Expected result:
- nav item exists
- shared state seeds from Routex + AE FLOW mocks
- locations are created
- guests are created
- timeline records are created
- unified export bundle is generated

## Remaining depth after V59
This pass is real and additive, but it is still local-first. The next strongest batch would be:
- server persistence for the Platform House lane
- multi-operator permissions
- POS/import adapters
- QR/member check-in surfaces inside the Routex shell
- shared server-side audit log across both lanes
