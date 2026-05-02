# SOLE Sheets Login Portal

A reusable Netlify Functions + Neon + Resend auth portal that now supports two lanes at once:

- direct portal auth with HttpOnly session cookies for the portal itself
- cross-project centralized auth with an authorization-code + PKCE flow so your other websites can redirect into this portal and come back with app tokens cleanly

## What is included now
- No Firebase or Firestore.
- Neon-backed users, sessions, login lockouts, verification tokens, reset tokens, and OAuth authorization codes.
- Resend-powered email verification and password reset.
- True protected server route at `/app`.
- OAuth-style endpoints for your other sites:
  - `/oauth/authorize`
  - `/oauth/token`
  - `/oauth/userinfo`
  - `/oauth/logout`
  - `/.well-known/oauth-authorization-server`
- CORS allowlist support so your approved app origins can exchange codes and call userinfo without browser fights.
- Cookie SameSite is now configurable and defaults to `lax`, which is the right baseline for redirect-based centralized auth.

## Core portal endpoints
- `POST /.netlify/functions/signup`
- `POST /.netlify/functions/login`
- `GET /.netlify/functions/me`
- `POST /.netlify/functions/logout`
- `POST /.netlify/functions/change-password`
- `POST /.netlify/functions/forgot-password`
- `POST /.netlify/functions/reset-password`
- `POST /.netlify/functions/resend-verification`
- `GET /verify-email?token=...`
- `GET /app`

## Cross-project auth endpoints
- `GET /oauth/authorize`
  - query: `response_type=code&client_id=...&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256`
- `POST /oauth/token`
  - body: `{"grant_type":"authorization_code","client_id":"...","redirect_uri":"...","code":"...","code_verifier":"..."}`
- `GET /oauth/userinfo`
  - header: `Authorization: Bearer <access_token>`
- `GET /oauth/logout`
  - optional query: `client_id=...&post_logout_redirect_uri=...`
- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/openid-configuration`

## Required environment variables
- `NEON_DATABASE_URL`
- `CUSTOMER_JWT_SECRET` or `AUTH_SECRET` or `KAIXU_SERVICE_SECRET`

## Recommended email variables
- `RESEND_API_KEY`
- `AUTH_FROM_EMAIL`
- `AUTH_BASE_URL` or `AUTH_ISSUER`

## Cross-project / SSO variables
- `AUTH_OAUTH_CLIENTS_JSON`
  - JSON object or array describing which external websites are allowed to use this portal.
- `AUTH_ALLOWED_ORIGINS`
  - comma-separated fallback origin allowlist for CORS.
- `AUTH_COOKIE_SAMESITE`
  - defaults to `lax`; set only to `none` if you truly need it and you are always on HTTPS.
- `AUTH_COOKIE_DOMAIN`
  - optional. Usually leave blank unless you intentionally want a shared cookie across the same registrable domain.
- `AUTH_ALLOW_LOCALHOST_CORS`
  - defaults to `true` for local development convenience.

## Example `AUTH_OAUTH_CLIENTS_JSON`
```json
{
  "gray-app": {
    "name": "Gray App",
    "redirect_uris": [
      "https://gray-app.netlify.app/auth/callback",
      "http://localhost:5173/auth/callback"
    ],
    "allowed_origins": [
      "https://gray-app.netlify.app",
      "http://localhost:5173"
    ],
    "post_logout_redirect_uris": [
      "https://gray-app.netlify.app/",
      "http://localhost:5173/"
    ],
    "pkce_required": true,
    "public_client": true
  }
}
```

## How the centralized flow works
1. Another website you own sends the user to `/oauth/authorize` with `client_id`, `redirect_uri`, `state`, and PKCE challenge values.
2. If the user is not signed in to the portal yet, the portal sends them through the normal login UI.
3. After sign-in, the portal redirects back to the registered `redirect_uri` with a one-time code.
4. Your app exchanges the code at `/oauth/token` with the original `code_verifier`.
5. Your app receives an access token, an id token, and public user data for that app session.

## Included helper/example file
- `oauth-client-example.html`
  - a static-site example showing how another website can start login, finish the PKCE exchange, and store app tokens locally.

## Security notes
- Passwords are hashed with bcrypt.
- Portal sessions are HttpOnly cookies plus Neon session rows.
- Logout and password change revoke server-side sessions.
- Reset and verification tokens are stored only as hashes.
- OAuth authorization codes are one-time and short-lived.
- Redirect URIs are checked against the registered client config.
- Token exchange requires PKCE `S256`.
- CORS is not open by default; it is controlled through the client registry and/or `AUTH_ALLOWED_ORIGINS`.

## First deploy checklist
1. Set Neon + JWT env vars.
2. Set Resend env vars.
3. Set `AUTH_BASE_URL` to the deployed auth portal URL.
4. Register every app in `AUTH_OAUTH_CLIENTS_JSON`.
5. Deploy the portal.
6. Test `/oauth/authorize` from one of your other apps.


## New in v1.4.0

- Refresh-token grant with one-time-use rotation stored in Neon
- User consent screen with remembered approvals per client
- Admin UI at `/admin.html` for client registry management
- RSA signing keys published at `/.well-known/jwks.json`
- Manual key rotation endpoint through the admin UI
- Discovery document now advertises JWKS + refresh_token grant

### New environment knobs

- `AUTH_REFRESH_TOKEN_TTL_DAYS`
- `AUTH_CONSENT_TTL_DAYS`
- `AUTH_JWKS_ROTATION_GRACE_DAYS`
- `AUTH_JWKS_RSA_BITS`

### Admin access

Admin APIs and `/admin.html` require a signed-in user whose role is `admin`. The simplest way to seed that is to include your email in `ADMIN_EMAILS` before creating the account.
