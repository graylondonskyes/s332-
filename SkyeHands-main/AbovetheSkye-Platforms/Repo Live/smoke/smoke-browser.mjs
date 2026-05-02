#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js":
    case ".mjs": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".json": return "application/json; charset=utf-8";
    default: return "application/octet-stream";
  }
}

function createStaticServer() {
  return http.createServer((req, res) => {
    const urlPath = req.url === "/" ? "/index.html" : String(req.url || "/");
    const filePath = path.normalize(path.join(root, decodeURIComponent(urlPath)));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    try {
      const stat = fs.statSync(filePath);
      const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
      const data = fs.readFileSync(finalPath);
      res.writeHead(200, {
        "content-type": contentType(finalPath),
        "cache-control": "no-store",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
}

function locatePlaywright() {
  const candidates = [
    process.env.REPO_LIVE_PLAYWRIGHT_MODULE,
    process.env.PLAYWRIGHT_MODULE,
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

async function loadPlaywright() {
  const playwrightModule = locatePlaywright();
  if (!playwrightModule) {
    return { chromium: null, playwrightModule: null };
  }
  const browserBundle = locateBrowserBundle();
  if (browserBundle && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = browserBundle;
  }
  const playwright = playwrightModule.endsWith(".mjs")
    ? await import(pathToFileURL(playwrightModule).href)
    : require(playwrightModule);
  return {
    chromium: playwright.chromium || playwright.default?.chromium || null,
    playwrightModule,
  };
}

export async function runBrowserSmoke() {
  const { chromium, playwrightModule } = await loadPlaywright();
  if (!chromium) {
    return { ok: false, skipped: true, reason: "Playwright chromium not available near Repo Live" };
  }
  try {
    const server = createStaticServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : null;
    if (!port) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      throw new Error("Repo Live browser smoke server failed to bind a port");
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
      const pageErrors = [];
      const failedRequests = [];
      page.on("dialog", async (dialog) => {
        if (dialog.type() === "prompt") {
          await dialog.accept("Browser Smoke Preset");
          return;
        }
        await dialog.dismiss();
      });
      page.on("pageerror", (error) => {
        pageErrors.push(String(error?.message || error));
      });
      page.on("requestfailed", (request) => {
        failedRequests.push({
          url: request.url(),
          errorText: request.failure()?.errorText || "unknown",
        });
      });

      await page.addInitScript(() => {
        localStorage.setItem("repoLiveReports", JSON.stringify([
          {
            id: "report-1",
            sourceType: "zip",
            sourceName: "starter.zip",
            packageJson: "package.json",
            subdir: ".",
            command: "npm test --if-present",
            exitCode: 0,
            ok: true,
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            log: "PASS 3\nWARN 1",
            summary: { errors: 0, warnings: 1, signals: 1, logBytes: 12 }
          }
        ]));
      });

      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("#presetSelect", { timeout: 10000 });
      await page.waitForSelector("#reportHistory", { timeout: 10000 });

      await page.fill("#subdirInput", "apps/api");
      await page.selectOption("#cmdSelect", "npm run typecheck --if-present");
      await page.click("#savePresetBtn");

      await page.waitForFunction(() => {
        const select = document.getElementById("presetSelect");
        return select && Array.from(select.options).some((opt) => String(opt.textContent || "").includes("Browser Smoke Preset"));
      }, null, { timeout: 10000 });

      const result = await page.evaluate(() => {
        const presetOptions = Array.from(document.querySelectorAll("#presetSelect option")).map((opt) => opt.textContent || "");
        const reportText = document.getElementById("reportHistory")?.textContent || "";
        const statusText = document.getElementById("status")?.textContent || "";
        const preflightText = document.getElementById("preflightHint")?.textContent || "";
        const brandLogoSrc = document.querySelector(".brandLogo")?.getAttribute("src") || "";
        const presets = JSON.parse(localStorage.getItem("repoLiveCommandPresets") || "[]");
        const reports = JSON.parse(localStorage.getItem("repoLiveReports") || "[]");
        return {
          title: document.title,
          presetOptions,
          reportText,
          statusText,
          preflightText,
          brandLogoSrc,
          presetCount: presets.length,
          reportCount: reports.length,
          latestPreset: presets[0] || null,
        };
      });

      const passed = result.title === "Repo Live"
        && result.brandLogoSrc === "./brand-logo.svg"
        && result.presetCount >= 1
        && result.reportCount >= 1
        && result.presetOptions.some((text) => text.includes("Browser Smoke Preset"))
        && result.reportText.includes("PASS")
        && result.reportText.includes("starter.zip")
        && result.latestPreset?.command === "npm run typecheck --if-present"
        && result.latestPreset?.subdir === "apps/api"
        && pageErrors.length === 0
        && failedRequests.length === 0;

      return {
        ok: passed,
        skipped: false,
        folder: "Repo Live",
        target: `http://127.0.0.1:${port}/index.html`,
        playwrightModule,
        result,
        pageErrors,
        failedRequests,
      };
    } finally {
      await browser.close();
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  } catch (error) {
    if (error?.code === "EPERM" && error?.syscall === "listen") {
      return { ok: false, skipped: true, reason: "Sandbox blocked localhost bind for Repo Live browser smoke" };
    }
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runBrowserSmoke();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && !result.skipped) {
    process.exitCode = 1;
  }
}
