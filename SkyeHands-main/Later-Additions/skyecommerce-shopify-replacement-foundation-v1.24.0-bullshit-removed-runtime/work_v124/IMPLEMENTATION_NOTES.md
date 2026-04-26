# Implementation Notes

Version: 1.21.0

This pass continues the runtime wiring work and focuses on the remaining gaps between a coded platform base and a merchant-live system.

## Added in this pass

- Secure public order access token generation and verification for storefront return/cancel flows.
- Public storefront order-status route with minimal response surface.
- Storefront return polling for live post-checkout confirmation.
- Aggregate provider validation route for all active provider connections.
- Production readiness enrichment with active-provider runtime secret blockers.
- Stale reservation release route for abandoned pending-provider orders.
- UI wording updates away from preview phrasing where applicable.

## Still intentionally external

Only the real live provider credentials, bindings, and deployed validation remain outside the shipped code package.
