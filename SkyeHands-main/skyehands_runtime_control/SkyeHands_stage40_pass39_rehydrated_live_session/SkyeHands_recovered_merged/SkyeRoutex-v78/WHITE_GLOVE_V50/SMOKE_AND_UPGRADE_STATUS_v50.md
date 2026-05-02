# Smoke and Upgrade Status v50

Code-side smoke completed:
- `node --check skyesol-whiteglove-runtime/shared.js`
- `node --check skyesol-whiteglove-bookings/index.js`
- `node --check skyesol-whiteglove-dispatch/index.js`
- `node --check skyesol-whiteglove-sync/index.js`
- `node --check SkyeRoutex/whiteglove.v50.js`
- `node --check AE-FLOW/AE-Flow/whiteglove.v50.js`

Backend flow smoke completed through the new harness:
- booking request
- booking confirm
- materialization preview
- route materialization
- membership create and draw
- availability create
- assignment
- conflict check
- charge summary
- payout preview
- website booking import
- restore preview
- restore merge
- booking-chain readout
- backend command-center snapshot

See `backend_smoke_output_v50.json` for the captured result payload.
