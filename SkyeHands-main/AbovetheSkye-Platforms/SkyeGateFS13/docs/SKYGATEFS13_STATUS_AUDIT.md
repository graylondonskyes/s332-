# SkyeGateFS13 Status Audit

This file is the canonical truth document for the current `SkyeGateFS13` merge state.

It exists to separate:
- work that is truly implemented in local code
- work that is partially implemented or bridged
- work that is still blocked on deployment, migration, or live credentials

## Confirmed Implemented

### Gate project boundary
- `SkyeGateFS13` exists as an explicit project at `Platforms-Apps-Infrastructure/SkyeGateFS13`
- `kAIxUGateway13` remains the operational ancestor and compatibility base

### Auth authority
- Canonical auth endpoints exist under `/auth/*`
- OAuth/OIDC discovery, JWKS, token, and session endpoints exist
- `Gateway13` pricing logic and `pricing/pricing.json` were carried over intact

### Dashboards
- Admin dashboard exists at `/index.html`
- User dashboard exists at `/dashboard.html`
- User pricing lane exists and reads from the gate pricing catalog
- Ultimate env contract is represented in both the dashboard and a readable guide

### Vendor and env contract work
- `env.ultimate.template` is the single canonical env contract
- `ENV_ULTIMATE_READABLE.md` exists as the operator-facing guide
- Vendor registry and sovereign-variable surfaces exist

### Parent tracking foundation
- `platform-event-ingest` exists in the gate
- `SuperIDEv3.8` mirrors shared audit events upward into the gate

### Runtime wiring foundation
- The runtime shell recognizes `SKYGATEFS13_*` env aliases
- The runtime shell can target gate-origin, gate-token, and event-mirror vars
- Modified Theia/OpenHands launcher paths have gate wiring in code

## Confirmed Partial / Bridge State

### Runtime rename landing
- Filesystem rename is present:
  - `skyehands_runtime_control/`
  - `stage_44rebuild -> skyehands_runtime_control` symlink
- This is not yet a clean landed git rename

### Consumer migration
- `SuperIDEv3.8` is bridged to `SkyeGateFS13`
- `0s-auth-sdk` has compatibility bridging
- Broader platform migration is not complete

### Auth centralization
- Central gate auth is live in code
- Some consumers still retain local bridge logic for provisioning or compatibility
- This is not yet “all local auth removed”

### Pricing and billing visibility
- AI pricing and push pricing are visible
- Voice/mail/deploy/provider-wide customer accounting is not fully unified in the dashboards yet

## Not Done Yet

### Version-control landing
- The runtime rename is not cleanly landed in git
- `SkyeGateFS13` and migration work still sit inside a noisy, dirty worktree

### Repo-wide gate migration
- Not every active platform has been moved behind the gate-parent model
- Historical/archive trees have not been mass-normalized

### Live deployment proof
- No final deployed proof has been completed for:
  - auth signup/login/me
  - OAuth flow
  - user/admin dashboards
  - runtime-to-gate launch proof
  - parent event ingest under live envs

### Final sovereign boundary
- We still need a final line-by-line statement of:
  - what the gate owns centrally
  - what apps may keep locally
  - what must remain bridge-only

## Current Honest Boundary

As of this audit:
- the gate is real
- the runtime hooks are real
- the dashboards are real
- the env/vendor scaffolding is real
- the parent-event lane is real

But:
- the rename is not cleanly landed in git
- the repo-wide migration is not complete
- the system is not yet fully deployment-proven
- “missing only live vars” is only true for specific slices, not the whole program
