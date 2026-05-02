# SkyeWebCreatorMax Integration Dossier

SkyeWebCreatorMax is a SkyeGateFS13 client app for website, UI, and 3D web creation.

## App

```txt
AbovetheSkye-Platforms/SkyeWebCreatorMax
```

## Gateway Routes

- `platform-event-ingest` for mirrored project/generation/delivery events.
- `gateway-chat` for AI generation requests.
- `auth-app-login` for future app-client auth tokens.

## Event Types

- `webcreator.project.requested`
- `webcreator.project.generated`
- `webcreator.asset.persisted`
- `webcreator.delivery.queued`
- `ae.requested`
- `app.generated`

## Production Blockers

Only vars from:

```txt
AbovetheSkye-Platforms/SkyeWebCreatorMax/config/env.contract.json
```

plus SkyeGateFS13 mirror/auth vars should block production.

