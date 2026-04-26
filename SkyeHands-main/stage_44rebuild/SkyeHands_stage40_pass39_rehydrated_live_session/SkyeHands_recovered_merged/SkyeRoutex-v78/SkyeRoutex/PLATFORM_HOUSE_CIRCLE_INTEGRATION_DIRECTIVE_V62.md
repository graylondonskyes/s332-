# PLATFORM HOUSE CIRCLE INTEGRATION DIRECTIVE V62

## What this pass lands

V62 deepens the integral stack between SkyeRoutexFlow and Platform House Circle without splitting them into separate products.

This pass adds:
- dispatch shifts
- assignment waves built from live open service cases
- readiness templates and readiness runs
- fail-closed readiness escalation into service cases + Routex tasks
- portable replica bundle export
- merge preview + import for manual cross-device carry

## Why this matters

V61 gave the platform operating logic.
V62 gives it execution structure.

House Circle is no longer only generating cases and automations. It now has:
- operator shift structure
- assignment scheduling
- venue/event readiness discipline
- bundle portability with merge intelligence

## Major code areas touched

- `housecircle.integral.v62.js`
- `housecircle.integral.tours.v62.js`
- `PLATFORM_HOUSE_CIRCLE_SMOKE_V62.js`
- `package.json`
- `index.html`

## Operator surface now available

### Dispatch mesh
- create shift
- assign operator to shift
- auto-build assignment wave from unresolved V61 service cases
- create Routex tasks alongside assignments
- complete assignments from the command mesh

### Readiness mesh
- create readiness run from template
- pass/fail readiness items
- required failure auto-escalates into:
  - V61 service case
  - Routex task
- supports hospitality, bridge, and ops readiness patterns

### Replica mesh
- export portable V62 bundle
- preview incoming merge before import
- import/merge incoming bundle using newer-row preference
- merge covers:
  - base state
  - cases
  - rules
  - playbooks
  - signal runs
  - route tasks
  - shifts
  - assignments
  - readiness templates
  - readiness runs

## Honest remaining depth after V62

Still not done:
- real shared server persistence
- live multi-device realtime sync
- live POS adapters
- live QR camera scanning
- webhook/background processors
- multi-user concurrent locking

## Completion position

V62 moves the stack from command logic into real execution structure.
This is materially closer to complete because the platform can now:
- detect work
- schedule work
- readiness-check work
- escalate failed readiness into work
- move state between devices with merge awareness
