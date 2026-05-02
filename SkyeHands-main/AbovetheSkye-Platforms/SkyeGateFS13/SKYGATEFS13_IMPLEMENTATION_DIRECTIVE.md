# SkyeGateFS13 Implementation Directive

## Objective

Advance `SkyeGateFS13`, derived from `kAIxUGateway13`, into the only auth and gateway authority for the SkyeHands ecosystem.

This implementation must replace scattered auth behavior with a single central authority that handles:

- account identity
- sessions
- OAuth/OIDC issuer behavior
- JWKS and discovery
- app/client registration
- API keys / virtual keys / app tokens
- policy and role enforcement
- wallet / budget / debit / refund / top-up control
- gateway authorization
- admin governance

## Non-Negotiable Rules

1. `SkyeGateFS13` is authoritative.
   Every downstream platform becomes a client or proxy of this system.

2. No new peer auth systems may remain.
   Existing auth stacks may only survive as:
   - imported code into `SkyeGateFS13`
   - compatibility adapters
   - deprecated donor references

3. Existing Gateway13 operational features must not regress.
   Preserve:
   - gateway-chat / stream / embed
   - customers / keys / devices
   - billing / invoices / topups
   - GitHub / Netlify push
   - admin / user dashboards
   - monitoring

4. The implementation should prefer additive compatibility at first.
   Introduce the new authority without breaking existing working routes immediately, then re-point old flows to the new core.

## Canonical Donor Imports

### Import from `solesheetslogin`

Absorb these capabilities:

- login / signup / logout / me
- forgot/reset password
- resend verification / verify email
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/userinfo`
- `/oauth/logout`
- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration`
- JWKS publication and rotation
- PKCE verification
- consent model
- OAuth client registry
- refresh token rotation

### Import from `0megaSkyeGate-The-Actual-Gate`

Absorb these capabilities:

- session JWT verification with revocation lookup
- app token verification patterns
- admin token verification patterns
- policy guard concepts
- wallet reserve/debit/finalize/refund concepts
- stronger issuer/session model
- trace/job auth visibility semantics

### Downstream systems to demote

- `SuperIDEv3.8` local auth and token issuance
- app-local password/session authorities
- standalone platform-local token minting

## Runtime Decision

Keep Gateway13's Netlify + Netlify DB runtime as the canonical base.

Do not re-platform this first slice to Cloudflare Workers.

The Worker-based ideas from `0megaSkyeGate` are donors, not the runtime base.

## Target Route Surface

### Identity + session routes

Add canonical auth routes under Netlify functions:

- `auth-login`
- `auth-signup`
- `auth-logout`
- `auth-me`
- `auth-change-password`
- `auth-forgot-password`
- `auth-reset-password`
- `auth-resend-verification`
- `auth-verify-email`

### OAuth / OIDC routes

- `oauth-authorize`
- `oauth-token`
- `oauth-userinfo`
- `oauth-logout`
- `oauth-jwks`
- `oauth-well-known`
- `openid-configuration`

### OAuth admin / registry routes

- `admin-oauth-clients`
- `admin-jwks`
- `admin-jwks-rotate`
- `admin-consents`

### Unified token / key routes

These must coexist with existing Gateway13 key semantics:

- `session-token`
  Change from “sub-key -> session only” to a subordinate bridge under the new auth authority.

- `admin-keys`
  Continue to manage virtual keys.

- add or upgrade:
  - `auth-token-issue`
  - `auth-token-list`
  - `auth-token-revoke`
  - `auth-app-login`

Names can be adapted to match existing conventions, but the capability must exist.

## Target Internal Module Layout

Create or extend `_lib` with explicit central auth modules:

- `_lib/identity.js`
  user lookup, normalization, profile loading

- `_lib/sessions.js`
  human session issuance, revocation, lookup, cookie/session bridging

- `_lib/oauth.js`
  authorization code, PKCE, access token, refresh token, client registry, consent

- `_lib/jwks.js`
  RSA key management, JWK serialization, rotation policy

- `_lib/passwords.js`
  hash/verify password, reset token handling

- `_lib/emailAuth.js`
  verify-email / reset / resend logic

- `_lib/policy.js`
  unified policy guard for user/app/admin/key routes

- `_lib/wallet.js`
  reserve/debit/finalize/refund wrappers over Gateway13 usage model

