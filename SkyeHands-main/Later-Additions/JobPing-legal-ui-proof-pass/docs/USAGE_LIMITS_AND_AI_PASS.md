# Usage Limits + AI Assist Pass

This pass adds business-protection code so JobPing can be sold without unlimited SMS risk.

## Added

- Plan catalog: Starter $99, Growth $179, Pro $299.
- Included SMS segment limits: 500 / 1,500 / 4,000.
- Included AI assist limits: 100 / 300 / 1,000.
- `UsageLedger` table for SMS segment and AI-action accounting.
- Subscription guardrail fields for overage toggle, hard stop, per-lead automation cap, and included usage.
- `/api/usage` account usage endpoint.
- `/api/billing/limits` route for updating overage/hard-stop settings.
- SMS fair-use checks before automation queues and before provider send.
- Usage recording after successful SMS send.
- AI assist endpoint at `/api/ai/assist`.
- AI Assist app page at `/ai-assist`.
- Billing page usage meters.
- Pricing page rewritten with honest SMS/AI limits and overage language.

## AI positioning

AI is intentionally assistive, not oversold. Supported v1 actions:

- `rewrite_template`
- `lead_summary`
- `reply_suggestion`

The route logs every AI event and records usage. If no AI provider key exists, it uses a transparent local fallback instead of pretending a live model was called.

## Still live/deploy dependent

- Real provider call inside `lib/ai.ts` once the selected AI vendor and policy are configured.
- Stripe product/price mapping per plan.
- Live billing portal and subscription upgrade flow.
- Live provider send proof.
- Cron deployment.
- Production smoke.
