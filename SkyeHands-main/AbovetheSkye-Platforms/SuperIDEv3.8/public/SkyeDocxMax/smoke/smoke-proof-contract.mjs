#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

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

const readme = read("README.md");
const proof = read("PROOF_STATUS.md");
const verifyEnv = read("smoke/verify-browser-smoke-env.mjs");

for (const file of [
  "README.md",
  "PROOF_STATUS.md",
  "index.html",
  "manifest.json",
  "manifest.webmanifest",
  "service-worker.js",
  "_shared/skye/skyeSecure.js",
  "smoke/smoke-standalone.mjs",
  "smoke-full-standalone.mjs",
  "smoke/verify-browser-smoke-env.mjs",
  "docs/DOCX_SUPPORT.md"
]) {
  assertFile(file);
}

const manifest = readJson("manifest.json");
const manifestCompat = readJson("manifest.webmanifest");
assert(manifest.name === "SkyeDocxMax", "manifest.json product name mismatch");
assert(manifestCompat.name === "SkyeDocxMax", "manifest.webmanifest product name mismatch");
assert(readme.includes("## Honest Runtime Boundaries"), "README missing Honest Runtime Boundaries");
assert(readme.includes("/AbovetheSkye-Platforms/SkyeDocxMax"), "README still points at old donor path");
assert(!readme.includes("Later-Additions/DonorCode-MySkyeApps"), "README still points at donor archive path");
assert(proof.includes("## Proven Locally"), "PROOF_STATUS missing Proven Locally");
assert(proof.includes("## Remaining Blockers"), "PROOF_STATUS missing Remaining Blockers");
assert(verifyEnv.includes('path.resolve(superIdeRoot, "..", "SuperIDEv2")'), "verify-browser-smoke-env.mjs must resolve sibling SuperIDEv2 in the current repo layout");

console.log(JSON.stringify({
  ok: true,
  suite: "SkyeDocxMax",
  checks: [
    "root-docs-present",
    "current-path-docs-present",
    "docx-boundary-documented",
    "manifest-files-present",
    "browser-smoke-env-points-at-current-layout"
  ]
}, null, 2));
