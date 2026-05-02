# SkyeGateFS13 Positioning

## What Happened

The initial merge work was landed against `kAIxUGateway13` because that project already held the broadest operational gateway surface.

That was a valid runtime shortcut, but it was not the final naming and architecture boundary you asked for.

## Correct Boundary

The correct boundary is:

- `kAIxUGateway13` = ancestor runtime base
- `SkyeGateFS13` = explicit sovereign auth and gateway project

## Current State

`SkyeGateFS13` now exists as its own project folder and carries forward the merged auth/gateway work:

- central auth routes
- OAuth/OIDC routes
- JWKS and discovery
- key-bound bridge sessions
- canonical clean route aliases
- Netlify DB-backed schema bootstrap

## Going Forward

All further merge and migration work should target `Platforms-Apps-Infrastructure/SkyeGateFS13`.

`kAIxUGateway13` should be treated as the ancestor compatibility line, not the final project identity.
