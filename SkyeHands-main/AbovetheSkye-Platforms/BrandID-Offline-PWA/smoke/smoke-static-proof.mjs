import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

for (const rel of [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets/logo.svg",
  "icon-192.png",
  "assets/icon-512.png",
]) {
  if (!existsSync(path.join(root, rel))) {
    throw new Error(`Missing required BrandID PWA file: ${rel}`);
  }
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
for (const needle of [
  'navigator.serviceWorker.register("./sw.js"',
  'id="btnDownloadPrimary"',
  'id="btnDownloadMark"',
  'id="btnSaveBrief"',
  'id="btnExportBrief"',
  'id="btnImportBrief"',
  'id="contactForm"',
  'Offline: form sending disabled. Go online to submit.',
  'Diagnostics: ready. Offline-first shell is active. Default logo is local.',
  'brandid_offline_brief_v1',
]) {
  if (!html.includes(needle)) {
    throw new Error(`BrandID offline shell is missing required proof marker: ${needle}`);
  }
}

const manifest = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
if (manifest.display !== "standalone" || manifest.scope !== "./") {
  throw new Error("BrandID manifest no longer declares a standalone scoped PWA.");
}

const sw = readFileSync(path.join(root, "sw.js"), "utf8");
for (const needle of ["CORE_ASSETS", "cache.addAll", "navigate", "Offline and no cached shell found."]) {
  if (!sw.includes(needle)) {
    throw new Error(`BrandID service worker is missing expected offline contract: ${needle}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  platform: "BrandID-Offline-PWA",
  proof: [
    "Standalone offline shell files exist",
    "Service worker caches the local shell and assets",
    "SVG export controls exist",
    "Offline contact-form limitation is disclosed in the UI",
  ],
  limits: [
    "Does not prove first-load offline use before assets are cached",
    "Does not prove contact-form submission without network",
  ],
}, null, 2));
