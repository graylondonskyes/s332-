# SkyeGateFS13 Route Replacement Matrix

## Goal

Map scattered legacy auth endpoints to the future central `SkyeGateFS13` authority.

## Legacy to Canonical Mapping

### Login and identity

Legacy:

- `/api/auth-login`
- `/api/auth-signup`
- `/api/auth-me`
- `/api/auth-logout`
- `/api/auth-password-reset-request`
- `/api/auth-password-reset-confirm`

Canonical target:

- `/.netlify/functions/auth-login`
- `/.netlify/functions/auth-signup`
- `/.netlify/functions/auth-me`
- `/.netlify/functions/auth-logout`
- `/.netlify/functions/auth-forgot-password`
- `/.netlify/functions/auth-reset-password`
- `/.netlify/functions/auth-resend-verification`
- `/.netlify/functions/auth-verify-email`

### OAuth / centralized SSO

Legacy:

- portal-specific `/oauth/authorize`
- portal-specific `/oauth/token`
- portal-specific `/oauth/userinfo`
- portal-specific `/oauth/logout`
- portal-specific `/.well-known/*`

Canonical target:

- `/.netlify/functions/oauth-authorize`
- `/.netlify/functions/oauth-token`
- `/.netlify/functions/oauth-userinfo`
- `/.netlify/functions/oauth-logout`
- `/.netlify/functions/oauth-jwks`
- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration`

### Session bridge

Legacy:

- `/.netlify/functions/session-token`

Canonical target:

- keep route name if needed for compatibility
- implementation must become a bridge under the central auth issuer

### Key and token management

Legacy:

- `/api/token-issue`
- `/api/token-list`
- `/api/token-revoke`
- `/.netlify/functions/admin-keys`

Canonical target:

- central key/token issuance under `SkyeGateFS13`
- keep `admin-keys` as admin surface
- optionally add explicit:
  - `/.netlify/functions/auth-token-issue`
  - `/.netlify/functions/auth-token-list`
  - `/.netlify/functions/auth-token-revoke`

### Client registry and issuer ops

Legacy:

- portal-specific admin client registry routes
- portal-specific jwks rotation routes

Canonical target:

- `/.netlify/functions/admin-oauth-clients`
- `/.netlify/functions/admin-jwks`
- `/.netlify/functions/admin-jwks-rotate`

## Consumer Proxy Rule

Browser apps should not hardcode cross-origin direct auth calls.

Each consumer app should either:

- redirect to the central login/authorize flow, or
- call same-origin proxy routes that validate central auth and forward appropriately

## Compatibility Window

During migration, legacy endpoints may continue to exist as adapters, but:

- they must be backed by `SkyeGateFS13`
- they must not remain separate auth authorities
