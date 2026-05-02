# SMOKE PROOF — PHASE F / V6

As of 2026-04-07 (America/Phoenix)

## Scope of this pass

This pass hardened proof ops in two real ways:

1. it added a Neon transport smoke path that forces the repo through the `neon-http` adapter path and proves parameterized SQL bridge calls plus read-after-write history reads
2. it added a headless DOM-driven operator UI smoke path that executes the real shipped UI script and drives the operator surface end to end

## Commands executed

```bash
npm run check
npm run smoke
```

Both passed.

## New smoke lanes proved in this pass

### 1) Neon transport smoke

Command:

```bash
npm run smoke:neon-transport
```

Passed checks:

- neon-http adapter selected through env
- sql bridge authorization header enforced
- parameterized workspace insert via neon transport
- parameterized project insert via neon transport
- workspace history readback through neon transport

Observed proof:

- query count recorded by the smoke: `16`
- the smoke created a workspace through the Neon adapter path
- the smoke created a project through the Neon adapter path
- the smoke read workspace history back through the Neon adapter path

Important honesty note:

This is **transport proof**, not live Neon proof. It proves the adapter path and request contract, but it does **not** mark live Neon complete.

### 2) Headless DOM-driven operator UI smoke

Command:

```bash
npm run smoke:browser-ui
```

Passed checks:

- headless DOM-driven operator UI smoke
- workspace creation from UI
- project creation from UI
- audit from UI
- research/brief/draft from UI
- generic publish execution from UI
- workspace bundle export/import/clone from UI
- workspace history readback from UI

Observed proof from the passing run:

- workspace id: `ws_b0faeb69b4c949d29e6ad323134bfb56`
- project id: `prj_d43385312869458fafc66ac3e3ee3496`
- audit run id: `audit_30d2fb6da69e4b9cbcadf3b0f2e1b8c0`
- brief id: `brief_991a9663b06848509e975aaab8327737`
- article id: `article_924fb590d5f24a38911462d7b685e64f`
- publish run id: `publish_35a6bcca4fb34d59a0bb12a0b92e293c`
- publish status: `success`
- imported workspace id: `ws_e5ae3601a6e342d7833e2cbae2ed2749`
- cloned workspace id: `ws_3ef97a6a9c994c71882f164a5115bee3`
- history project count: `1`
- history publish-run count: `1`

## Bug fixed and now smoke-backed

The shipped operator UI had a real inline-script bug in `splitLines()` where the rendered page script contained an invalid newline literal. That bug is fixed in `src/ui/app.ts`, and the new UI smoke now exercises the path that was broken.

## Full smoke suite state after this pass

The full smoke chain passed:

- smoke:api
- smoke:replay
- smoke:publish
- smoke:agency
- smoke:backlinks
- smoke:bundles
- smoke:neon-transport
- scan:routes
- scan:ui
- smoke:browser-ui

## What remains blank after this pass

Still not marked done:

- live Neon target proof
- durable history proof against a live persistent target
- live remote provider publish proof
- real browser automation smoke
