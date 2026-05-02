
# SOLEnterprises.org – AI Coding Agent Guide

## Architecture Overview
- **Firebase-hosted multi-page site**: Gate authentication, Firebase Auth, and Python FastAPI contact API.
- **Component-based HTML**: Pages use a "Drop Zone" pattern—custom content inside `<main class="page" id="page-content">` with header/footer injected by JS.
- **Dynamic partials**: [assets/js/layout.js](assets/js/layout.js) injects [partials/header.html](partials/header.html) and [partials/footer.html](partials/footer.html) on every page. All nav dropdown logic is wired in JS after injection.
- **Highly stylized pages**: Per-page inline `<style>` blocks are the norm (see [Pages/Services.html](Pages/Services.html)). Global styles in [assets/css/style.css](assets/css/style.css).
- **Firebase integration**: Auth and Firestore via [assets/js/firebase.js](assets/js/firebase.js) (ESM, v12.7.0). Auth state managed in [assets/js/app.js](assets/js/app.js).
- **API boundaries**: Python FastAPI ([contact_api/app.py](contact_api/app.py)) for contact forms; Node.js Firebase Function ([functions/index.js](functions/index.js)) for DeepSeek API proxy.

## Key Patterns & Conventions
- **Page templates**: Use [Pages/_template.html](Pages/_template.html) or [Pages/_template-minimal.html](Pages/_template-minimal.html) for new pages. Place all custom code between `<!-- START CUSTOM PAGE CODE -->` and `<!-- END CUSTOM PAGE CODE -->`.
- **Partial injection**: Never place scripts in partials expecting them to run—always wire interactivity in [assets/js/layout.js](assets/js/layout.js) after injection.
- **Universe dropdown**: Must call `wireUniverseDropdown()` after header injection. Prevent double-wiring with `data-wired="1"`.
- **Gate authentication**: [index.html](index.html) and [standalone-gate/index.html](standalone-gate/index.html) use hardcoded key `444666` (client-side, demo only). On success, sessionStorage is set and user is redirected.
- **Auth nav**: [assets/js/app.js](assets/js/app.js) toggles login/profile/logout links based on Firebase auth state.
- **Per-page styles**: Always use inline `<style>` for custom animations/effects. Do not add new global CSS unless absolutely necessary.

## Developer Workflows
- **Local dev**: `firebase serve` (site at http://localhost:5000). For contact API: `cd contact_api && uvicorn app:app --reload --host 0.0.0.0 --port 8000` (requires SMTP env vars).
- **Deploy**: `firebase deploy` (all), `firebase deploy --only hosting`, or `firebase deploy --only functions`.
- **Testing**: Use the gate key, verify header/footer injection, and test Universe dropdown after page load.

## Integration Points
- **Firebase**: ESM imports from gstatic, v12.7.0. Auth and Firestore only.
- **Python API**: [contact_api/app.py](contact_api/app.py) (FastAPI, SMTP email). Not deployed with Firebase.
- **Node Functions**: [functions/index.js](functions/index.js) (DeepSeek API proxy, CORS enabled, Node 20).

## Common Pitfalls
- **Universe dropdown not working**: Ensure `wireUniverseDropdown()` is called after header injection and `data-wired` is set.
- **Inline styles missing**: Always use inline `<style>` in new pages (see [Pages/Services.html](Pages/Services.html)).
- **Nav/profile links not toggling**: Check [assets/js/app.js](assets/js/app.js) and element IDs in header partial.
- **Header/footer scripts not running**: All interactivity must be wired in [assets/js/layout.js](assets/js/layout.js), not in partial HTML.

## Key References
- [assets/js/layout.js](assets/js/layout.js): Partial injection, nav wiring
- [assets/js/app.js](assets/js/app.js): Auth state, nav toggling
- [assets/js/firebase.js](assets/js/firebase.js): Firebase config/exports
- [Pages/_template.html](Pages/_template.html): Page structure
- [Pages/Services.html](Pages/Services.html): Example of inline styles/animations
- [contact_api/app.py](contact_api/app.py): Python FastAPI contact handler
- [functions/index.js](functions/index.js): Node.js API proxy

---
If any section is unclear or missing, please provide feedback for further refinement.
