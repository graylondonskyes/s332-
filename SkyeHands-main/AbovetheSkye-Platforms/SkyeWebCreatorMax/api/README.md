# SkyeWebCreatorMax API Bridge

Standalone mode uses browser storage only.

Connected mode should call the SkyeHands runtime bridge:

```txt
skyehands_runtime_control/core/webcreator/skyewebcreator-bridge.mjs
```

Primary functions:

- `requestWebCreatorProject(spec)`
- `persistGeneratedWebCreatorArtifact(projectId, artifact)`
- `listWebCreatorProjects()`
- `getWebCreatorProject(projectId)`

Primary platform events:

- `webcreator.project.requested`
- `webcreator.project.generated`
- `webcreator.asset.persisted`
- `webcreator.delivery.queued`
- `ae.requested`
- `app.generated`