- `_lib/authBridge.js`
  compatibility layer between old Gateway13 key auth and new session/OAuth authority

If equivalent helpers already exist, extend them rather than duplicating them.

## Database Work

Gateway13 currently owns customer/key/usage/device/billing tables.

Add canonical auth tables for:

- users
- user_passwords or password fields
- user_sessions
- verification_tokens
- reset_tokens
- oauth_clients
- oauth_consents
- oauth_authorization_codes
- oauth_refresh_tokens
- oauth_signing_keys
- auth_audit_events or equivalent extension of existing audit/events

Requirements:

- use `create table if not exists` / additive migration style consistent with current Gateway13 `ensureSchema`
- do not break existing Gateway13 schema bootstrap
- allow coexistence between legacy key-based auth and new user/session/OAuth auth

## Compatibility Strategy

### Phase 1 compatibility

Keep existing key-based Gateway13 access working.

Add central auth authority in parallel, then make these old flows subordinate:

- `session-token`
- admin login
- user dashboard auth
- key lookup flows

### Phase 2 compatibility

Expose compatibility endpoints and helpers so client apps can move without breaking:

- browser login redirect flow
- same-origin proxy recommendation
- bearer access token flow
- session-based browser flow

### Phase 3 authority consolidation

Re-point downstream apps so they no longer mint or validate primary auth locally.

## Gateway Authorization Rules

The final system must support these principal types:

- user session
- oauth access token
- app token / virtual key
- admin token

Each route must declare what principal classes are allowed.

Examples:

- `gateway-chat`, `gateway-stream`, `gateway-embed`
  allow app tokens and authorized session/app principals according to policy

- admin routes
  admin principal only

- user dashboard routes
  user session or oauth access token with correct scope

## Roles and Scope

Define a unified role/scope model that can cover:

- founder
- owner
- admin
- deployer
- operator
- viewer
- app

OAuth scopes should minimally support:

- `openid`
- `profile`
- `email`
- `offline_access`
- `gateway.invoke`
- `gateway.read`
- `keys.read`
- `keys.write`
- `admin.read`
- `admin.write`
- `billing.read`
- `billing.write`

Map legacy Gateway13 capabilities into this scope model.

## Security Requirements

1. Sessions must be revocable server-side.
2. Refresh tokens must rotate one-time-use.
3. OAuth codes must be short-lived and PKCE-validated.
4. Signing keys must support JWKS publication and rotation.
5. Password reset and email verification tokens must be stored hashed.
6. Admin access must not depend solely on one static password forever if a stronger model is available.
7. Legacy compatibility must not create an auth bypass.

## UI Requirements

Preserve existing Gateway13 admin and user surfaces, but extend them to expose:

- client registry
- consent state if needed
- session overview if useful
- JWKS/key rotation controls
- auth status and issuer metadata

Do not destroy the current dashboards just to add auth.

## Recommended Execution Order

### Slice A: foundation

1. Add auth DB tables into the existing `ensureSchema` model.
2. Add `_lib/oauth.js`, `_lib/sessions.js`, `_lib/jwks.js`, `_lib/passwords.js`, `_lib/authBridge.js`.
3. Add canonical auth routes and well-known/JWKS endpoints.

### Slice B: compatibility bridge

4. Make `session-token.js` use the new central auth internals.
5. Update admin/user auth checks to accept the new issuer/session model.
6. Keep existing key auth working through bridge helpers.

### Slice C: dashboard wiring

7. Add admin routes for OAuth clients and signing-key controls.
8. Wire dashboard UI minimally for auth authority visibility.

### Slice D: authority enforcement

9. Introduce explicit route policy checks for principal type + scope + role.
10. Document consumer migration contract.

## Required Deliverables

The implementation is not complete unless all of these exist:

1. canonical auth route set in Gateway13
2. canonical oauth/oidc route set in Gateway13
3. jwks + discovery endpoints
4. session revocation model
5. refresh token rotation
6. compatibility bridge for existing key/session flows
7. additive DB schema for new auth domains
8. clear migration docs for downstream platforms

## Review Standard

When done, verify:

- existing Gateway13 build/runtime still makes sense
- old key-based gateway calls still work or fail only by intentional policy
- central auth routes are internally coherent
- no new scattered auth authority is introduced
- the implementation moves the repo closer to one gate, not a fifth auth system
