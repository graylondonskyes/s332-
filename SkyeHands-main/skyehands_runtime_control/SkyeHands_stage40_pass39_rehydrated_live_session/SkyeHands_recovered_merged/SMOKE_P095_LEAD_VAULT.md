# P095 Smoke Proof — Lead Vault Behavioral

Generated: 2026-04-27T17:43:22.543Z
Result: **PASS** | 25/25 assertions

## Assertions
- ✅ create lead returns 201
- ✅ lead has id
- ✅ initial score > 0 — score=55
- ✅ scoring returns 200
- ✅ score breakdown has breakdown array
- ✅ score breakdown has total
- ✅ email rule applied
- ✅ referral rule applied
- ✅ add activity returns 200
- ✅ activity recorded
- ✅ activity has type
- ✅ stage transition returns 200
- ✅ stage updated to contacted
- ✅ stage to qualified returns 200
- ✅ qualified stage recorded
- ✅ score increases at qualified
- ✅ list leads returns 200
- ✅ list includes created lead
- ✅ update lead returns 200
- ✅ notes updated
- ✅ analytics returns 200
- ✅ analytics totalLeads >= 1
- ✅ analytics byStage present
- ✅ analytics averageScore > 0
- ✅ analytics highValueLeads array

## Coverage
- ✅ Lead create with auto-scoring
- ✅ Score breakdown with rule tracing
- ✅ Activity timeline
- ✅ Stage pipeline transitions
- ✅ Score increases at qualified stage
- ✅ Lead update
- ✅ Analytics aggregation