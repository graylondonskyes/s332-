# SkyeDocxMax API Bridge Policy

This standalone release is static-first.

No backend route is required for core editor, local vault, encryption, import, export, or PWA behavior.

Bridge buttons attempt compatible Skye/SuperIDE routes when they exist. When those routes are absent, SkyeDocxMax writes local records instead of pretending a network call succeeded:

- `skyedocxmax.outbox.<workspace>`
- `skyedocxmax.bridge.<workspace>`
- `skyedocxmax.intents.<workspace>`
- `skyedocxmax.evidence.<workspace>`

Final SuperIDEv3 integration will replace this static bridge fallback with typed `/api/skydocxmax/*` and publishing/catalog/chat/blog/evidence contracts.
