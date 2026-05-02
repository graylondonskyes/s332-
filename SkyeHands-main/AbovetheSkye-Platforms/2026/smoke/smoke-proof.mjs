#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

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
const auditJson = JSON.parse(read("ESTATE_AUDIT.json"));
assert(classification.includes("concept-demo-sales"), "classification is missing concept-demo-sales");
assert(classification.includes("OperationBrowserStrike"), "classification is missing OperationBrowserStrike evidence");
assert(proofStatus.includes("mixed release/concept branch cluster"), "proof status is missing mixed-cluster scope");
assert(auditJson.surface_type === "mixed-release-concept-branch-cluster", "estate audit json has unexpected surface type");
assert(Array.isArray(auditJson.top_level_launch_pages) && auditJson.top_level_launch_pages.length >= 10, "estate audit json is missing launch page inventory");
assert(Array.isArray(auditJson.heavier_branches) && auditJson.heavier_branches.length >= 2, "estate audit json is missing heavier branch inventory");

const topLevelHtml = fs.readdirSync(root).filter((name) => name.endsWith(".html"));
assert(topLevelHtml.length >= 10, "expected many top-level launch pages in 2026");
assert(fs.existsSync(path.join(root, "OperationBrowserStrike/index.html")), "OperationBrowserStrike runtime missing");
assert(fs.existsSync(path.join(root, "OperationBrowserStrike/realtime-relay/package.json")), "OperationBrowserStrike relay package missing");
assert(fs.existsSync(path.join(root, "Offline First Tools/SkyeCashLedger.html")), "Offline First Tools sample missing");
assert(fs.existsSync(path.join(root, "FounderTechPro /SkyeBookx:Pro-Suite/index.html")), "SkyeBookx suite entry missing");

console.log(JSON.stringify({
  ok: true,
  app: "2026",
  surface: "mixed release/concept branch cluster",
  verified: [
    "classification file explicitly marks the tree as mixed",
    "machine-readable branch audit exists for the mixed tree",
    "many top-level launch pages exist",
    "representative heavier sub-branches like OperationBrowserStrike exist",
    "representative utility and suite branches exist on disk"
  ],
  not_proven: [
    "top-level launch pages as shipped products",
    "the full 2026 tree as a uniformly finished estate"
  ]
}, null, 2));
