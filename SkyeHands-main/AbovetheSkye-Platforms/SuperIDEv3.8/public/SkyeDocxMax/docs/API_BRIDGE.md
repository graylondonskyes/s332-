# API Bridge

Standalone strategy: static-only with local bridge records.

SkyeDocxMax keeps bridge actions available without pretending remote routes succeeded. When SuperIDEv3 or Skye ecosystem APIs are unavailable, bridge actions write local records:

- `skyedocxmax.outbox.<workspace>`
- `skyedocxmax.bridge.<workspace>`
- `skyedocxmax.intents.<workspace>`
- `skyedocxmax.evidence.<workspace>`

Final SuperIDEv3 integration should replace this with typed `/api/skydocxmax/*` routes and provider-key checks.

