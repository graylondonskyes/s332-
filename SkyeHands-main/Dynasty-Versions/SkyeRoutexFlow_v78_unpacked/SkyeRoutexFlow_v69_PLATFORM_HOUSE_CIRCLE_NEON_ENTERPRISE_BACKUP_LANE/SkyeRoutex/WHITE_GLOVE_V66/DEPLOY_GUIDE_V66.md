# Deploy Guide — V66 Valuation Center

## Static discoverability
The live build now contains these static investor artifacts:
- `./investor/SKYEROUTEXFLOW_V66_2026_ENTERPRISE_VALUATION.html`
- `./investor/SKYEROUTEXFLOW_V66_2026_ENTERPRISE_VALUATION.md`
- `./investor/SKYEROUTEXFLOW_V66_2026_ENTERPRISE_VALUATION.json`

## In-app discoverability
The frontend injects a **Valuation** control into the shell and opens the valuation center modal. The valuation card also renders directly in supported views.

## Cloud sync lane
The new endpoint is:
- `/.netlify/functions/phc-valuation`

### GET
Returns the current valuation record for the org.

### POST
Stores/syncs the current valuation record into the server-side org bundle and audit trail.

## Value shipped with this pass
**$5,200,000 USD**
