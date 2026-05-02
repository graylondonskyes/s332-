# SkyeWebCreatorMax Directive

**Product Name:** SkyeWebCreatorMax  
**Product Type:** Standalone website/UI/3D web creation platform plus SkyeHands-connected generation node  
**Mission:** Let users request, generate, refine, persist, package, and deliver polished websites and UI systems through SkyDexia, the Design Vault, AE CommandHub, and the SkyeHands platform bus.

## Required Truth

- SkyeWebCreatorMax must be usable as a standalone PWA.
- SkyeWebCreatorMax must not be isolated from SkyeHands.
- SkyeWebCreatorMax must publish real platform-bus events when connected.
- SkyeWebCreatorMax must persist project specs and generated artifacts.
- SkyeWebCreatorMax must use the Design Vault before claiming high-quality UI generation.
- SkyeWebCreatorMax must support AE handoff for client delivery.
- R2/R3/cloud persistence may be configured later, but local persistence must always work.

## Required Communication Flow

```txt
User brief
  -> SkyeWebCreatorMax project request
  -> SkyDexia design/generation lane
  -> Design Vault lookup
  -> generated website/UI artifact
  -> SkyeWebCreatorMax persistence
  -> app.generated + webcreator.delivery.queued
  -> AE CommandHub client delivery task
```

## Code-Backed Surfaces

- Standalone app: `AbovetheSkye-Platforms/SkyeWebCreatorMax/index.html`
- Browser runtime: `AbovetheSkye-Platforms/SkyeWebCreatorMax/js/webcreator.js`
- Platform bridge: `skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs`
- Platform bus: `skyehands_runtime_control/core/platform-bus/skyehands-platform-bus.mjs`
- Smoke: `skyehands_runtime_control/scripts/smoke-skyewebcreator-bridge.mjs`

## Event Contract

SkyeWebCreatorMax owns these event lanes:

- `webcreator.project.requested`
- `webcreator.project.generated`
- `webcreator.asset.persisted`
- `webcreator.delivery.queued`

It also emits:

- `ae.requested`
- `app.generated`

## Persistence Contract

Standalone browser persistence:

- `localStorage` key: `skyewebcreatormax.projects.v1`

Connected runtime persistence:

- `.skyequanta/webcreator/projects-index.json`
- `.skyequanta/webcreator/projects/<projectId>/project.json`
- `.skyequanta/webcreator/projects/<projectId>/artifacts/<artifactId>.json`
- `.skyequanta/webcreator/ae-delivery.ndjson`

Future cloud persistence may use R2/R3 buckets, but it must preserve the same project/artifact envelope.

