# IDE + Agent Convergence Contract

This contract makes `apps/skyequanta-shell` the one authoritative operating layer for the converged runtime.

## Source of truth

- Authoritative shell surface: `apps/skyequanta-shell/`
- Authoritative bridge: `apps/skyequanta-shell/lib/bridge.mjs`
- Authoritative session manager: `apps/skyequanta-shell/lib/session-manager.mjs`
- Authoritative workspace manager: `apps/skyequanta-shell/lib/workspace-manager.mjs`
- Authoritative runtime event bus: `apps/skyequanta-shell/lib/runtime-bus.mjs`
- Imported IDE/agent example paths are implementation dependencies and are not the product authority.

## Canonical runtime APIs

These routes exist on the bridge and are available under both `/` and `/w/:workspaceId` path families.

- `GET /api/runtime/context`
  - Returns the authoritative shell-owned workspace context, session context, lane state, preview state, and recent runtime events.
- `GET /api/runtime/health`
  - Returns explicit IDE lane health, agent lane health, and combined runtime health.
- `GET /api/runtime/events`
  - Returns recent runtime-bus events for the workspace.
- `POST /api/runtime/sync/file-operation`
  - Records canonical file-operation state from IDE or agent lanes.
- `POST /api/runtime/sync/preview-state`
  - Records canonical preview-state updates.
- `POST /api/runtime/sync/message`
  - Records canonical runtime-bus messages between shell, IDE, and agent lanes.

## Required runtime headers injected by the bridge

The bridge injects shell-owned headers into IDE and agent proxy traffic.

- `x-skyequanta-authoritative-surface`
- `x-skyequanta-runtime-lane`
- `x-skyequanta-workspace-id`
- `x-skyequanta-tenant-id`
- `x-skyequanta-session-id`
- `x-skyequanta-client-name`
- `x-skyequanta-auth-mode`

## Synchronization rules

- Session truth is owned by `session-manager.mjs`.
- Workspace truth is owned by `workspace-manager.mjs`.
- Converged lane activity is persisted by `runtime-bus.mjs`.
- Preview state is canonicalized through the runtime-bus projection for the active workspace.
- File-operation state from IDE and agent lanes is merged into one workspace projection.
- Combined runtime health is written back to the workspace projection after bridge health probes.

## Finish-condition interpretation for Section 4

Section 4 is only complete when:

1. IDE and agent traffic both route through the shell-owned bridge.
2. One workspace/session context is authoritative for both lanes.
3. File operations, preview state, and runtime messages converge into one runtime-bus projection.
4. IDE lane health, agent lane health, and combined runtime health are exposed and smoke-tested.
5. Product identity and runtime contract clearly state that imported examples are not authoritative.
