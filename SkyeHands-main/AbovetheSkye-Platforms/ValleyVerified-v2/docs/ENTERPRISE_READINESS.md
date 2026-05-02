# ValleyVerified v2 Enterprise Readiness

As-of: 2026-04-30

ValleyVerified v2 is the parent procurement and fulfillment network for company demand, contractor supply, AE dispatch, JobPing messaging, and SkyeRoutex work-order/payment closeout.

## Enterprise Position

ValleyVerified v2 is not a simple job board. It is a controlled network where:

- Companies, restaurants, venues, agencies, and local businesses post fulfillment demand.
- Contractors onboard into a verifiable supply pool.
- Contractors claim jobs from the board.
- AE Flow coordinates dispatch, follow-up, and closeout.
- JobPing carries board/message automation.
- SkyeRoutex carries work-order, procurement, refund, payment, and commerce state.
- SkyGate guards write actions.

## Current Code-Backed Lanes

| Lane | Endpoint | Status |
|---|---|---|
| Company demand | `/.netlify/functions/valley-jobs` | Implemented |
| Contractor supply | `/.netlify/functions/valley-contractors` | Implemented |
| Job claim | `/.netlify/functions/valley-claims` | Implemented |
| Fulfillment closeout | `/.netlify/functions/valley-fulfillment` | Implemented |
| Parent surface | `index.html` | Implemented |
| SkyeRoutex adapter | `valleyverified-v2.v1.json` | Implemented |
| End-to-end proof | `smoke-valleyverified-v2.mjs` | Passing |

## Enterprise Controls

- Public reads are allowed for open job board and contractor directory reads.
- Writes require SkyGate bearer tokens.
- Job lifecycle is stateful: `posted`, `claimed`, `in_progress`, `fulfilled`, `cancelled`.
- Contractor lifecycle is stateful: `pending`, `verified`, `suspended`.
- Claiming creates both a claim record and a fulfillment record.
- Fulfillment closeout updates procurement and payment status for SkyeRoutex handoff.
- Events are emitted for integration audit and downstream orchestration.

## Remaining Production Inputs

The only acceptable missing items are live environment inputs:

- SkyGate production JWKS/public key.
- Production persistence target if JSON storage is replaced by Neon.
- Stripe/PayPal/Square live payment provider variables for SkyeRoutex payment settlement.
- Messaging provider variables for JobPing live notifications.

## Commercial Motions

- Company job posting fee.
- Contractor verification/onboarding fee.
- Claim/placement fee.
- SkyeRoutex work-order/payment fee.
- SkyeCard service-credit redemption.
- Enterprise dispatch subscription for restaurants, venues, and service operators.
