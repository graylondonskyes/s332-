import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const superIdeRoot = path.resolve(__dirname, "..");
const browserRoot = path.join(superIdeRoot, ".ms-playwright");
const donorRoot = path.join(superIdeRoot, "SuperIDEv2");
const playwrightPackage = path.join(donorRoot, "node_modules", "playwright");
const playwrightCorePackage = path.join(donorRoot, "node_modules", "playwright-core");

const requiredPaths = [
  path.join(browserRoot, "chromium-1208", "INSTALLATION_COMPLETE"),
  path.join(browserRoot, "chromium-1208", "chrome-linux64", "chrome"),
  path.join(browserRoot, "chromium_headless_shell-1208", "INSTALLATION_COMPLETE"),
  path.join(browserRoot, "chromium_headless_shell-1208", "chrome-headless-shell-linux64", "chrome-headless-shell"),
  path.join(browserRoot, "ffmpeg-1011", "INSTALLATION_COMPLETE"),
  path.join(browserRoot, "ffmpeg-1011", "ffmpeg-linux"),
  path.join(playwrightPackage, "package.json"),
  path.join(playwrightCorePackage, "package.json"),
];

const missing = requiredPaths.filter((item) => !fs.existsSync(item));
if (missing.length > 0) {
  console.error("Browser smoke environment is incomplete. Missing:");
  for (const item of missing) console.error(`- ${item}`);
  console.error("");
  console.error("Repair command:");
  console.error(`PLAYWRIGHT_BROWSERS_PATH="${browserRoot}" node "${path.join(playwrightPackage, "cli.js")}" install chromium`);
  process.exit(1);
}

process.env.PLAYWRIGHT_BROWSERS_PATH ||= browserRoot;
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightPackage, "index.js"));
const browser = await chromium.launch({ headless: true });
const version = browser.version();
await browser.close();

console.log(JSON.stringify({
  ok: true,
  playwright_browsers_path: browserRoot,
  playwright_package: playwrightPackage,
  chromium_version: version,
  smoke_command: "cd SuperIDEv3/SkyeDocxMax && node smoke-standalone.mjs <standalone-preview-url>/index.html",
}, null, 2));
