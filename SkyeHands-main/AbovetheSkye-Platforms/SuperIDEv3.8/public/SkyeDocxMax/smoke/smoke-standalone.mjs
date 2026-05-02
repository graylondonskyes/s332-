import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "smoke", "last-standalone-smoke.json");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(__dirname, "../../.ms-playwright");
const require = createRequire(import.meta.url);
const { chromium } = require("../../SuperIDEv2/node_modules/playwright");

function writeResult(payload) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
}

const url = process.argv[2] || process.env.SKYEDOCXMAX_SMOKE_URL || "<standalone-preview-url>/index.html";
const startedAt = new Date().toISOString();
const consoleMessages = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.App && window.App.quill && document.querySelector("#editor-container"), null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[data-super-push="1"]'), null, { timeout: 10000 });

  const result = await page.evaluate(async () => {
    const title = document.title;
    const appReady = Boolean(window.App && window.App.quill);
    const secureReady = Boolean(window.SkyeSecure && window.SkyeSecure.encryptSkyePayload);
    const bridgeReady = Boolean(document.querySelector('[data-super-push="1"]'));
    await window.App.createDoc("Smoke SkyeDocxMax", "<h1>Smoke SkyeDocxMax</h1><p>Standalone save proof.</p>");
    await new Promise((resolve) => setTimeout(resolve, 350));
    const doc = window.App.getActiveDocRecord();
    const encrypted = await window.SkyeSecure.encryptSkyePayload(JSON.stringify({ ok: true, app_id: "SkyeDocxMax" }), "smoke-passphrase");
    const decrypted = await window.SkyeSecure.decryptSkyePayload(encrypted, "smoke-passphrase");
    localStorage.setItem("skyedocxmax.smoke.marker", JSON.stringify({ title: doc?.title, at: new Date().toISOString() }));
    return {
      title,
      appReady,
      secureReady,
      bridgeReady,
      activeDocTitle: doc?.title || "",
      encryptedRoundTrip: JSON.parse(decrypted).ok === true,
      evidenceKeys: Object.keys(localStorage).filter((key) => key.startsWith("skyedocxmax.")),
    };
  });

  if (!result.title.includes("SkyeDocxMax")) throw new Error(`Unexpected title: ${result.title}`);
  if (!result.appReady) throw new Error("App did not initialize.");
  if (!result.secureReady) throw new Error("SkyeSecure runtime did not initialize.");
  if (!result.bridgeReady) throw new Error("Cross-app bridge buttons did not initialize.");
  if (result.activeDocTitle !== "Smoke SkyeDocxMax") throw new Error("Document create/open smoke failed.");
  if (!result.encryptedRoundTrip) throw new Error("Encrypted .skye round-trip smoke failed.");

  const severeMessages = consoleMessages.filter((message) => {
    return !message.includes("Failed to load resource") &&
      !message.includes("ERR_FAILED") &&
      !message.includes("404") &&
      !message.includes("net::ERR");
  });
  if (severeMessages.length) {
    throw new Error(`Browser errors:\n${severeMessages.join("\n")}`);
  }

  const payload = {
    ok: true,
    suite: "SkyeDocxMax standalone smoke",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    url,
    result,
  };
  writeResult(payload);
  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  const payload = {
    ok: false,
    suite: "SkyeDocxMax standalone smoke",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    url,
    error: String(error?.message || error),
    consoleMessages,
  };
  writeResult(payload);
  throw error;
} finally {
  await browser?.close();
}
