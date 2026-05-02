# SkyeGateFS13 Auth Runbook

`SkyeGateFS13` is the canonical auth and gateway authority for the SkyeHands ecosystem.

This project was forked from the upgraded `kAIxUGateway13` runtime base, but the canonical named home for the merged authority is now `Platforms-Apps-Infrastructure/SkyeGateFS13`.

## New route surface

Identity and sessions:
- `/auth/signup`
- `/auth/login`
- `/auth/logout`
- `/auth/me`
- `/auth/change-password`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/resend-verification`
- `/auth/verify-email`
- `/auth/app-login`
- `/auth/tokens/issue`
- `/auth/tokens/list`
- `/auth/tokens/revoke`
- `/session/token`

OAuth / OIDC:
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/userinfo`
- `/oauth/logout`
- `/.well-known/jwks.json`
- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration`

Admin auth management:
- `/admin/oauth/clients`
- `/admin/jwks`
- `/admin/jwks/rotate`
- `/admin/consents`

## Compatibility contract

- The clean `SkyeGateFS13` paths above are canonical.
- The raw `/.netlify/functions/*` endpoints remain valid as compatibility aliases.
- Existing `kx_live_*` virtual keys remain valid.
- `session-token` is no longer a separate JWT concept. It now issues a revocable SkyeGateFS13 bridge session bound to the source key.
- Existing gateway routes still resolve direct keys first, then key-bound SkyeGateFS13 session or OAuth access tokens.
- `admin-login` still supports `ADMIN_PASSWORD`, but can also authenticate central admin/founder/owner accounts by `email` + `password`.

## Schema domains added

The existing request-path `ensureSchema()` bootstrap now also creates:
- `users`
- `user_passwords`
- `user_sessions`
- `verification_tokens`
- `reset_tokens`
- `oauth_clients`
- `oauth_consents`
- `oauth_authorization_codes`
- `oauth_refresh_tokens`
- `oauth_signing_keys`

## Runtime notes

- If `AUTH_EMAIL_WEBHOOK_URL` is unset, verification and reset routes still work and return preview tokens in API responses.
- If `SKYGATE_ISSUER` is unset, auth and OAuth token issuers are derived from the request host.
- JWKS signing keys are generated lazily on first auth-token issuance or first JWKS/OAuth use.

## Downstream client guidance

- Browser apps should use `auth-login` for first-party login, then carry the returned bearer session token.
- OAuth clients should register through `admin-oauth-clients` and then use `oauth-authorize` + `oauth-token`.
- App/service clients should use `auth-app-login` or `oauth-token` with `client_credentials`.
- Downstream apps should stop minting their own primary auth and instead proxy or redirect into these routes.
