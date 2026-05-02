import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function mustExist(rel) {
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

const readme = mustExist("README.md");
const html = mustExist("index.html");
const manifest = mustExist("manifest.webmanifest");
mustExist("sw.js");

mustContain(readme, "client-side", "README standalone description");
mustContain(readme, "browser-local vault only", "README boundary note");
mustContain(html, 'id="tabCreate"', "create lane");
mustContain(html, 'id="tabOpen"', "open lane");
mustContain(html, 'id="tabVerify"', "verify lane");
mustContain(html, 'crypto.subtle.encrypt', "browser encryption");
mustContain(html, 'crypto.subtle.decrypt', "browser decryption");
mustContain(html, 'crypto.subtle.digest', "browser hashing");
mustContain(html, "Proof boundary:", "boundary note");
mustContain(html, "navigator.serviceWorker.register", "service worker registration");
mustContain(html, "Build & Download Vault", "vault build action");
mustContain(html, 'id="btnExportLedger"', "ledger export action");
mustContain(html, 'id="btnExportProofTile"', "proof-tile export action");
mustContain(html, 'id="btnExportVerifyReport"', "verify report export action");
mustContain(html, 'id="btnExportActivityLog"', "activity log export action");
mustContain(html, 'id="activityTbody"', "activity log table");
mustContain(html, "Decrypt & Download", "decrypt lane action");
mustContain(html, "Loaded manifest for vault", "verify summary copy");
mustContain(html, "skye-proofx-activity-log", "activity log storage key");
mustContain(html, "function makeVerifyReport(", "verify report builder");
mustContain(html, "function manifestDiagnostics(", "manifest diagnostics");
mustContain(html, "window.__skyeProofxTestApi", "browser test api");
mustContain(html, "runLocalVaultFlowE2E", "browser e2e lane");
mustContain(html, "recordActivity(\"vault_built\"", "vault build activity");
mustContain(html, "recordActivity(\"verification_run\"", "verification activity");
mustContain(manifest, '"name"', "web manifest name");

const browserSmoke = spawnSync(process.execPath, [path.join(root, "smoke", "browser-e2e.mjs")], {
  cwd: root,
  encoding: "utf8"
});

if (browserSmoke.status !== 0) {
  throw new Error(`Browser smoke failed:\n${browserSmoke.stdout}\n${browserSmoke.stderr}`);
}

let browserProof;
try {
  browserProof = JSON.parse(browserSmoke.stdout);
} catch (error) {
  throw new Error(`Browser smoke did not return JSON: ${error.message}\n${browserSmoke.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  folder: "SkyeProofx",
  status: "partial",
  proof: [
    "static-files-present",
    "webcrypto-markers-present",
    "pwa-markers-present",
    "local-export-and-verify-markers-present",
    "local-activity-and-report-markers-present",
    "browser-local-vault-e2e-passed"
  ],
  browser_proof: browserProof.result
}, null, 2));
