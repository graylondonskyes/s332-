# Browser Smoke Environment

Purpose: prevent future browser-smoke blockers caused by missing Chromium, missing Playwright browsers, or unclear environment paths.

## Installed In Repo

The browser smoke stack is intentionally installed inside this repo:

- Playwright package: `SuperIDEv3/SuperIDEv2-full-2026-03-09 (1) (1)/node_modules/playwright`
- Playwright core package: `SuperIDEv3/SuperIDEv2-full-2026-03-09 (1) (1)/node_modules/playwright-core`
- Repo-local browser cache: `SuperIDEv3/.ms-playwright`
- Chromium: `SuperIDEv3/.ms-playwright/chromium-1208/chrome-linux64/chrome`
- Chromium headless shell: `SuperIDEv3/.ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`
- FFmpeg: `SuperIDEv3/.ms-playwright/ffmpeg-1011/ffmpeg-linux`

## Required Rule For Future Agents

Do not use the default `~/.cache/ms-playwright` browser path for repo verification.

Use the repo-local browser path:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/SuperIDEv3/.ms-playwright"
```

The SkyeDocxMax smoke script already defaults to this repo-local path when run from the repo as currently structured.

## Verify Environment

From the outer workspace root:

```bash
cd SuperIDEv3/SkyeDocxMax
node verify-browser-smoke-env.mjs
```

This launches Chromium headlessly and fails loudly if any browser or Playwright file is missing.

## Run SkyeDocxMax Smoke

Start the static server:

```bash
cd SuperIDEv3/SkyeDocxMax
python3 -m http.server 4177
```

In another shell:

```bash
cd SuperIDEv3/SkyeDocxMax
node smoke-standalone.mjs http://127.0.0.1:4177/index.html
```

Expected successful result includes:

- `appReady: true`
- `secureReady: true`
- `bridgeReady: true`
- `activeDocTitle: "Smoke SkyeDocxMax"`
- `encryptedRoundTrip: true`

## Repair Command

If the browser cache is ever deleted, restore it with:

```bash
cd "SuperIDEv3/SuperIDEv2-full-2026-03-09 (1) (1)"
PLAYWRIGHT_BROWSERS_PATH="../.ms-playwright" node node_modules/playwright/cli.js install chromium
```
