#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");
const require = createRequire(import.meta.url);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".svg": return "image/svg+xml";
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
      res.writeHead(200, { "content-type": contentType(finalPath), "cache-control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
}

function locatePlaywright() {
  const candidates = [
    process.env.QR_CODE_GENERATOR_PLAYWRIGHT_MODULE,
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
    return { ok: false, skipped: true, reason: "Playwright chromium not available near QR-Code-Generator" };
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
      throw new Error("QR-Code-Generator static server failed to bind a port");
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
      const downloads = [];
      const pageErrors = [];
      const failedRequests = [];
      page.on("download", (download) => downloads.push(download.suggestedFilename()));
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

      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("#qrCanvas", { timeout: 15000 });
      await page.waitForFunction(() => {
        const canvas = document.getElementById("qrCanvas");
        const history = document.getElementById("qrHistory");
        return canvas && canvas.width > 0 && history && !String(history.textContent || "").includes("No local activity yet.");
      }, null, { timeout: 15000 });

      await page.fill("#qrText", "https://solenterprises.org/browser-smoke");
      await page.selectOption("#qrSize", "500");
      await page.click("#generateBtn");
      await page.waitForFunction(() => {
        const history = document.getElementById("qrHistory");
        return history && String(history.textContent || "").includes("browser-smoke");
      }, null, { timeout: 15000 });

      await page.click("#savePresetBtn");
      await page.waitForFunction(() => {
        const select = document.getElementById("presetSelect");
        return select && Array.from(select.options).some((opt) => String(opt.textContent || "").includes("Browser Smoke Preset"));
      }, null, { timeout: 10000 });

      await page.click("#dlPng");
      await page.click("#dlPdf");
      await page.click("#exportPresetBtn");

      const result = await page.evaluate(() => {
        const canvas = document.getElementById("qrCanvas");
        const historyEntries = Array.from(document.querySelectorAll("#qrHistory strong")).map((node) => node.textContent);
        const presets = JSON.parse(localStorage.getItem("solQrPresets") || "[]");
        const history = JSON.parse(localStorage.getItem("solQrHistory") || "[]");
        return {
          title: document.title,
          canvasWidth: canvas?.width || 0,
          canvasHeight: canvas?.height || 0,
          presetCount: presets.length,
          historyCount: history.length,
          historyEntries,
          latestText: history[0]?.text || "",
        };
      });

      const passed = result.title.includes("QR Code Generator")
        && result.canvasWidth >= 500
        && result.canvasHeight >= 500
        && result.presetCount >= 1
        && result.historyCount >= 3
        && result.historyEntries.includes("render")
        && result.historyEntries.includes("png")
        && result.historyEntries.includes("pdf")
        && result.historyEntries.includes("preset-json")
        && result.latestText.includes("browser-smoke")
        && downloads.includes("sol-qr-code.png")
        && downloads.includes("sol-qr-report.pdf")
        && downloads.includes("sol-qr-preset.json")
        && pageErrors.length === 0
        && failedRequests.length === 0;

      return {
        ok: passed,
        skipped: false,
        folder: "QR-Code-Generator",
        target: `http://127.0.0.1:${port}/index.html`,
        repoRoot,
        playwrightModule,
        result,
        downloads,
        pageErrors,
        failedRequests,
      };
    } finally {
      await browser.close();
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  } catch (error) {
    if (error?.code === "EPERM" && error?.syscall === "listen") {
      return { ok: false, skipped: true, reason: "Sandbox blocked localhost bind for QR-Code-Generator browser smoke" };
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
