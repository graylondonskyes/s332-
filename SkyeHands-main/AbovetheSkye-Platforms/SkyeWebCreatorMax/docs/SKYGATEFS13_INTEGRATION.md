# SkyeGateFS13 Integration

SkyeWebCreatorMax is designed to run through SkyeGateFS13 when connected.

## Browser Client

The standalone app loads:

```txt
js/skygate-client.js
```

It supports:

- `SkyeGateFS13Client.configure({ baseUrl, mirrorSecret, accessToken })`
- `SkyeGateFS13Client.mirrorEvent(...)`
- `SkyeGateFS13Client.askAI(...)`

## Gateway Routes

Canonical gateway:

```txt
AbovetheSkye-Platforms/SkyeGateFS13
```

Routes used:

- `/.netlify/functions/platform-event-ingest`
- `/.netlify/functions/gateway-chat`
- `/.netlify/functions/auth-app-login`

## Required Production Vars

Gateway event mirroring needs one of:

- `SKYGATE_EVENT_MIRROR_SECRET`
- `SKYGATEFS13_EVENT_MIRROR_SECRET`

SkyeWebCreatorMax connected mode also expects:

- `SKYGATEFS13_BASE_URL`
- `SKYGATEFS13_APP_CLIENT_ID`
- `SKYGATEFS13_APP_CLIENT_SECRET`

SkyeWebCreatorMax production vars are listed in:

```txt
config/env.contract.json
```

## Flow

```txt
SkyeWebCreatorMax browser event
  -> js/skygate-client.js
  -> SkyeGateFS13 platform-event-ingest
  -> SkyeGate audit/monitor ledger
  -> SkyeHands platform bus bridge
  -> SkyDexia / AE CommandHub
```
