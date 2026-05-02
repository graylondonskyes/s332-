#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";

const root = process.cwd();
const outPath = path.join(root, "artifacts", "skydocxmax-embedded-smoke.json");
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(root, "../.ms-playwright");
const { chromium } = await import("playwright");

const siteBase = (process.env.SITE_BASE_URL || process.argv[2] || "http://127.0.0.1:4178").replace(/\/$/, "");
const wsId = process.env.WS_ID || "primary-workspace";

function findRepoChromium() {
  const explicit = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "").trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  const roots = [
    path.resolve(root, "../.ms-playwright"),
    path.resolve(root, "../../.ms-playwright"),
    path.resolve(root, "../../../.ms-playwright"),
    path.resolve(root, "../../../../.ms-playwright"),
  ];
  for (const browserRoot of roots) {
    if (!fs.existsSync(browserRoot)) continue;
    const candidates = fs
      .readdirSync(browserRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium_headless_shell-"))
      .map((entry) => path.join(browserRoot, entry.name, "chrome-headless-shell-linux64", "chrome-headless-shell"))
      .filter((candidate) => fs.existsSync(candidate))
      .sort()
      .reverse();
    if (candidates[0]) return candidates[0];
  }
  return "";
}

function writeResult(payload) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function checkRoute(browser, routePath) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err?.message || err)));
  const url = `${siteBase}${routePath}?ws_id=${encodeURIComponent(wsId)}`;
  const started = Date.now();

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForSelector("iframe.platform-frame", { timeout: 15000 });
    const result = await page.evaluate(() => {
      const frame = document.querySelector("iframe.platform-frame");
      const bodyText = document.body?.innerText || "";
      return {
        title: document.title,
        bodyText,
        frameSrc: frame?.getAttribute("src") || "",
        namesSkyeDocxMax: bodyText.includes("SkyeDocxMax"),
      };
    });

    const frameUrl = new URL(result.frameSrc, siteBase);
    const ok =
      response &&
      response.status() >= 200 &&
      response.status() < 400 &&
      result.namesSkyeDocxMax &&
      frameUrl.pathname === "/SkyeDocxMax/index.html" &&
      frameUrl.searchParams.get("embed") === "1" &&
      frameUrl.searchParams.get("ws_id") === wsId &&
      errors.length === 0;

    return {
      route: routePath,
      url,
      ok,
      status: response?.status() || 0,
      frameSrc: result.frameSrc,
      bodyChars: result.bodyText.length,
      errors,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      route: routePath,
      url,
      ok: false,
      status: 0,
      frameSrc: "",
      bodyChars: 0,
      errors: [String(error?.message || error), ...errors],
      ms: Date.now() - started,
    };
  } finally {
    await page.close();
  }
}

const startedAt = new Date().toISOString();
const executablePath = findRepoChromium();
const results = [];
let browser;

try {
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  results.push(await checkRoute(browser, "/skydocxmax"));
  results.push(await checkRoute(browser, "/skydocx"));

  const failures = results.filter((item) => !item.ok);
  for (const result of results) {
    const state = result.ok ? "PASS" : "FAIL";
    console.log(`[skydocxmax-embedded] ${state} ${result.route} status=${result.status} frame=${result.frameSrc} ms=${result.ms}`);
    for (const error of result.errors) console.error(`[skydocxmax-embedded] ${result.route} error: ${error}`);
  }

  const payload = {
    ok: failures.length === 0,
    suite: "SuperIDEv3.8 embedded SkyeDocxMax smoke",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    site_base_url: siteBase,
    ws_id: wsId,
    executable_path: executablePath || null,
    results,
  };
  writeResult(payload);
  if (failures.length) process.exit(1);
} catch (error) {
  writeResult({
    ok: false,
    suite: "SuperIDEv3.8 embedded SkyeDocxMax smoke",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    site_base_url: siteBase,
    ws_id: wsId,
    executable_path: executablePath || null,
    error: String(error?.message || error),
    results,
  });
  throw error;
} finally {
  await browser?.close();
}
