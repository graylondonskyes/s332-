# Hardening Notes

This pass focuses on surgical production-safety upgrades, not feature creep.

## What changed

- Bootstrap accounts now require immediate password rotation on first login.
- Admin password changes now enforce a stronger password policy.
- Repeated failed logins now trigger a lockout window.
- Authenticated write endpoints now require a CSRF token.
- Session cookies can run in secure-only mode under HTTPS.
- Admin users are now scoped to an org.
- Inbound voice webhooks now support signed request verification.
- Local fake delivery is removed. Voice and outbound only run when a real rail is configured.
- The release database is reset before packaging so demo leads, transcripts, sessions, and admin sessions do not ship.

## Production checklist

1. Copy `.env.example` to `.env`.
2. Set `APP_ENV=production`.
3. Set `SESSION_COOKIE_SECURE=true`.
4. Replace all bootstrap passwords.
5. Set `VOICE_WEBHOOK_SECRET` to a long random secret.
6. Set real `SMS_WEBHOOK_URL`, `EMAIL_WEBHOOK_URL`, and `VOICE_WEBHOOK_URL` values.
7. Add real Google and Microsoft calendar tokens.
8. Run `python3 smoke/smoke_test.py` before public deployment.

## Important note

This repo is harder now, but it is still a lightweight Python + SQLite deployment. If you expect heavy concurrent traffic, large multi-team usage, or strict enterprise audit controls, the next pass should move runtime and database hardening further.
