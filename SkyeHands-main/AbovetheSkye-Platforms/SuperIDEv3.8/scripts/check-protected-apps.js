#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = process.cwd();
const manifestPath = path.join(root, "docs", "protected-apps-manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("[protected-apps] Missing protected apps manifest");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let failed = false;

for (const entry of manifest.targets || []) {
  const abs = path.join(root, entry.path);
  if (!fs.existsSync(abs)) {
    if (entry.allow_missing) continue;
    console.error(`[protected-apps] Missing protected path ${entry.path}`);
    failed = true;
    continue;
  }
  const sha = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
  if (entry.sha256 && sha !== entry.sha256) {
    console.error(`[protected-apps] Hash drift for ${entry.path}`);
    failed = true;
  }
}

if (failed) {
  console.error("[protected-apps] FAILED: protected app no-touch policy violated");
  process.exit(1);
}

console.log(`[protected-apps] PASS (${(manifest.targets || []).length} targets)`);
