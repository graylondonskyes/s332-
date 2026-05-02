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
const server = read("server.js");
const serverSmoke = read("scripts/smoke-server.mjs");
const functionSmoke = read("scripts/smoke-functions.mjs");
const browserSmoke = read("scripts/smoke-interactions-playwright.mjs");
const loginHtml = read("skAIxuide/login.html");

for (const file of [
  "README.md",
  "PROOF_STATUS.md",
  "index.html",
  "server.js",
  "scripts/smoke-server.mjs",
  "scripts/smoke-functions.mjs",
  "scripts/smoke-interactions-playwright.mjs",
  "skAIxuide/login.html",
  "skAIxuide/index.html"
]) {
  assertFile(file);
}

assert(pkg.scripts["verify:functions"], "package.json missing verify:functions");
assert(pkg.scripts["verify:browser-smoke"], "package.json missing verify:browser-smoke");
assert(pkg.scripts["verify:server"], "package.json missing verify:server");
assert(server.includes("Remote gateway proxy disabled"), "server.js must report remote gateway proxy disabled");
assert(server.includes("KAIXU_GATEWAY_URL"), "server.js must require explicit KAIXU_GATEWAY_URL for proxying");
assert(server.includes("workspaceProjectCatalog"), "server.js must expose workspace project catalog");
assert(server.includes("Forbidden path"), "server.js must reject out-of-root traversal");
assert(serverSmoke.includes("static-path-traversal-blocked"), "smoke-server must prove traversal blocking");
assert(functionSmoke.includes("response.statusCode === 401"), "smoke-functions must prove auth gating");
assert(browserSmoke.includes("state.mode === 'degraded'"), "browser smoke must prove degraded mode");
assert(loginHtml.includes("window.netlifyIdentity"), "login surface must use Netlify Identity");
assert(readme.includes("## Local Proof Lanes"), "README missing Local Proof Lanes");
assert(readme.includes("## Honest Runtime Boundaries"), "README missing Honest Runtime Boundaries");
assert(proof.includes("## Proven Locally"), "PROOF_STATUS missing Proven Locally");
assert(proof.includes("## Remaining Blockers"), "PROOF_STATUS missing Remaining Blockers");

console.log(JSON.stringify({
  ok: true,
  suite: "skAIxuIDEPro",
  checks: [
    "root-docs-present",
    "server-smoke-declared",
    "function-and-browser-smokes-declared",
    "proxy-disabled-by-default",
    "workspace-catalog-and-traversal-guards-present",
    "auth-gating-smoke-present",
    "degraded-mode-browser-smoke-present"
  ]
}, null, 2));
