# P098 Smoke Proof — SkyeRoutex Platform House Circle Behavioral

Generated: 2026-04-27T22:46:13.884Z
Result: **PASS** | 27/27 assertions

## Assertions
- ✅ login returns 200
- ✅ login issues bearer token
- ✅ session is trustedDevice
- ✅ orgId matches
- ✅ health rejects unauthenticated (401)
- ✅ health accepts valid token (200)
- ✅ health reports orgId
- ✅ health storage reports persistence primary mode
- ✅ Neon primary blocks local write when env missing — Neon primary is required and no NEON_DATABASE_URL / DATABASE
- ✅ block message references local fallback
- ✅ persistence policy rejects unauthenticated (401)
- ✅ persistence policy accepts token (200)
- ✅ persistence policy reports file-primary-local mode
- ✅ sync-state persists (200)
- ✅ sync event in event log
- ✅ Neon schema has phc_operational_events
- ✅ Neon schema has phc_payment_ledger
- ✅ Neon schema has phc_webhook_replay_ledger
- ✅ Neon schema has phc_active_sessions
- ✅ production mode refuses plaintext password
- ✅ failure identifies credential hash requirement
- ✅ payment intent returns 503 (no network)
- ✅ payment ledger entry created (no live money)
- ✅ provider health returns 200
- ✅ all providers report liveExecutionReady: false
- ✅ first webhook delivery accepted (200)
- ✅ replay webhook rejected (409)

## Coverage
- ✅ Login → signed bearer session (HMAC-SHA256)
- ✅ Health endpoint auth-gated
- ✅ Strict Neon primary blocks local write when env missing
- ✅ Persistence policy auth-gated + reports honest mode
- ✅ Sync state writes through persistence wrapper
- ✅ Neon schema has all operational tables
- ✅ Production readiness refuses plaintext credentials
- ✅ Payment intent ledger created with liveMoneyMoved: false
- ✅ Payment provider health reports no live execution
- ✅ Stripe webhook replay protection (409 on duplicate event ID)