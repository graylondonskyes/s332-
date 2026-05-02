#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { startLocalOpsServer } from "./local-ops-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function locatePlaywright() {
  const candidates = [
    process.env.VALLEYVERIFIED_PLAYWRIGHT_MODULE,
    path.resolve(root, "../SuperIDEv2/node_modules/playwright/index.js"),
    path.resolve(root, "../../SuperIDEv2/node_modules/playwright/index.js"),
    path.resolve(root, "../SuperIDEv3.8/node_modules/playwright/index.mjs"),
    path.resolve(root, "../../SuperIDEv3.8/node_modules/playwright/index.mjs"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function locateBrowserBundle() {
  const candidates = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.resolve(root, "../../.ms-playwright"),
    path.resolve(root, "../../../.ms-playwright"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function runBrowserSmoke() {
  const playwrightModule = locatePlaywright();
  if (!playwrightModule) {
    return { ok: false, skipped: true, reason: "Playwright module not found near ValleyVerified-v2" };
  }
  const browserBundle = locateBrowserBundle();
  if (browserBundle && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = browserBundle;
  }

  const playwright = playwrightModule.endsWith(".mjs")
    ? await import(pathToFileURL(playwrightModule).href)
    : require(playwrightModule);
  const chromium = playwright.chromium || playwright.default?.chromium;
  if (!chromium) {
    return { ok: false, skipped: false, reason: `Playwright chromium export missing for ${playwrightModule}` };
  }
  try {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "valleyverified-browser-proof-"));
    const runtime = await startLocalOpsServer({ dataDir });
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(`${runtime.baseUrl}/index.html`, { waitUntil: "networkidle" });

    await page.fill("#operatorEmail", "operator@internal.invalid");
    await page.fill("#operatorPassword", "smoke-pass-123");
    await page.click("#operatorLoginBtn");
    await page.waitForFunction(() => document.querySelector("#sessionNotice")?.textContent?.includes("Operator session ready"));

    await page.fill("#jobCompany", "Maggies");
    await page.fill("#jobTitle", "Dinner shift");
    await page.selectOption("#jobType", "restaurant_shift");
    await page.fill("#jobLocation", "Phoenix");
    await page.fill("#jobRate", "15000");
    await page.fill("#jobDescription", "Front-of-house dinner coverage.");
    await page.click("#postJobBtn");
    await page.waitForFunction(() => document.querySelector("#notice")?.textContent?.includes("Posted"));

    await page.fill("#contractorName", "Jordan");
    await page.fill("#contractorEmail", "jordan@internal.invalid");
    await page.fill("#contractorArea", "Phoenix");
    await page.fill("#contractorSkills", "restaurant_shift");
    await page.selectOption("#contractorStatus", "verified");
    await page.click("#contractorBtn");
    await page.waitForFunction(() => document.querySelector("#notice")?.textContent?.includes("Onboarded contractor"));

    await page.click(".claim-btn");
    await page.waitForFunction(() => document.querySelector("#notice")?.textContent?.includes("Claim accepted"));

    await page.click('.fulfillment-btn[data-status="fulfilled"]');
    await page.waitForFunction(() => document.querySelector("#notice")?.textContent?.includes("moved to fulfilled"));
    await page.waitForFunction(() => document.querySelector("#fulfillmentsList")?.textContent?.includes("fulfilled"));

    const summary = await page.evaluate(() => ({
      sessionNotice: document.querySelector("#sessionNotice")?.textContent || "",
      notice: document.querySelector("#notice")?.textContent || "",
      jobs: document.querySelectorAll("#jobsList .item").length,
      contractors: document.querySelectorAll("#contractorsList .item").length,
      fulfillments: document.querySelectorAll("#fulfillmentsList .item").length,
      fulfilledShown: document.querySelector("#fulfillmentsList")?.textContent?.includes("fulfilled") || false,
    }));

    assert(summary.jobs >= 1, "Browser proof did not render a job card");
    assert(summary.contractors >= 1, "Browser proof did not render a contractor card");
    assert(summary.fulfillments >= 1, "Browser proof did not render a fulfillment card");
    assert(summary.fulfilledShown, "Browser proof did not show a fulfilled fulfillment");
    await browser.close();
    await runtime.close();
    return { ok: true, skipped: false, summary, baseUrl: runtime.baseUrl };
  } catch (error) {
    if (error?.code === "EPERM" && error?.syscall === "listen") {
      return { ok: false, skipped: true, reason: "Sandbox blocked localhost bind for ValleyVerified-v2 browser smoke" };
    }
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runBrowserSmoke();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (!result.ok && !result.skipped) process.exitCode = 1;
}
