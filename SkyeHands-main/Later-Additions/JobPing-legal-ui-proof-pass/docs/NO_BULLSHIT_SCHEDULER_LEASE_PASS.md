# JobPing No-Bullshit Scheduler Lease Pass

This pass closes another burn path: duplicate or overlapping cron runs.

## Added

- `SchedulerRun` ledger for internal job execution history.
- Scheduler lease guard for `/api/internal/due-messages`.
- Internal scheduler-health endpoint.
- Dead-letter ledger for repeatedly failed message events.
- Static scheduler proof script: `npm run proof:scheduler`.
- Updated `proof:all` to include scheduler proof.

## Why this matters

A cron provider can retry requests, overlap runs, or fire while the last run is still processing. Without a lease, the app could race through due messages and increase provider-send risk. The send path already claims each message atomically; this pass adds a second guard at the dispatcher level and creates operational visibility.

## Still live-only

- Actual cron deployment.
- Cron secret configuration.
- Live provider sends.
- Database migration execution.
- Production smoke.
