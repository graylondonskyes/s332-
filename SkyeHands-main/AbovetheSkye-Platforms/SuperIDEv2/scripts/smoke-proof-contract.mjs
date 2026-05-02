#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertFile(file) {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
}

const pkg = readJson("package.json");
const readme = read("README.md");
const proof = read("PROOF_STATUS.md");

for (const file of [
  "README.md",
  "PROOF_STATUS.md",
  "public/index.html",
  "src/App.tsx",
  "scripts/check-smoke-snapshot.js",
  "scripts/smoke-interactions-playwright.mjs",
  "scripts/smoke-neural-authenticated-playwright.mjs",
  "scripts/smokehouse.sh",
  "docs/smoke-expected-snapshot.json",
  "SMOKEHOUSE.md",
]) {
  assertFile(file);
}

assert(pkg.scripts["check:smoke-snapshot"], "package.json missing check:smoke-snapshot");
assert(pkg.scripts["smoke:interactions"], "package.json missing smoke:interactions");
assert(pkg.scripts["smoke:neural-authenticated"], "package.json missing smoke:neural-authenticated");

assert(readme.includes("## Local Proof Lanes"), "README missing Local Proof Lanes section");
assert(readme.includes("## Honest Runtime Boundaries"), "README missing Honest Runtime Boundaries section");
assert(!readme.includes("complete source for **kAIxU"), "README still overclaims complete source");
assert(!readme.includes("enterprise‑grade web IDE"), "README still overclaims enterprise-grade runtime");
assert(proof.includes("## Proven Locally"), "PROOF_STATUS missing Proven Locally");
assert(proof.includes("## Remaining Blockers"), "PROOF_STATUS missing Remaining Blockers");

console.log(JSON.stringify({
  ok: true,
  suite: "SuperIDEv2",
  checks: [
    "root-docs-present",
    "local-proof-sections-present",
    "overclaiming-removed",
    "smoke-scripts-declared",
    "core-runtime-files-present"
  ]
}, null, 2));
