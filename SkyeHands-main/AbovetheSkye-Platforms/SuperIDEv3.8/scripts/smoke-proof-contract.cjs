#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

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
const server = read("server/create-server.cjs");
const syncScript = read("scripts/sync-standalone-platforms.cjs");

for (const file of [
  "README.md",
  "PROOF_STATUS.md",
  "server/create-server.cjs",
  "scripts/sync-standalone-platforms.cjs",
  "scripts/smoke-api.cjs",
  "scripts/smoke-skydocxmax-embedded.mjs",
  "public/index.html",
  "SkyeDocxMax/index.html",
]) {
  assertFile(file);
}

assert(pkg.scripts["smoke:api"], "package.json missing smoke:api");
assert(pkg.scripts["smoke:skydocxmax-embedded"], "package.json missing smoke:skydocxmax-embedded");
assert(server.includes("SKYE_AUTH_SECRET"), "server/create-server.cjs must require SKYE_AUTH_SECRET");
assert(!server.includes("change-me-production-secret"), "server/create-server.cjs still contains default auth secret");
assert(syncScript.includes('path.resolve(projectRoot, "..")'), "sync-standalone-platforms.cjs must resolve the current AbovetheSkye-Platforms root");
assert(readme.includes("## Local Proof Lanes"), "README missing Local Proof Lanes");
assert(readme.includes("## Honest Runtime Boundaries"), "README missing Honest Runtime Boundaries");
assert(proof.includes("## Proven Locally"), "PROOF_STATUS missing Proven Locally");
assert(proof.includes("## Remaining Blockers"), "PROOF_STATUS missing Remaining Blockers");

console.log(JSON.stringify({
  ok: true,
  suite: "SuperIDEv3.8",
  checks: [
    "root-docs-present",
    "api-and-embedded-smokes-declared",
    "auth-secret-default-removed",
    "local-proof-boundaries-documented",
    "standalone-sync-files-present"
  ]
}, null, 2));
