# Archive Login Gate Fix Notes

This pass corrected the broken archive/IDE auth flow.

## Fixed in this build
- The Netlify Identity user context fallback now reads `context.clientContext.user` and `context.clientContext.identity` correctly inside Netlify Functions.
- The archive-wide and IDE-specific auth overlays no longer depend on opening the popup widget as the only login path.
- Inline email/password auth is now wired directly into the overlays for login and account creation.
- Account creation attempts immediate sign-in; if email confirmation is enabled, the UI now tells the user exactly that.
- The static `s0l26-access-gate` Netlify Form is present in shipped HTML so Netlify can actually detect it at deploy time.
- Support / access note form still posts through Netlify Forms.

## Deploy note
For self-service signups, Netlify Identity must be enabled on the site and registration must be set to **Open**.
If registration is `Invite only`, the account-creation button will be blocked by Netlify's site settings.
