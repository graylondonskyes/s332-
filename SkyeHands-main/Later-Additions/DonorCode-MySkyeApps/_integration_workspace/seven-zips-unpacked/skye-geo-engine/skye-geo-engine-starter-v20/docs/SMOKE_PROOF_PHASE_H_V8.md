# SMOKE PROOF — PHASE H / V8

As of 2026-04-07 (America/Phoenix)

## Scope of this pass

This pass added a real truth layer to the product surface instead of leaving explanation and walkthrough copy as implied behavior.

It closed four repo-side proof gaps:

1. it added a real capability registry that defines only implemented modules
2. it added a real product-purpose endpoint and walkthrough endpoint
3. it added a real no-theater validator endpoint that checks the shipped UI against the capability registry
4. it extended both DOM UI smoke and real-browser smoke so the walkthrough and truth surfaces are exercised from the shipped operator UI

## Commands executed

```bash
npm run check
npm run smoke
```

Both passed.

## New smoke lanes proved in this pass

### 1) Truth smoke lane

Command:

```bash
npm run smoke:truth
```

Passed checks:

- product-purpose narrative endpoint returned successfully
- walkthrough endpoint returned successfully
- no-theater validator returned successfully
- validator reported zero issues

Observed proof from the passing run:

- modules: `10`
- walkthrough steps: `29`
- checked routes: `48`
- checked controls: `41`

### 2) DOM-driven shipped-UI smoke was extended to cover the truth layer

Command:

```bash
npm run smoke:browser-ui
```

Passed checks beyond prior V7 coverage:

- purpose manifest loaded from visible UI controls
- walkthrough manifest loaded from visible UI controls
- no-theater validator ran from visible UI controls

Observed proof from the passing run:

- workspace id: `ws_05955ca936fd44a4a42b9c9686269a9e`
- project id: `prj_fe63e1d0989e42519fd6ced893bc85e3`
- article id: `article_d9334a9dc2b148f8b1c260fced9518c7`
- purpose modules reported: `10`
- walkthrough modules reported: `10`
- truth issues reported: `0`

### 3) Real browser smoke was extended to cover the truth layer

Command:

```bash
npm run smoke:real-browser
```

Passed checks beyond prior V7 coverage:

- real browser rendered the new purpose / walkthrough / truth-validator sections
- purpose manifest loaded in Chromium from the shipped UI
- walkthrough manifest loaded in Chromium from the shipped UI
- no-theater validator ran in Chromium from the shipped UI

Observed proof from the passing run:

- workspace id: `ws_b4acc385098d44acbc355d47cf8c2b07`
- project id: `prj_b84f317e37684f669752c52539e22f7d`
- article id: `article_32eba23fc380495fad7ae7ad96c65fa9`
- purpose modules reported: `10`
- walkthrough modules reported: `10`
- truth issues reported: `0`

## Full smoke suite state after this pass

The full smoke chain passed:

- smoke:api
- smoke:replay
- smoke:publish
- smoke:agency
- smoke:backlinks
- smoke:bundles
- smoke:truth
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
