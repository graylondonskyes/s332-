import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const routeFiles = Array.from({ length: 18 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  const names = [
    "valuation",
    "trust-pack",
    "contract-kit",
    "proposal-engine",
    "invoice-receipt",
    "commission-statement",
    "lead-intelligence",
    "brand-book",
    "onboarding-binder",
    "audit-snapshot",
    "incident-postmortem",
    "executive-brief",
    "offer-letter",
    "service-catalog",
    "certificate-factory",
    "policy-pack",
    "handoff-binder",
    "before-after-report",
  ];
  return `routes/${num}-${names[i]}.html`;
});

const requiredFiles = [
  "index.html",
  "tool.html",
  "manifest.webmanifest",
  "sw.js",
  "assets/app.js",
  "assets/tools.js",
  "assets/tutorial.js",
  ...routeFiles,
];

for (const rel of requiredFiles) {
  if (!existsSync(path.join(root, rel))) {
    throw new Error(`Missing required PDF suite file: ${rel}`);
  }
}

const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const tool = read("tool.html");
for (const needle of [
  '"mode": "same-origin"',
  '"managedAuth": true',
  'id="runBtn"',
  'id="pdfBtn"',
  'id="openDiagnostics"',
  'id="wsExport"',
  'id="wsImport"',
]) {
  if (!tool.includes(needle)) {
    throw new Error(`tool.html is missing required runtime/proof marker: ${needle}`);
  }
}

const app = read("assets/app.js");
for (const needle of [
  'navigator.serviceWorker.register("./sw.js")',
  'exportPDF(',
  'exportWorkspaceFile(',
  'sanitizeImportedWorkspace(',
  'fetch("/.netlify/functions/client-error-report"',
  'attachment-upload',
]) {
  if (!app.includes(needle)) {
    throw new Error(`assets/app.js is missing expected behavior: ${needle}`);
  }
}

const manifest = JSON.parse(read("manifest.webmanifest"));
if (manifest.start_url !== "./index.html" || manifest.display !== "standalone") {
  throw new Error("Unexpected manifest contract for PDF suite PWA shell.");
}

console.log(JSON.stringify({
  ok: true,
  platform: "kAIxU-PDF-Pro",
  proof: [
    "Static landing page exists",
    "18 deep-link route pages exist",
    "Tool surface exposes same-origin managed runtime config",
    "Workspace export/import controls exist",
    "Client export/service-worker hooks are present",
  ],
  limits: [
    "Does not prove live gateway responses",
    "Does not prove optional vault/blob persistence",
  ],
}, null, 2));
