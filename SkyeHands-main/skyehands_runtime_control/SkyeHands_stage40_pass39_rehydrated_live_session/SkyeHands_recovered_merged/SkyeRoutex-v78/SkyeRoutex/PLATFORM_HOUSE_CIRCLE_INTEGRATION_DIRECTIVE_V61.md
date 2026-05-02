# PLATFORM HOUSE CIRCLE INTEGRATION DIRECTIVE · V61

## What this pass actually lands

V61 moves the House Circle integration from shared records plus command widgets into a real operating-logic layer.

This pass adds:
- service cases as a first-class stack object
- automation rules triggered by hospitality and Routex signals
- reusable playbooks that create repeatable ops/hospitality motions
- signal execution logging
- Routex follow-up task spillover from those rules
- full V61 export bundle with rules, cases, playbooks, runs, and Routex task output

## Signals now wired into the stack

The following signals can now drive automated behavior:
- `packet_redeemed`
- `pos_ticket_logged`
- `stop_status_sync`
- `mission_created`
- `manual`

## Major integral behavior now present

1. Join packet redemption can create a hospitality/VIP case.
2. High-spend POS activity can create both a service case and a Routex task.
3. Failed or blocked stop-state sync can create a recovery case and a Routex task.
4. Delivered stop-state sync can create a post-visit follow-up task.
5. Manual playbook runs can create deterministic case/task motions without fake UI.

## V61 anti-frankenstein rule

Do not create separate hospitality recovery queues, separate ops follow-up queues, and separate campaign issue queues anymore.

All such work should route through:
- service cases
- automation rules
- playbooks
- Routex task spillover

That is the integral motion layer.

## Honest boundary after V61

Still not done in this pass:
- shared cloud persistence / multi-device sync
- live QR camera scanning
- vendor-native POS adapters
- real cloud auth / server RBAC / org tenancy
- background job runner / webhook automation

## Completion meaning after this pass

V61 is the first pass where Platform House Circle no longer only *stores* integral data.
It now also *acts* on integral data.
