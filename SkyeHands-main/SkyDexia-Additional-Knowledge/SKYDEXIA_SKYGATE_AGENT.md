# SkyDexia SkyeGate Agent

## Mission

SkyDexia should treat `SkyeGateFS13` as the parent sovereign gate for the SkyeHands ecosystem.

That means:

- auth is not the only concern
- the gate is also responsible for usage tracking, billing hooks, key issuance, policy, GitHub/Netlify push clearance, and parent audit
- consumer apps may keep local app tables, but should no longer behave like independent primary auth authorities

## Canonical Project

- `AbovetheSkye-Platforms/SkyeGateFS13`

## Required Model

When integrating an app into `SkyeGateFS13`, SkyDexia should prefer this structure:

1. `SkyeGateFS13` handles primary identity, clearance, and parent tracking.
2. The app may keep local tables for app-specific state.
3. The app should call the gate for:
   - login/session validation
   - OAuth/OIDC
   - token issuance authority
   - gateway clearance or execution
   - parent metering/audit events
4. Local app routes may survive as compatibility adapters, but they must be backed by `SkyeGateFS13`.

## Integration Workflow

For any target app:

1. Run the integration scaffold:
   - `node SkyeGateFS13/scripts/scaffold-app-into-skygate.mjs --app-path <app> --app-id <slug>`
2. Inspect the generated dossier for:
   - legacy `/api/auth-*` usage
   - local token issuance assumptions
   - local auth/session helpers
   - Netlify redirect lanes
3. Convert the app to one of these patterns:
   - same-origin adapter routes backed by `SkyeGateFS13`
   - direct browser redirect into central `/auth/*` or `/oauth/*`
4. Preserve local app state only where it is app-specific.
5. Make sure the parent gate still records the action for usage/audit/billing.

## What SkyDexia Should Look For

- `SkyeStandaloneSession`
- `kx.api.accessToken`
- `/api/auth-login`
- `/api/auth-signup`
- `/api/auth-me`
- `/api/token-issue`
- `/api/token-list`
- `/api/token-revoke`
- local `requireUser` or equivalent middleware
- local `ADMIN_PASSWORD` / standalone auth issuers

## Success Condition

An app is properly integrated when:

- primary auth traces back to `SkyeGateFS13`
- the app no longer acts like a sovereign auth issuer
- app-specific state can still remain local
- gate-owned events can still be tracked and billed centrally
