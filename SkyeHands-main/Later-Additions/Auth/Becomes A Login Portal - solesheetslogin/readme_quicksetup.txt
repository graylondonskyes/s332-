SOLE SHEETS LOGIN PORTAL (NETLIFY + NEON + RESEND + CROSS-APP AUTH)

What this is now:
- index.html = login + signup + password-change + reset + verification portal UI
- netlify/functions = backend auth API
- Neon Postgres = user table, session table, login lockout table, verification token table, reset token table, oauth code table
- /app = server-protected route delivered through a Netlify Function
- /verify-email = pretty verification route through a Netlify Function
- /oauth/* = centralized auth endpoints for your other websites

Required Netlify environment variables:
1) NEON_DATABASE_URL
   - Your Neon Postgres connection string

2) CUSTOMER_JWT_SECRET
   - Preferred signing secret for portal sessions + OAuth tokens
   - Use at least 24 random characters

You may also use AUTH_SECRET or KAIXU_SERVICE_SECRET instead of CUSTOMER_JWT_SECRET.

Recommended email environment variables:
3) RESEND_API_KEY
   - Your Resend API key

4) AUTH_FROM_EMAIL
   - Verified sender, for example:
     Skyes Over London <auth@yourdomain.com>

5) AUTH_BASE_URL
   - Your public deployed auth portal URL, for example:
     https://yourlogin.netlify.app

Cross-project auth variables:
6) AUTH_OAUTH_CLIENTS_JSON
   - JSON describing every external website allowed to use this portal
   - Example:
     {
       "gray-app": {
         "name": "Gray App",
         "redirect_uris": ["https://gray-app.netlify.app/auth/callback"],
         "allowed_origins": ["https://gray-app.netlify.app"],
         "post_logout_redirect_uris": ["https://gray-app.netlify.app/"],
         "pkce_required": true,
         "public_client": true
       }
     }

7) AUTH_ALLOWED_ORIGINS
   - Optional comma-separated fallback CORS allowlist
   - Example:
     https://gray-app.netlify.app,https://another-app.netlify.app

Important cookie / browser variables:
- AUTH_COOKIE_SAMESITE = default is lax
- AUTH_COOKIE_DOMAIN = optional, usually leave blank
- AUTH_ALLOW_LOCALHOST_CORS = default true for local dev

Other optional variables:
- ADMIN_EMAILS = comma-separated list of emails that should become admins on signup
- AUTH_COOKIE_NAME = cookie name, default: kxp_session
- AUTH_SESSION_AGE_SECONDS = session lifetime, default: 604800
- AUTH_PASSWORD_MIN_LENGTH = minimum password length, default: 10
- AUTH_LOGIN_FAIL_LIMIT = failed login attempts before lock, default: 5
- AUTH_LOGIN_LOCK_MINUTES = lockout minutes, default: 15
- AUTH_REQUIRE_EMAIL_VERIFICATION = true/false, default: false
- AUTH_AUTO_SEND_VERIFICATION = true/false, default: true
- AUTH_PASSWORD_RESET_TTL_MINUTES = default: 60
- AUTH_EMAIL_VERIFY_TTL_HOURS = default: 48
- AUTH_EMAIL_ACTION_COOLDOWN_SECONDS = default: 60
- AUTH_OAUTH_CODE_TTL_SECONDS = default: 300
- AUTH_ACCESS_TOKEN_TTL_SECONDS = default: 3600
- AUTH_ID_TOKEN_TTL_SECONDS = default: 3600

Deploy:
- Put this folder in your Netlify site
- Run npm install
- Set env vars above
- Deploy

Portal endpoints:
- POST /.netlify/functions/signup
- POST /.netlify/functions/login
- GET  /.netlify/functions/me
- POST /.netlify/functions/logout
- POST /.netlify/functions/change-password
- POST /.netlify/functions/forgot-password
- POST /.netlify/functions/reset-password
- POST /.netlify/functions/resend-verification
- GET  /verify-email?token=...
- GET  /app

Cross-project auth endpoints:
- GET  /oauth/authorize
- POST /oauth/token
- GET  /oauth/userinfo
- GET  /oauth/logout
- GET  /.well-known/oauth-authorization-server
- GET  /.well-known/openid-configuration

Flow for another website:
- Generate PKCE verifier + challenge in the app
- Redirect user to /oauth/authorize with client_id + redirect_uri + state + code_challenge
- Receive code back at your app redirect_uri
- POST that code to /oauth/token with code_verifier
- Store the returned app tokens inside that app

Included helper/example file:
- oauth-client-example.html
  - shows the static-site redirect + PKCE + token-exchange pattern

Notes:
- The first auth call auto-creates the required Neon tables.
- Emails are normalized to lowercase.
- Logout is server-side revoked, not just cookie-cleared.
- Password changes revoke all sessions and issue a fresh current session.
- Verification and reset tokens are hashed in Neon before storage.
- OAuth authorization codes are one-time and short-lived.
- Redirect URIs are hard-checked against the registered client config.


NEW FOR V1.4.0
- Admin UI: /admin.html
- JWKS: /.well-known/jwks.json
- Refresh token TTL env: AUTH_REFRESH_TOKEN_TTL_DAYS
- JWKS grace env: AUTH_JWKS_ROTATION_GRACE_DAYS
- Admin account seeding: put your email in ADMIN_EMAILS before signup
