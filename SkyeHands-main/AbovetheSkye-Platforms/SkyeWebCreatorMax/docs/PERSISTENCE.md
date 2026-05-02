# Persistence

SkyeWebCreatorMax uses two persistence layers.

## Standalone Browser Storage

```txt
skyewebcreatormax.projects.v1
skyewebcreatormax.delivery.v1
```

This keeps the app useful even without a running SkyeHands backend.

## Connected Runtime Storage

```txt
skyehands_runtime_control/.skyequanta/webcreator/projects-index.json
skyehands_runtime_control/.skyequanta/webcreator/projects/<projectId>/project.json
skyehands_runtime_control/.skyequanta/webcreator/projects/<projectId>/artifacts/<artifactId>.json
skyehands_runtime_control/.skyequanta/webcreator/ae-delivery.ndjson
```

## R2/R3 Future Hook

The bridge already records optional `r2` and `r3` artifact metadata. A production transport should upload artifact payloads to the configured bucket and preserve the same local manifest envelope.

