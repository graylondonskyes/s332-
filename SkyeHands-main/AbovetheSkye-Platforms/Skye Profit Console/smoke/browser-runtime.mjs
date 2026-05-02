import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const runtimePath = path.join(root, "runtime", "local-runtime.mjs");
const skyeHandsRoot = path.resolve(root, "..", "..");
const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(skyeHandsRoot, ".ms-playwright");
const knownPlaywrightPackages = [
  path.join(skyeHandsRoot, "AbovetheSkye-Platforms", "SuperIDEv2", "node_modules", "playwright"),
  path.join(skyeHandsRoot, "Dynasty-Versions", "node_modules", "playwright"),
  path.join(skyeHandsRoot, "stage_44rebuild", "node_modules", "playwright")
];
const playwrightPackage = knownPlaywrightPackages.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));

if (!playwrightPackage) {
  throw new Error("No repo-local Playwright package found for Skye Profit Console browser smoke.");
}

process.env.PLAYWRIGHT_BROWSERS_PATH = browserRoot;
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightPackage, "index.js"));

async function startRuntime() {
  const port = 44000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [runtimePath, "--port", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const line = stdout.trim().split("\n").filter(Boolean).pop();
    if (line) {
      try {
        const payload = JSON.parse(line);
        if (payload.ok) return { child, port: payload.port, stderrRef: () => stderr };
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill("SIGTERM");
  throw new Error(`Skye Profit Console runtime did not start.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}

const runtime = await startRuntime();
const baseUrl = `http://127.0.0.1:${runtime.port}`;
const browser = await chromium.launch({ headless: true });
let result;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  await fetch(`${baseUrl}/api/worksheet`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      worksheet: {
        business: "",
        period: "",
        revenue: 0,
        expenses: 0,
        reconciled: 0,
        outstanding: 0,
        notes: ""
      }
    })
  });
  await fetch(`${baseUrl}/api/ledger/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "load", timeout: 30000 });
  await page.waitForFunction(() => {
    const el = document.getElementById("worksheetRuntime");
    return el && /local runtime/i.test(el.textContent || "");
  }, null, { timeout: 10000 });

  await page.fill("#worksheetBusiness", "House Circle Phoenix");
  await page.fill("#worksheetPeriod", "2026-05");
  await page.fill("#worksheetRevenue", "2400");
  await page.fill("#worksheetExpenses", "860");
  await page.fill("#worksheetNotes", "Browser/runtime proof");
  await page.waitForTimeout(250);

  await page.selectOption("#ledgerType", "invoice");
  await page.fill("#ledgerDate", "2026-05-01");
  await page.fill("#ledgerParty", "House Circle Phoenix");
  await page.fill("#ledgerReference", "INV-UI-1");
  await page.fill("#ledgerCategory", "Staffing");
  await page.fill("#ledgerAmount", "2400");
  await page.selectOption("#ledgerStatus", "paid");
  await page.fill("#ledgerMatchRef", "DEP-UI-1");
  await page.fill("#ledgerNotes", "Browser/runtime proof invoice");
  await page.click("#ledgerAdd");
  await page.waitForFunction(() => {
    const count = document.getElementById("ledgerCount");
    return count && /1 entry/i.test(count.textContent || "");
  }, null, { timeout: 5000 });

  const snapshot = await fetch(`${baseUrl}/api/snapshot`).then((res) => res.json());
  const runtimeLabel = await page.textContent("#worksheetRuntime");
  const ledgerSaved = await page.textContent("#ledgerSaved");
  result = {
    ok: true,
    runtime_label: runtimeLabel?.trim() || "",
    ledger_saved: ledgerSaved?.trim() || "",
    ledger_count: snapshot.ledger.length,
    business: snapshot.worksheet.business,
    invoice_total: snapshot.metrics.invoiceTotal
  };
  await context.close();
} finally {
  await browser.close();
  runtime.child.kill("SIGTERM");
}

const ok = result.ok && result.ledger_count === 1 && result.business === "House Circle Phoenix" && result.invoice_total === 2400;
console.log(JSON.stringify({
  ok,
  folder: "Skye Profit Console",
  base_url: baseUrl,
  result
}, null, 2));

if (!ok) process.exit(1);
