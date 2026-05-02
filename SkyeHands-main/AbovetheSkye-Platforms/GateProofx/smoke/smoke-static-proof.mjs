import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import gateRuntime from "../runtime/gateproofx-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

for (const rel of ["index.html", "app.js", "style.css"]) {
  if (!existsSync(path.join(root, rel))) {
    throw new Error(`Missing required GateProofx file: ${rel}`);
  }
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
for (const needle of [
  'id="fileInput"',
  'id="fetchArchiveBtn"',
  'id="exportCsvBtn"',
  'id="exportPdfBtn"',
  'id="localArchiveList"',
  'id="chartTimeline"',
  'id="chartProviders"',
  'id="chartLevels"',
  'id="saveViewBtn"',
  'id="savedViewSelect"',
  'id="qualityFlags"',
  "paired with deployed archive endpoints",
]) {
  if (!html.includes(needle)) {
    throw new Error(`GateProofx UI is missing required proof marker: ${needle}`);
  }
}

const app = readFileSync(path.join(root, "app.js"), "utf8");
for (const needle of [
  'sessionStorage.getItem("GPX_ADMIN_TOKEN")',
  "GateProofxRuntime",
  "Papa.parse",
  "new Chart(",
  'downloadFile("gate-proofx-export.csv"',
  'window.print()',
  "/.netlify/functions/monitor-archive-access",
  "renderLocalArchiveHistory",
  "saveImportSnapshot",
]) {
  if (!app.includes(needle)) {
    throw new Error(`GateProofx app contract is missing: ${needle}`);
  }
}

const mem = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, String(value)); },
};
gateRuntime.saveView(mem, { label: "Errors only", filters: { level: "error", limit: "100" } });
gateRuntime.recordImport(mem, { source: "sample.ndjson", rowCount: 3 });
const snapshot = gateRuntime.saveImportSnapshot(mem, {
  source: "sample.ndjson",
  rows: [{ request_id: "a", provider: "openai", model: "gpt-4o", level: "info" }],
});
const quality = gateRuntime.summarizeQuality([
  { request_id: "a", provider: "openai", model: "gpt-4o", level: "info" },
  { request_id: "a", provider: "", model: "gpt-4o", level: "error" },
]);
if (
  gateRuntime.listViews(mem).length !== 1 ||
  gateRuntime.listImports(mem).length !== 1 ||
  gateRuntime.listImportSnapshots(mem).length !== 1 ||
  gateRuntime.getImportSnapshot(mem, snapshot.id)?.rows?.length !== 1 ||
  quality.duplicateRequestIds !== 1
) {
  throw new Error("GateProofx runtime helper did not exercise as expected");
}

console.log(JSON.stringify({
  ok: true,
  platform: "GateProofx",
  proof: [
    "Static export-reader UI exists",
    "CSV/NDJSON parsing hooks exist",
    "Charts and filtered CSV/PDF export hooks exist",
    "Saved-view, local import-history reload, and data-quality runtime helpers execute",
    "Archive loading is explicitly scoped to paired deployed endpoints",
  ],
  limits: [
    "Does not prove archive endpoint availability from this folder alone",
    "Does not prove any backlog features beyond the current single-page reader",
  ],
}, null, 2));
