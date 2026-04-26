# FUTURE CODE-TOUCH MAP

This file is planning only. Nothing in this ZIP was changed outside `extra-shit`.

## Files that should stay frozen until approval
- `AE-FLOW/AE-Flow/index.html`
- `AE-FLOW/AE-Flow/sw.js`
- `AE-FLOW/AE-Flow/manifest.webmanifest`
- `SkyeRoutex/index.html`
- `SkyeRoutex/sw.js`
- `SkyeRoutex/manifest.webmanifest`
- `ROUTEX_AE_FLOW_OFFLINE_UPGRADE_DIRECTIVE.md`

## Recommended future touch order after approval
### Wave 0
1. `SkyeRoutex/index.html`
2. `AE-FLOW/AE-Flow/index.html`
3. create new sidecar modules rather than stuffing everything directly into one script block if possible
4. add fixture/proof files under a new internal docs/tests folder only after approval

### Wave 1
1. `SkyeRoutex/index.html` for QR, voice notes, pseudo-map board, trip pack shells
2. `AE-FLOW/AE-Flow/index.html` for lookup, score, route-priority surfaces
3. export surfaces only after entity models are stable

### Wave 2
Hybrid adapters only after the offline schema is locked.

## Required safety steps for the first real code wave
- make a full untouched backup copy of both app `index.html` files
- version the storage schema before adding new entities
- add deterministic fixture data before changing exports
- do not replace existing working flows just to insert a new donor lane
- mark every touched feature as planned, in-progress, or proven; never silently flip boxes
