# SkyeHands Agent Instructions

## Browser Smoke Is Required When UI Changes

This repo has a repo-local Playwright browser stack. Do not claim browser smoke cannot run because Chromium is missing until you have checked the shared SkyeHands browser-smoke environment.

Canonical verifier:

```bash
node tools/browser-smoke/verify-browser-smoke-env.mjs
```

Canonical browser cache:

```bash
.ms-playwright
```

Required environment for any Playwright browser smoke:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.ms-playwright"
```

Reusable wrapper:

```bash
tools/browser-smoke/with-repo-chromium.sh <your smoke command...>
```

Example:

```bash
tools/browser-smoke/with-repo-chromium.sh node Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax/smoke-standalone.mjs http://127.0.0.1:4177/index.html
```

Installed repo-local browser files include Chromium, Chromium headless shell, and FFmpeg under `.ms-playwright`. If any of those are missing, repair with the command printed by `verify-browser-smoke-env.mjs`.

## No-Theater Verification Rule

For frontend work, real browser smoke is the default verification target. Static syntax checks are useful but do not replace browser smoke when the app has UI/runtime behavior.
