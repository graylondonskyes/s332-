import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skyeHandsRoot = path.resolve(__dirname, "..", "..");
const browserRoot = path.join(skyeHandsRoot, ".ms-playwright");
const knownPlaywrightPackages = [
  path.join(skyeHandsRoot, "AbovetheSkye-Platforms", "SuperIDEv2", "node_modules", "playwright"),
  path.join(skyeHandsRoot, "Dynasty-Versions", "node_modules", "playwright"),
  path.join(skyeHandsRoot, "stage_44rebuild", "node_modules", "playwright"),
];

const playwrightPackage = knownPlaywrightPackages.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
if (!playwrightPackage) {
  console.error("Browser smoke environment is incomplete. No repo-local Playwright package was found in known SkyeHands dev areas.");
  console.error("Known locations checked:");
  for (const item of knownPlaywrightPackages) console.error(`- ${item}`);
  process.exit(1);
}
const playwrightCorePackage = path.join(path.dirname(playwrightPackage), "playwright-core");

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
  console.error(`cd "${path.dirname(path.dirname(playwrightPackage))}"`);
  console.error(`PLAYWRIGHT_BROWSERS_PATH="${browserRoot}" node "${path.join(playwrightPackage, 'cli.js')}" install chromium`);
  process.exit(1);
}

process.env.PLAYWRIGHT_BROWSERS_PATH ||= browserRoot;
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightPackage, "index.js"));
const launchOptions = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
};
const browser = await chromium.launch(launchOptions);
const version = browser.version();
await browser.close();

console.log(JSON.stringify({
  ok: true,
  skyehands_root: skyeHandsRoot,
  playwright_browsers_path: browserRoot,
  playwright_package: playwrightPackage,
  chromium_version: version,
  launch_options: launchOptions,
  note: "Use this browserRoot for all SkyeHands browser smoke runs instead of ~/.cache/ms-playwright.",
}, null, 2));
