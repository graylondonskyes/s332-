# SkyeWebCreatorMax Architecture

SkyeWebCreatorMax is a standalone web creation PWA plus a SkyeHands platform node.

## Layers

1. Browser UI: `index.html` and `js/webcreator.js`
2. Standalone persistence: browser `localStorage`
3. Connected bridge: `skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs`
4. Platform bus: `skyehands_runtime_control/core/platform-bus/skyehands-platform-bus.mjs`
5. Design intelligence: `design-vault/library`
6. Generation/orchestration: SkyDexia + AE CommandHub
7. Delivery: AE productization/client delivery queues

## Cross-App Flow

```txt
SkyeWebCreatorMax
  -> webcreator.project.requested
  -> SkyDexia
  -> Design Vault / donor templates / AE brains
  -> webcreator.project.generated
  -> SkyeWebCreatorMax artifact persistence
  -> app.generated
  -> AE CommandHub delivery task
```

## Persistence

Connected project data is stored under:

```txt
skyehands_runtime_control/.skyequanta/webcreator
```

Future R2/R3 storage should mirror the same `project` and `artifact` envelope used by the bridge.

