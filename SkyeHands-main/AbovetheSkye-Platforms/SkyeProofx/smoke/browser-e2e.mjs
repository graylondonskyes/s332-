import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const skyeHandsRoot = path.resolve(root, "..", "..");
const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(skyeHandsRoot, ".ms-playwright");
const knownPlaywrightPackages = [
  path.join(skyeHandsRoot, "AbovetheSkye-Platforms", "SuperIDEv2", "node_modules", "playwright"),
  path.join(skyeHandsRoot, "Dynasty-Versions", "node_modules", "playwright"),
  path.join(skyeHandsRoot, "stage_44rebuild", "node_modules", "playwright")
];
const playwrightPackage = knownPlaywrightPackages.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));

if (!playwrightPackage) {
  throw new Error("No repo-local Playwright package found for SkyeProofx browser smoke.");
}

process.env.PLAYWRIGHT_BROWSERS_PATH = browserRoot;
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightPackage, "index.js"));

function mimeType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function createStaticServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = path.join(root, rel.replace(/^\/+/, ""));
    if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": mimeType(full), "cache-control": "no-store" });
    res.end(fs.readFileSync(full));
  });
}

const server = createStaticServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
let result;
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.__skyeProofxTestApi?.runLocalVaultFlowE2E), null, { timeout: 10000 });
  result = await page.evaluate(() => window.__skyeProofxTestApi.runLocalVaultFlowE2E());
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const requiredEvents = ["vault_built", "vault_loaded", "vault_unlocked", "file_decrypted", "manifest_loaded", "verification_run"];
const missingEvents = requiredEvents.filter((event) => !result.activityEvents.includes(event));

console.log(JSON.stringify({
  ok: result.ok === true && missingEvents.length === 0 && result.verifyStatuses.every((status) => status === "ok"),
  folder: "SkyeProofx",
  base_url: baseUrl,
  result,
  missing_events: missingEvents
}, null, 2));

if (result.ok !== true || missingEvents.length > 0 || result.verifyStatuses.some((status) => status !== "ok")) {
  process.exit(1);
}
