# SkyeGateFS13 Merge Directive

## Canon

`SkyeGateFS13` is the single auth and gateway authority for the SkyeHands ecosystem.

This means:

- no platform-specific standalone auth authorities
- no parallel login issuers
- no app-local token minting as a primary authority
- no scattered OAuth/JWT/session stacks acting independently
- no direct provider auth or gateway bypass

Every platform must route identity, sessions, app authorization, gateway authorization, policy evaluation, and key issuance through `SkyeGateFS13`.

## Canonical Base

The canonical runtime base is:

- `AbovetheSkye-Platforms/kAIxUGateway13`

Reason:

- already owns the broadest Netlify production surface
- already has gateway, admin, customer, key, device, billing, push, monitoring, and user lanes
- already acts like the operational center of gravity

`Gateway13` is not the finished sovereign auth system. It is the deployment base that must be upgraded into `SkyeGateFS13`.

## Donor Systems

### 1. Gateway13

Keep as canonical host/runtime:

- gateway routes
- customer/key/device model
- billing, invoices, top-ups
- GitHub/Netlify push lanes
- monitoring/admin/user dashboards

Replace or upgrade:

- short-lived `session-token` pattern as the only session model
- any auth flows that assume raw sub-key minting is enough for ecosystem identity
- fragmented admin/user auth semantics that are not tied to one issuer

### 2. SOLE Sheets Login Portal

Source:

- `Later-Additions/Auth/Becomes A Login Portal - solesheetslogin`

Absorb into `SkyeGateFS13`:

- centralized login/signup/logout/me
- password reset and verification flows
- OAuth authorization code + PKCE
- refresh token rotation
- consent model
- client registry
- JWKS publication
- OIDC/OAuth discovery endpoints

This donor becomes the basis of the canonical identity issuer layer.

### 3. 0megaSkyeGate-The-Actual-Gate

Source:

- `Later-Additions/Auth/0megaSkyeGate-The-Actual-Gate`

Absorb into `SkyeGateFS13`:

- app token verification model
- session JWT + revocation model
- policy guard concepts
- wallet / reserve / debit / refund / finalize usage concepts
- provider routing abstraction
- trace/job visibility concepts

This donor contributes sovereign policy, wallet, and session authority ideas.

### 4. SuperIDEv3.8 Auth

Source:

- `SuperIDEv3.8/platform/local-auth.js`
- `SuperIDEv3.8/platform/server-auth.js`
- `SuperIDEv3.8/netlify/functions/auth-*`
- `SuperIDEv3.8/netlify/functions/token-*`

Role after merge:

- consumer only
- local receipt/session helpers may survive as client-side convenience
- no IDE-local auth authority remains canonical

## Required End State

`SkyeGateFS13` must own all of the following at once:

- account identity
- password and recovery flows
- session issuance and revocation
- OAuth/OIDC issuer duties
- JWKS and token discovery
- app/client registration
- app tokens / virtual keys / API keys
- session-to-key bridging
- customer/org/workspace authorization context
- device and seat enforcement
- policy and scope enforcement
- provider routing authorization
- usage metering
- wallet / budget / top-up / debit / refund
- audit trails
- admin governance

## Auth Model

### Canonical token classes

`SkyeGateFS13` should define and own these token classes:

1. Human session token
- user login session
- browser and app session authority
- revocable
- tied to issuer and subject

2. OAuth authorization code
- one-time
- PKCE-bound
- client-bound

3. OAuth access token
- for approved client apps
- scoped
- short-lived

4. OAuth refresh token
- rotating
- revocable
- client-bound

5. App token / virtual key
- non-human application access
- customer/org/app scoped
- rate/cap/policy bound

6. Admin token
- elevated admin-only authority
- strictly separated from user/app keys

### Canonical subject domains

`SkyeGateFS13` should normalize these subject types:

- user
- org
- workspace
- app/client
- api key / virtual key
- device/install
- session

## Platform Contract

Every downstream platform must become a client of `SkyeGateFS13`.

### Allowed downstream behavior

- redirect users to the central login/authorize flows
- validate returned session/access tokens
- call their own same-origin proxy functions which forward to `SkyeGateFS13`
- cache minimal client-side session state for UX

### Forbidden downstream behavior

- primary login databases per app
- local password authority
- local JWT issuer acting as peer authority
- local OAuth issuer
- platform-specific permanent API key minting
- direct provider key usage

## Migration Rule

All existing auth systems become one of:

- canonical code moved into `SkyeGateFS13`
- adapter/client of `SkyeGateFS13`
- deprecated donor to be retired

They may not remain equal peers.

## Merge Buckets

### Keep in base

- Gateway13 operational shell
- Gateway13 admin surface
- Gateway13 customer/key/device/billing/push/monitoring lanes

### Import from login portal

- OAuth authorize/token/userinfo/logout
- PKCE
- refresh token rotation
- consent
- JWKS
- well-known discovery
- email verification / reset / signup / login portal semantics

### Import from 0megaSkyeGate

- policy guard
- session revocation record model
- app token model
- wallet and reserve/finalize/refund concepts
- sovereign gateway auth semantics

### Downgrade to clients/adapters

- SuperIDEv3.8 auth issuance
- standalone platform-local auth
- any app-local admin login that is not central

## First Implementation Slice

The safest first implementation slice is:

1. create `SkyeGateFS13` auth namespace inside the Gateway13 base
2. import centralized issuer endpoints from `solesheetslogin`
3. define canonical JWT/JWKS/session tables and helpers
4. bridge existing Gateway13 key/customer model into the new issuer
5. make `session-token.js` subordinate to the new issuer rules
6. expose one canonical `/oauth/*`, `/.well-known/*`, `/auth/*`, and `/keys/*` authority

After that:

7. adapt `SuperIDEv3.8` and other platforms to consume the central authority
8. retire local issuer logic
9. absorb 0mega wallet/policy behavior into the Gateway13 core

## Success Condition

`SkyeGateFS13` is complete only when:

- every SkyeHands platform authenticates through it
- every app token or session token originates from it
- every AI/gateway call is authorized by it
- no parallel auth authority remains active elsewhere
