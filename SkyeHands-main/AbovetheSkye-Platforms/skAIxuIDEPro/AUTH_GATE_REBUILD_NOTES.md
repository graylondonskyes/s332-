# AUTH GATE REBUILD NOTES

This pass fixes the broken create-account/login gate in the full archive.

What changed:
- Replaced the dead inline auth logic in `s0l26/shared-runtime.js` with direct Netlify Identity widget launch buttons using `netlifyIdentity.open('signup')` and `netlifyIdentity.open('login')`.
- Removed the visible "Access request / support" pane from the shared login gate.
- Applied the shared login gate to the main `skAIxuide` runtime as well, so the IDE is no longer outside the auth lane.
- Forced AI calls to require an authenticated Identity session before the server-side AI route will run.
- Added shared auth-state broadcasting (`window.__S0L26_AUTH__` and `s0l26-auth-changed`) so the IDE can react to login/logout.
- Wired `skAIxuide/index.html` to restore and save workspace snapshots through `/.netlify/functions/workspace-sync` after Identity login.
- Rebuilt `skAIxuide/login.html` so it no longer posts to a dead `/login` route.

What still depends on Netlify site settings:
- Netlify Identity must already be enabled for the site.
- Registration must allow signups for public account creation.
- If email confirmation is enabled, new users must confirm email before first login.
