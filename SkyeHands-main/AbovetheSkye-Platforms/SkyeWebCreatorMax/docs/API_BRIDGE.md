# API Bridge

SkyeWebCreatorMax talks to the wider system through the SkyeHands platform bus.

## Request Project

```js
await requestWebCreatorProject({
  tenantId: 'tenant',
  workspaceId: 'workspace',
  actorId: 'user-or-agent',
  name: 'Client Website',
  brief: 'Create a polished responsive site.',
  pages: ['home', 'services', 'contact'],
  features: ['3D hero', 'AE delivery package']
});
```

Publishes:

- `webcreator.project.requested` to `skydexia`
- `ae.requested` to `ae-commandhub`

## Persist Artifact

```js
await persistGeneratedWebCreatorArtifact(projectId, {
  kind: 'website-package',
  files: ['index.html', 'styles.css', 'app.js'],
  previewUrl: '<standalone-preview-url>'
});
```

Publishes:

- `webcreator.project.generated`
- `app.generated`
- `webcreator.delivery.queued`
