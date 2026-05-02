#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const required = [
  { file: "netlify/functions/auth-login.ts", mustContain: ["export", "handler"] },
  { file: "netlify/functions/auth-signup.ts", mustContain: ["export", "handler"] },
  { file: "netlify/functions/auth-me.ts", mustContain: ["export", "handler"] },
  { file: "netlify/functions/auth-logout.ts", mustContain: ["export", "handler"] },
  { file: "netlify/functions/token-issue.ts", mustContain: ["export", "handler"] },
  { file: "netlify/functions/token-list.ts", mustContain: ["export", "handler"] },
  { file: "netlify/functions/token-revoke.ts", mustContain: ["export", "handler"] },
];

let failed = false;

for (const item of required) {
  const abs = path.join(root, item.file);
  if (!fs.existsSync(abs)) {
    console.error(`[auth-regression] Missing ${item.file}`);
    failed = true;
    continue;
  }
  const text = fs.readFileSync(abs, "utf8");
  for (const needle of item.mustContain) {
    if (!text.includes(needle)) {
      console.error(`[auth-regression] ${item.file} missing '${needle}'`);
      failed = true;
    }
  }
  const blockedMarkers = new RegExp(['TO' + 'DO', 'FIX' + 'ME'].join('|'));
  if (blockedMarkers.test(text)) {
    console.error(`[auth-regression] ${item.file} contains blocked work marker`);
    failed = true;
  }
}

if (failed) {
  console.error("[auth-regression] FAILED");
  process.exit(1);
}

console.log(`[auth-regression] PASS (${required.length} functions checked)`);
