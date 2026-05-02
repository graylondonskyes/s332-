# No-Bullshit Idempotency Pass

This pass closes additional burn-risk gaps that still existed after the strict guardrail work.

## Fixed

- Automation queueing now uses a deterministic `queueKey` per account, lead, trigger event, and automation rule.
- Duplicate automation dispatches no longer create duplicate send events for the same rule/lead/trigger.
- `MessageEvent.queueKey` is unique at the database layer.
- Stripe billing event ids are unique at the database layer and duplicate webhook races return a safe duplicate response.
- Stripe webhook matching now falls back to known subscription/customer ids when later events do not include `account_id` metadata.
- Twilio status webhook events are idempotent by message sid + status + error code.
- Twilio status updates no longer downgrade a delivered or failed message back to sent.

## Still live-dependent

This does not prove provider dashboards, live SMS delivery, live billing, deployed cron, or production migration execution. Those still require real vars and deployment.
