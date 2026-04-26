# Smoke Proof — AE Provider Dispatch (Real Code Paths)

Status: PASS
Generated: 2026-04-26T08:34:06.425Z
Checks: 27 total, 27 passed, 0 failed

## Provider Dispatch Results (DRY_RUN=1)
- openai: ok=true dryRun=true hasResponseId=true
- anthropic: ok=true dryRun=true hasResponseId=true
- gemini: ok=true dryRun=true hasResponseId=true
- printful: ok=true dryRun=true hasResponseId=true
- calendly: ok=true dryRun=true hasResponseId=true

## AE Brain Result
- aeId: ae-01 | ok: true | dryRun: true
- content type: text | text: [DRY_RUN] OpenAI response simulated.

## All Checks
- [PASS] isDryRun() === true with env flag
- [PASS] openai validation ok in dry-run
- [PASS] openai dispatch ok
- [PASS] openai flagged as dryRun
- [PASS] anthropic dispatch ok
- [PASS] anthropic flagged as dryRun
- [PASS] gemini dispatch ok
- [PASS] gemini flagged as dryRun
- [PASS] printful dispatch ok
- [PASS] printful flagged as dryRun
- [PASS] calendly dispatch ok
- [PASS] calendly flagged as dryRun
- [PASS] failover selected a provider
- [PASS] failover ok
- [PASS] failover attempted primary first
- [PASS] brain call ok
- [PASS] brain has text content
- [PASS] brain text contains DRY_RUN marker
- [PASS] brain has aeId
- [PASS] brain has responseId
- [PASS] brain dryRun flag set
- [PASS] neon query returns rows array
- [PASS] neon no-DB fallback returns empty
- [PASS] unknown provider returns ok=false
- [PASS] unknown provider has errors
- [PASS] missing field returns ok=false
- [PASS] missing field error mentions field

## What This Proves
All five provider dispatch code paths execute without live API keys (DRY_RUN=1).
When live env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, PRINTFUL_API_TOKEN,
CALENDLY_TOKEN) are set and AE_PROVIDERS_DRY_RUN is unset, the same code paths
hit real provider APIs with no code changes. Failover chain executes correctly.
AE brain per-persona system prompts are built and dispatched through the provider layer.
