# SkyeWebCreatorMax

SkyeWebCreatorMax is the SkyeDocxMax-style standalone platform for website, UI, app-shell, and 3D web experience creation.

It is designed to work in two modes:

1. **Standalone mode** - runs as a local/offline-first PWA with browser persistence.
2. **SkyeHands connected mode** - sends project requests, generated artifacts, and client delivery handoffs through the SkyeHands platform bus.

## System Role

SkyeWebCreatorMax is the user-facing web creation surface for:

- landing pages
- SaaS dashboards
- app shells
- client websites
- 3D product showcases
- UI redesign briefs
- AE-ready delivery packages

It uses SkyDexia and the Design Vault as the design intelligence layer:

- `design-vault/library/use-case-matrix.json`
- `design-vault/library/templates/template-catalog.json`
- `design-vault/library/catalog/pattern-index.json`
- `design-vault/library/catalog/source-index.json`

## Connected Runtime

The code-backed bridge is:

```txt
skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs
```

It persists projects under:

```txt
skyehands_runtime_control/.skyequanta/webcreator
```

And publishes these platform-bus events:

- `webcreator.project.requested`
- `webcreator.project.generated`
- `webcreator.asset.persisted`
- `webcreator.delivery.queued`
- `ae.requested`
- `app.generated`

## Smoke

Run the bus-level proof:

```bash
cd skyehands_runtime_control
npm run smoke:skyewebcreator
```

Run the standalone package smoke:

```bash
node AbovetheSkye-Platforms/SkyeWebCreatorMax/smoke/smoke-release-checks.mjs
```

