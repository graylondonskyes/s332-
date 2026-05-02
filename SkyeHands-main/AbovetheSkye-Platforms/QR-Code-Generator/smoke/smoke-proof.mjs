import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import qrRuntime from "../assets/qr-runtime.js";
import { runBrowserSmoke } from "./smoke-browser.mjs";

const root = path.resolve(process.cwd());

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relPath) {
  const fullPath = path.join(root, relPath);
  assert(existsSync(fullPath), `Missing required file: ${relPath}`);
  return readFileSync(fullPath, "utf8");
}

const indexHtml = read("index.html");

assert(indexHtml.includes("QR Code Generator"), "index.html is missing the QR Code Generator title");
assert(indexHtml.includes("qrCanvas"), "index.html is missing the QR render canvas");
assert(indexHtml.includes("qrcode.min.js"), "index.html is missing the QRCode library");
assert(indexHtml.includes("jspdf"), "index.html is missing PDF export support");
assert(indexHtml.includes("QRCodeLib.toCanvas"), "index.html is missing QR render logic");
assert(indexHtml.includes("canvas.toDataURL"), "index.html is missing image export logic");
assert(indexHtml.includes("const { jsPDF } = window.jspdf;"), "index.html is missing PDF generation logic");
assert(indexHtml.includes('doc.save("sol-qr-report.pdf")'), "index.html is missing PDF save logic");
assert(indexHtml.includes("assets/qr-runtime.js"), "index.html is missing local QR runtime helper");
assert(indexHtml.includes('id="presetSelect"'), "index.html is missing preset selection surface");
assert(indexHtml.includes('id="qrHistory"'), "index.html is missing local activity history surface");
assert(!indexHtml.includes('/js/main.js'), "index.html still references /js/main.js outside this folder");
assert(!indexHtml.includes('/js/partials.js'), "index.html still references /js/partials.js outside this folder");
assert(!indexHtml.includes('/js/SkyeSolINTRO.js'), "index.html still references /js/SkyeSolINTRO.js outside this folder");
assert(existsSync(path.join(root, "smoke/smoke-browser.mjs")), "Missing browser smoke: smoke/smoke-browser.mjs");

const mem = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, String(value)); },
};
qrRuntime.savePreset(mem, { label: "Phoenix", text: "https://solenterprises.org", size: 500, fgColor: "#000000", bgColor: "#ffffff" });
qrRuntime.recordHistory(mem, { text: "https://solenterprises.org", size: 500, fgColor: "#000000", bgColor: "#ffffff", exportType: "png" });
assert(qrRuntime.listPresets(mem).length === 1, "QR runtime preset storage failed");
assert(qrRuntime.listHistory(mem).length === 1, "QR runtime history storage failed");

const browserProof = await runBrowserSmoke();
assert(browserProof.ok === true || browserProof.skipped === true, "QR browser smoke did not report ok or an honest skip");

console.log(JSON.stringify({
  ok: true,
  platform: "QR-Code-Generator",
  status: "partial",
  proof: [
    "Static browser QR generation surface present",
    "Canvas render path present",
    "PNG export path present",
    "PDF export path present",
    "Preset and local activity runtime helpers execute",
    ...(browserProof.ok ? ["Browser render and export smoke passed"] : []),
    ...(browserProof.skipped ? [`Browser render and export smoke skipped honestly: ${browserProof.reason}`] : []),
    "The page no longer depends on stray same-site /js script paths outside this folder"
  ],
  browser_proof: browserProof,
  unproven: [
    "Runtime depends on remote CDN libraries"
  ]
}, null, 2));
