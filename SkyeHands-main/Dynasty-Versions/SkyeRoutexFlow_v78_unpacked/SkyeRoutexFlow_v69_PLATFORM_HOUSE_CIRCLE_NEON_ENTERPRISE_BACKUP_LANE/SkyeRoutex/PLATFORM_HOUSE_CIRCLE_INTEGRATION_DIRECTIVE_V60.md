# PLATFORM HOUSE CIRCLE INTEGRATION DIRECTIVE · V60

## Objective
Push the integral Routex + Platform House stack deeper with meaningful code that is still fully within local control.

## What landed in V60
- Added a local operator RBAC lane with role profiles:
  - Founder Admin
  - Hospitality Manager
  - Dispatcher
  - Venue Operator
  - Auditor
- Added permission guards around hospitality and bridge actions.
- Added join-packet generation with:
  - location binding
  - offer/tier metadata
  - deep-link hash route
  - SVG export
- Added packet redemption inside the Routex shell.
- Added POS revenue logging and POS JSON batch import.
- Added a unified audit lane for:
  - operator creation/switching
  - join packet creation/redeem
  - POS ticket logging/import
  - full exports
  - bridge route/task creation
- Added full V60 bundle export/import for:
  - hospitality state
  - operators
  - session
  - join packets
  - check-ins
  - POS tickets
  - audit rows

## Architectural rule
SkyeRoutexFlow is still the shell.
Platform House Circle is still the hospitality lane.
V60 does not split them apart.
It increases internal platform depth.

## Strongest surfaces added
### Operator command center
A new V60 command center is injected into the Platform House workspace.

### Join-packet lane
This is the in-shell precursor to a true QR/member check-in surface.
It already supports packet creation, redemption, and share-card export.

### POS lane
This is the in-shell precursor to a real vendor adapter.
It already writes revenue and guest-visit updates into the hospitality state.

### Audit lane
This creates a real accountability surface so hospitality actions, role changes, and bridge behavior all leave trace records.

## Smoke
Run:
```bash
node PLATFORM_HOUSE_CIRCLE_SMOKE_V60.js
```

Expected proof:
- operator creation works
- operator switching works
- join packet creation works
- join packet redemption writes a guest/check-in
- POS ticket updates revenue
- audit rows exist
- full export bundle type is `skye-routex-platform-house-circle-v60`

## Remaining depth after V60
The next strongest code batch after this would be:
- true shared persistence / cloud sync
- actual QR camera scanning
- live POS adapters
- server-backed operator/auth lane
- cloud audit replication
