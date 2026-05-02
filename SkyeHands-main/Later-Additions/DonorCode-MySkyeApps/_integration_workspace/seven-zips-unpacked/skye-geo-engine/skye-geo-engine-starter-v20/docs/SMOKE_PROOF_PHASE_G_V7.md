# SMOKE PROOF — PHASE G / V7

As of 2026-04-07 (America/Phoenix)

## Scope of this pass

This pass closed two more real proof gaps:

1. it added a live local persistence target that writes full org/workspace state to disk and proves read-after-restart durability
2. it added a real browser smoke lane that drives the shipped operator surface in Chromium through actual UI controls

## Commands executed

```bash
npm run check
npm run smoke
```

Both passed.

## New smoke lanes proved in this pass

### 1) Durable ledger smoke against a live local persistence target

Command:

```bash
npm run smoke:durable-ledger
```

Passed checks:

- workspace persisted through target restart
- project persisted through target restart
- job ledger persisted through target restart
- audit run persisted through target restart
- content plan persisted through target restart
- workspace history read back from the restarted target

Observed proof from the passing run:

- snapshot file size: `26057` bytes
- workspace id: `ws_7e6324f72ecf426d92ba42efb5971190`
- project id: `prj_a030641ba4d34496aec7d12811d066c2`
- audit run id: `audit_f45bdffd296349bbbde81db92c2b8161`
- history projects after restart: `1`
- history jobs after restart: `2`
- history audit runs after restart: `1`
- history content plans after restart: `1`

Important honesty note:

This proves **local persistent-target durability**, not live Neon durability. It closes the repo-side durability gap without falsely marking live Neon complete.

### 2) Real browser UI smoke in Chromium

Command:

```bash
npm run smoke:real-browser
```

Passed checks:

- real browser rendered the shipped operator UI
- required operator controls existed in the browser DOM
- workspace creation succeeded from visible UI controls
- project creation succeeded from visible UI controls
- audit succeeded from visible UI controls
- research / brief / draft succeeded from visible UI controls
- publish payload + execute succeeded from visible UI controls
- workspace bundle export / import / clone succeeded from visible UI controls
- workspace history read back through visible UI controls

Observed proof from the passing run:

- workspace id: `ws_8c93c95e20ea4c22ba4abaa017a1d1d2`
- project id: `prj_b6517927f5804067b0d9ee3bd38c30c8`
- audit run id: `audit_bab5c4142ed944919350d605893888ef`
- brief id: `brief_c538fd0d1d5c4ffdab439a63c283ce09`
- article id: `article_d52c37bc7aa845b6bc2e7bdeef97e18d`
- publish run id: `publish_8facd96b30ac4ef88252ff5957f8caee`
- publish status: `success`
- imported workspace id: `ws_f84116d5da384366a4fad30b84b731af`
- cloned workspace id: `ws_7ffa41c0a5d64eb5a06d3fa37e47d7ab`
- visible sections rendered in the browser: `12`

## Full smoke suite state after this pass

The full smoke chain passed:

- smoke:api
- smoke:replay
- smoke:publish
- smoke:agency
- smoke:backlinks
- smoke:bundles
- smoke:neon-transport
- smoke:durable-ledger
- scan:routes
- scan:ui
- smoke:browser-ui
- smoke:real-browser

## What remains blank after this pass

Still not marked done:

- live Neon target proof
- live remote provider publish proof
