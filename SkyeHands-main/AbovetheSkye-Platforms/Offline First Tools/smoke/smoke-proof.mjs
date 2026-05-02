#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const canonicalRoot = path.resolve(root, "..", "2026", "Offline First Tools");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function read(relPath) {
  const full = path.join(root, relPath);
  assert(fs.existsSync(full), `Missing required file: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

const classification = read("ESTATE_CLASSIFICATION.md");
const proofStatus = read("PROOF_STATUS.md");
assert(classification.includes("concept-mirror"), "classification is missing concept-mirror");
assert(proofStatus.includes("redirect mirror"), "proof status is missing mirror scope");

for (const page of ["SkyeCashLedger.html", "SkyeFocusLog.html", "SkyeNoteVault.html"]) {
  const html = read(page);
  assert(html.includes("Redirecting"), `${page} is not a redirect page`);
  assert(html.includes("/Platforms-Apps-Infrastructure/2026/Offline%20First%20Tools/"), `${page} does not point at the 2026 utility path`);
}

assert(fs.existsSync(path.join(canonicalRoot, "SkyeCashLedger.html")), "canonical 2026 SkyeCashLedger missing");
assert(fs.existsSync(path.join(canonicalRoot, "SkyeFocusLog.html")), "canonical 2026 SkyeFocusLog missing");
assert(fs.existsSync(path.join(canonicalRoot, "SkyeNoteVault.html")), "canonical 2026 SkyeNoteVault missing");

console.log(JSON.stringify({
  ok: true,
  app: "Offline First Tools",
  surface: "redirect mirror",
  verified: [
    "local files are redirect pages",
    "redirect targets point to the 2026 utility set",
    "canonical utility pages exist in the 2026 branch"
  ],
  not_proven: [
    "standalone app implementations in this top-level mirror folder"
  ]
}, null, 2));
