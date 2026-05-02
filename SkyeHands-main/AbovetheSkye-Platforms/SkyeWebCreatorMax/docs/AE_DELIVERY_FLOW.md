# AE Delivery Flow

SkyeWebCreatorMax is designed to let agents and users request sites and push completed packages to AE CommandHub.

## Flow

1. User or agent creates a project brief.
2. SkyeWebCreatorMax persists the request.
3. The bridge publishes `webcreator.project.requested` to SkyDexia.
4. The bridge publishes `ae.requested` to AE CommandHub.
5. SkyDexia uses the Design Vault and donor templates to generate the site/UI.
6. The generated package is persisted as an artifact.
7. SkyeWebCreatorMax publishes `app.generated`.
8. AE CommandHub receives the package for client delivery/productization.

## Proof

Run:

```bash
cd skyehands_runtime_control
npm run smoke:skyewebcreator
```

