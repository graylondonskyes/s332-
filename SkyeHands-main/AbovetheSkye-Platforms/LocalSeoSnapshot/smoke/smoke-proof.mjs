#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkNode(rel) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, rel)], { encoding: "utf8" });
  assert(result.status === 0, `${rel} failed syntax check: ${result.stderr || result.stdout}`);
}

const html = read("index.html");
const app = read("app.js");

assert(html.includes('id="toolForm"'), "index.html is missing the scoring form");
assert(html.includes('id="btnGenerate"'), "index.html is missing the snapshot generation control");
assert(html.includes('id="btnExportPdf"'), "index.html is missing the PDF export control");
assert(html.includes('name="local-seo-snapshot-lead"'), "index.html is missing the Netlify lead form");
assert(html.includes('id="btnDiagnostics"'), "index.html is missing diagnostics access");

assert(app.includes('const APP = "Local SEO Snapshot"'), "app.js is missing app identity");
assert(app.includes('const ERROR_ENDPOINT = "/.netlify/functions/client-error-report"'), "app.js is missing the error-report endpoint");
assert(app.includes("postErrorReport"), "app.js is missing client error reporting flow");
assert(app.includes("computeNapCompleteness"), "app.js is missing the scoring engine");
assert(app.includes("localStorage"), "app.js is missing local persistence flow");
assert(app.includes("buildPortableReportText"), "app.js is missing the local report export fallback");
assert(html.includes('./icons/icon-512.svg'), "index.html is missing the local logo asset path");

checkNode("netlify/functions/client-error-report.js");

console.log(JSON.stringify({
  ok: true,
  app: "LocalSeoSnapshot",
  surface: "static PWA scoring tool with PDF export, local persistence, lead form, and optional Netlify function",
  verified: [
    "index.html exposes scoring, PDF export, lead capture, and diagnostics controls",
    "app.js contains the scoring engine, local persistence, and client error reporting flow",
    "the Netlify function entrypoint passes node --check",
  ],
  not_proven: [
    "live deployed Netlify Forms capture",
    "live deployed client error reporting",
    "browser PDF export in a real session",
  ],
}, null, 2));
