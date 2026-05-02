# SkyeHands Browser Smoke Environment

Purpose: make real end-to-end browser verification available across SkyeHands dev areas without relying on a user-cache Chromium install.

## Installed Shared Browser Stack

The browser stack is installed inside the SkyeHands repo root:

- Browser cache: `.ms-playwright`
- Chromium: `.ms-playwright/chromium-1208/chrome-linux64/chrome`
- Chromium headless shell: `.ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell`
- FFmpeg: `.ms-playwright/ffmpeg-1011/ffmpeg-linux`

A repo-local Playwright package is available in the current SuperIDEv3 donor lane and is discovered by the verifier.

## Verify Once Per Session

From `/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main`:

```bash
node tools/browser-smoke/verify-browser-smoke-env.mjs
```

Expected output includes `ok: true` and a Chromium version.

## Run Any Browser Smoke With Repo Chromium

Use the wrapper from the SkyeHands root:

```bash
tools/browser-smoke/with-repo-chromium.sh <command...>
```

The wrapper sets:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.ms-playwright"
```

Then it verifies the browser stack before executing the command.

## SkyeDocxMax Example

Start the app server in one shell:

```bash
cd Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax
python3 -m http.server 4177
```

Run smoke from the SkyeHands root in another shell:

```bash
tools/browser-smoke/with-repo-chromium.sh node Later-Additions/DonorCode-MySkyeApps/SuperIDEv3/SuperIDEv3/SkyeDocxMax/smoke-standalone.mjs http://127.0.0.1:4177/index.html
```

## Repair If Browser Cache Is Deleted

From the SkyeHands root:

```bash
cd "AbovetheSkye-Platforms/SuperIDEv2"
PLAYWRIGHT_BROWSERS_PATH="/home/lordkaixu/ALPHA-13/s332-/SkyeHands-main/.ms-playwright" node node_modules/playwright/cli.js install chromium
```

## Agent Rule

Future agents should not stop at "Chromium missing". They must run the verifier first, use the wrapper, and only report a blocker if the verifier itself fails and the repair command cannot be completed.
