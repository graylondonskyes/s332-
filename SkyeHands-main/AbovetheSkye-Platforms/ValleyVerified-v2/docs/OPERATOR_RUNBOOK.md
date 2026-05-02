# ValleyVerified v2 Operator Runbook

## Purpose

Run company demand through a verified contractor fulfillment pipeline.

## Standard Flow

1. Company posts demand through ValleyVerified v2.
2. Job appears on the board and emits `valleyverified.job.posted`.
3. AE Flow decides dispatch priority.
4. JobPing handles board/message automation.
5. Contractor onboards or is selected from verified supply.
6. Contractor claims the job.
7. Claim creates fulfillment record.
8. SkyeRoutex receives work-order/payment closeout state.
9. Operator closes fulfillment.

## Operator Review Points

- Verify company request is legitimate.
- Confirm job type and location.
- Confirm contractor status is not `suspended`.
- Prefer `verified` contractors for paid work.
- Move payment state through SkyeRoutex before final closeout.

## Fast Revenue Motions

- Charge companies to post urgent jobs.
- Charge restaurants monthly for coverage access.
- Charge contractors for verification/onboarding.
- Charge placement fees for claimed jobs.
- Sell SkyeCard service credits against fulfillment support.

## Proof Command

Run:

```bash
node SkyeHands-main/SkyeSol/skyesol-main/scripts/smoke-valleyverified-v2.mjs
```

Expected result:

- job posted
- contractor onboarded
- job claimed
- fulfillment closed
