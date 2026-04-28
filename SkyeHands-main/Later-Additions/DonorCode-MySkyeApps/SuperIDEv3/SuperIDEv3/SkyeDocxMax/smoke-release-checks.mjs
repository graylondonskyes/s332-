import fs from "fs";
import path from "path";
import playwright from "../SuperIDEv2-full-2026-03-09 (1) (1)/node_modules/playwright/index.js";

const baseUrl = process.argv[2] || "http://127.0.0.1:4177";
const appRoot = path.dirname(new URL(import.meta.url).pathname);
const { chromium } = playwright;

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, file), "utf8"));
}

function assertFile(file) {
  const absolute = path.join(appRoot, file.replace(/^\.\//, ""));
  if (!fs.existsSync(absolute)) {
    throw new Error(`Missing release file: ${file}`);
  }
}

function assertNoMissingLocalResponses(responses, pageName) {
  const missing = responses.filter((entry) => entry.status >= 400 && entry.local);
  if (missing.length) {
    throw new Error(`${pageName} missing local resources: ${missing.map((entry) => `${entry.status} ${entry.url}`).join(", ")}`);
  }
}

for (const file of [
  "index.html",
  "homepage.html",
  "offline.html",
  "manifest.json",
  "manifest.webmanifest",
  "service-worker.js",
  "sw.js",
  "_shared/skye/skyeSecure.js",
  "js/fallback-runtime.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-192.png",
  "assets/icons/maskable-512.png",
  "docs/SKYE_PACKAGE_FORMAT.md",
  "docs/DOCX_SUPPORT.md",
  "smoke/SMOKE_DIRECTIVE.md",
  "smoke/smoke-manual-checklist.md",
  "smoke/smoke-results-template.json"
]) {
  assertFile(file);
}

for (const manifestName of ["manifest.json", "manifest.webmanifest"]) {
  const manifest = readJson(manifestName);
  if (manifest.name !== "SkyeDocxMax" || manifest.short_name !== "SkyeDocxMax") {
    throw new Error(`${manifestName} has incorrect product name`);
  }
  if (manifest.start_url !== "./index.html") {
    throw new Error(`${manifestName} start_url must be ./index.html`);
  }
  for (const icon of manifest.icons || []) {
    assertFile(icon.src);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageResults = {};

for (const route of ["homepage.html", "offline.html", "index.html"]) {
  const responses = [];
  page.on("response", (response) => {
    const url = response.url();
    responses.push({
      url,
      status: response.status(),
      local: url.startsWith(baseUrl)
    });
  });
  const response = await page.goto(`${baseUrl.replace(/\/$/, "")}/${route}`, { waitUntil: "networkidle" });
  if (!response || response.status() >= 400) {
    throw new Error(`${route} failed with status ${response?.status()}`);
  }
  assertNoMissingLocalResponses(responses, route);
  pageResults[route] = {
    status: response.status(),
    title: await page.title()
  };
  page.removeAllListeners("response");
}

await browser.close();

console.log(JSON.stringify({
  ok: true,
  product: "SkyeDocxMax",
  baseUrl,
  pageResults,
  checkedAt: new Date().toISOString()
}, null, 2));
