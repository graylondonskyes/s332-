#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const estateRoot = path.resolve(root, "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function read(relPath) {
  const full = path.join(root, relPath);
  assert(fs.existsSync(full), `Missing required file: ${relPath}`);
  return fs.readFileSync(full, "utf8");
}

const classification = read("ESTATE_CLASSIFICATION.md");
const inventory = read("SkyeSol-Inventory");
const proofStatus = read("PROOF_STATUS.md");
const auditJson = JSON.parse(read("ESTATE_AUDIT.json"));

assert(classification.includes("shipped-core"), "classification is missing shipped-core");
assert(classification.includes("concept-demo-sales"), "classification is missing concept-demo-sales");
assert(inventory.includes("concept") || inventory.includes("demo"), "inventory does not read like a classification surface");
assert(proofStatus.includes("catalog and classification layer"), "proof status is missing catalog scope");
assert(auditJson.surface_type === "catalog-and-classification-layer", "estate audit json has unexpected surface type");
assert(Array.isArray(auditJson.strongest_shipped_core) && auditJson.strongest_shipped_core.length >= 5, "estate audit json is missing shipped-core references");

for (const folder of ["SkyeRoutex", "SkyDexia", "AppointmentSetter", "JobPing"]) {
  assert(fs.existsSync(path.join(estateRoot, folder)), `Referenced shipped-core folder missing: ${folder}`);
}

console.log(JSON.stringify({
  ok: true,
  app: "Featured-on-SkyeSol",
  surface: "catalog and classification layer",
  verified: [
    "inventory and classification files exist",
    "machine-readable estate audit exists for catalog consumers",
    "the folder explicitly separates shipped, partial, and concept material",
    "representative shipped-core references point at real top-level estate folders"
  ],
  not_proven: [
    "no standalone app runtime exists in this folder",
    "the folder does not certify the entire estate as shipped"
  ]
}, null, 2));
