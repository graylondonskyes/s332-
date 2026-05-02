import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(full, "utf8");
}

function mustContain(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const html = read("index.html");
read("runtime/local-runtime.mjs");
read("runtime/store.json");

mustContain(html, "SkyeProfitConsole", "product identity");
mustContain(html, "Launch SkyeProfitConsole", "launch CTA");
mustContain(html, "https://skyeprofitconsole.netlify.app/", "hosted app link");
mustContain(html, 'id="boundary"', "runtime boundary section");
mustContain(html, 'id="local-worksheet"', "local worksheet section");
mustContain(html, 'id="local-ledger"', "local ledger section");
mustContain(html, "Local Planning Worksheet", "local worksheet heading");
mustContain(html, "Local Ledger Studio", "local ledger heading");
mustContain(html, 'id="worksheetExportJson"', "local json export control");
mustContain(html, 'id="worksheetExportCsv"', "local csv export control");
mustContain(html, 'id="worksheetReset"', "local reset control");
mustContain(html, "skye-profit-console-local-worksheet", "local storage key");
mustContain(html, "skye-profit-console-local-ledger", "local ledger storage key");
mustContain(html, "./api/runtime-info", "runtime detection fetch");
mustContain(html, "function exportWorksheetJson()", "json export logic");
mustContain(html, "function exportWorksheetCsv()", "csv export logic");
mustContain(html, "function renderWorksheetSummary()", "summary derivation logic");
mustContain(html, "function addLedgerEntry()", "ledger add logic");
mustContain(html, "function computeLedgerMetrics(entries)", "ledger metric derivation");
mustContain(html, "Runtime mode:", "runtime status copy");
mustContain(html, 'id="ledgerExportJson"', "ledger json export control");
mustContain(html, 'id="ledgerExportCsv"', "ledger csv export control");
mustContain(html, 'id="ledgerRows"', "ledger table");
mustContain(html, "Actually Proves", "boundary heading");
mustContain(html, "/js/SkyeSolINTRO.js", "shared intro script");

async function startRuntime() {
  const runtimePath = path.join(root, "runtime", "local-runtime.mjs");
  const port = 43000 + Math.floor(Math.random() * 1000);
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
        if (payload.ok) return { child, port: payload.port };
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  child.kill("SIGTERM");
  throw new Error(`Local runtime did not start.\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}

const runtime = await startRuntime();
let runtimeProof;
try {
  const base = `http://127.0.0.1:${runtime.port}`;
  await fetch(`${base}/api/ledger/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  await fetch(`${base}/api/worksheet`, {
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
  const health = await fetch(`${base}/health`).then((res) => res.json());
  await fetch(`${base}/api/worksheet`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      worksheet: {
        business: "House Circle",
        period: "2026-05",
        revenue: 2400,
        expenses: 860,
        reconciled: 3,
        outstanding: 1,
        notes: "Local runtime proof"
      }
    })
  });
  await fetch(`${base}/api/ledger`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ledger: [
        { type: "invoice", date: "2026-05-01", party: "House Circle", reference: "INV-9001", category: "Staffing", amount: 2400, status: "paid", matchRef: "DEP-9001", notes: "Invoice" },
        { type: "deposit", date: "2026-05-02", party: "Chase", reference: "DEP-9001", category: "Bank deposit", amount: 2400, status: "reconciled", matchRef: "INV-9001", notes: "Matched" },
        { type: "expense", date: "2026-05-03", party: "Phoenix Payroll", reference: "EXP-9001", category: "Labor", amount: 860, status: "paid", matchRef: "", notes: "Payout" }
      ]
    })
  });
  const snapshot = await fetch(`${base}/api/snapshot`).then((res) => res.json());
  runtimeProof = {
    health,
    ledger_count: snapshot.ledger.length,
    cash_profit: snapshot.metrics.cashProfit,
    invoice_total: snapshot.metrics.invoiceTotal
  };
} finally {
  runtime.child.kill("SIGTERM");
}

const browserSmoke = spawnSync(process.execPath, [path.join(root, "smoke", "browser-runtime.mjs")], {
  cwd: root,
  encoding: "utf8"
});

if (browserSmoke.status !== 0) {
  throw new Error(`Browser/runtime smoke failed:\n${browserSmoke.stdout}\n${browserSmoke.stderr}`);
}

let browserProof;
try {
  browserProof = JSON.parse(browserSmoke.stdout);
} catch (error) {
  throw new Error(`Browser/runtime smoke did not return JSON: ${error.message}\n${browserSmoke.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  folder: "Skye Profit Console",
  status: "partial",
  proof: [
    "static-shell-present",
    "hosted-app-link-present",
    "feature-copy-present",
    "local-worksheet-present",
    "local-ledger-present",
    "local-runtime-api-present",
    "browser-to-runtime-ledger-flow-passed"
  ],
  runtime_proof: runtimeProof,
  browser_proof: browserProof.result
}, null, 2));
