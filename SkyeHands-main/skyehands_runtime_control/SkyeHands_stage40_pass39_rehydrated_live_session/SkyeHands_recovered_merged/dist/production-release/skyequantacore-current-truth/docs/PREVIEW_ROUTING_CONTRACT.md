# Preview Routing Contract

## Canonical operator path

The canonical routed preview path is the workspace-scoped route:

- `/w/:workspaceId/p/:port`

This is the default documented operator path because it stays explicit about workspace ownership and is the same route family used for deploy-preview parity.

## Convenience alias

The current-workspace alias remains available:

- `/p/:port`

This is a convenience route only. It is not the default operator contract.

## Multi-port preview support

Workspace preview routing is canonical for multiple forwarded ports, not only a single fixture port.

- Configure multiple ports through `POST /api/workspaces/:workspaceId/ports` with `{ ports: [3000, 4173, 8787], forwardedHost? }`
- Inspect current preview metadata through `GET /api/workspaces/:workspaceId/ports`
- Inspect preview routing contract through `GET /api/workspaces/:workspaceId/preview-contract`

## Agent-generated app contract

Agent-generated apps are first-class preview targets when they expose a lightweight preview contract inside the workspace filesystem.

Recommended app-side contract files and routes:

- `/.well-known/preview-contract.json`
- `/api/contract`
- `/api/data`
- `/health`

The reusable product-owned helper for this is:

- `apps/skyequanta-shell/bin/workspace-agent-preview-app.mjs`

## Deploy-preview parity

The workspace-scoped preview URL is the canonical deploy-preview URL. The bridge reports this parity in preview metadata through:

- `defaultPublicPath`
- `defaultPublicUrl`
- `deployPreviewPath`
- `deployPreviewUrl`

## Smoke and proof

- `npm run workspace:proof:section7 -- --strict`
- `bash scripts/smoke-preview-routing.sh`
- Proof artifacts:
  - `docs/proof/SECTION_7_PREVIEW_ROUTING.json`
  - `docs/proof/STAGE_10_AGENT_APP_PREVIEW.json`
