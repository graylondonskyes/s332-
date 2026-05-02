# SkyeGateFS13 Consumer Migration Map

## Purpose

This document defines how downstream SkyeHands apps must consume `SkyeGateFS13` once the central auth authority is in place.

It exists outside the `kAIxUGateway13` tree so core gateway work and consumer migration work can proceed in parallel.

## Current Consumer Patterns Found

### SuperIDEv3.8

Current auth behavior includes:

- browser calls to `/api/auth-login`
- browser calls to `/api/auth-signup`
- browser calls to `/api/auth-me`
- browser calls to `/api/token-issue`
- browser calls to `/api/token-list`
- browser calls to `/api/token-revoke`
- token persistence in `localStorage["kx.api.accessToken"]`
- token email persistence in `localStorage["kx.api.tokenEmail"]`
- helper wrappers in `public/_shared/standalone-session.js`
- helper wrappers in `public/_shared/auth-unlock.js`

### 0s Auth SDK

Current behavior:

- compatibility login page at `/0s-auth-sdk/0s-login.html`
- local browser session stubbing via `SkyeStandaloneSession`

This is not a real central auth authority and must be reduced to a compatibility client or retired.

### Standalone platform pages

Patterns found across platform pages:

- direct use of `SkyeStandaloneSession`
- fallback reads from `kx.api.accessToken`
- auth-dependent calls to `/api/auth-me`
- auth-dependent calls to `/api/token-*`

## Canonical Consumer Contract

All consumer apps must move to this model:

### 1. Human login

Human browser apps should redirect to the central `SkyeGateFS13` login/authorize flow.

Recommended model:

- browser redirects to central authorize/login
- app receives session or OAuth callback result
- app stores only minimal client state
- app does not become its own password/session authority

### 2. Browser session state

`SkyeStandaloneSession` may survive only as a client helper.

Allowed future responsibilities:

- remember current user profile
- remember bearer token/access token issued by `SkyeGateFS13`
- expose `authHeaders()` and `request()` helpers
- coordinate sign-in redirect and sign-out UX

Forbidden future responsibilities:

- invent its own primary auth authority
- mint local permanent tokens
- replace central session validation

### 3. API calls

Every platform should call:

- its own same-origin proxy routes, or
- same-origin backend routes that validate central auth

Those routes must validate tokens/sessions from `SkyeGateFS13`.

### 4. Token classes used by consumers

Consumers should not treat every token as the same thing.

Use:

- browser user session or OAuth access token for user-facing apps
- app token / virtual key for automation or server-to-server gateway use
- admin token only for central admin surfaces

## Replacement Mapping

### Replace these consumer endpoints

Legacy consumer-facing endpoints:

- `/api/auth-login`
- `/api/auth-signup`
- `/api/auth-me`
- `/api/token-issue`
- `/api/token-list`
- `/api/token-revoke`

Target replacement pattern:

- central auth authority in `SkyeGateFS13`
- local adapters/proxies as needed

### Replace these client storage assumptions

Legacy:

- `kx.api.accessToken`
- `kx.api.tokenEmail`

Target:

- central session/access token naming managed by `SkyeGateFS13` client contract
- compatibility bridge may mirror old keys temporarily

## Phased Consumer Migration

### Phase 1

Do not break existing apps.

Introduce compatibility inside `SkyeGateFS13` so current consumers can still work while central authority goes live.

### Phase 2

Update shared client helpers:

- `SkyeStandaloneSession`
- `auth-unlock`
- `0s-auth-sdk`

to call and validate against `SkyeGateFS13`.

### Phase 3

Update individual apps and IDE surfaces to:

- stop assuming local auth issuance
- stop calling app-local auth routes as primary authority
- use central authorize/session flows

### Phase 4

Retire obsolete local auth paths once all consumers are migrated.

## Priority Consumer Surfaces

Highest priority migration surfaces:

1. `SuperIDEv3.8/src/App.tsx`
2. `SuperIDEv3.8/public/_shared/standalone-session.js`
3. `SuperIDEv3.8/public/_shared/auth-unlock.js`
4. `0s-auth-sdk`
5. shared standalone apps that call `/api/auth-me` or `/api/token-*`

## Success Condition

Consumer migration is complete when:

- no platform acts as its own primary auth authority
- no app-local password/session issuer remains canonical
- shared helpers only broker central auth
- all real auth decisions trace back to `SkyeGateFS13`
