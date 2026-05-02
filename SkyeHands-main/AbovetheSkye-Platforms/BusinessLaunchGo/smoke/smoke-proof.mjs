#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkNode(rel) {
  const sourcePath = path.join(root, rel);
  const source = fs.readFileSync(sourcePath, "utf8");
  const ext = /\bexport\s+async\s+function\b|\bexport\s+function\b/.test(source) ? ".mjs" : ".js";
  const tempPath = path.join(os.tmpdir(), `businesslaunchgo-proof-${path.basename(rel, path.extname(rel))}-${process.pid}${ext}`);
  fs.writeFileSync(tempPath, source);
  const result = spawnSync(process.execPath, ["--check", tempPath], { encoding: "utf8" });
  fs.unlinkSync(tempPath);
  assert(result.status === 0, `${rel} failed syntax check: ${result.stderr || result.stdout}`);
}

const html = read("index.html");
const app = read("assets/app.js");
const zipHelper = read("assets/zip.js");

assert(html.includes('id="btnGenerateZip"'), "index.html is missing ZIP generation control");
assert(html.includes('id="btnExportPdf"'), "index.html is missing PDF export control");
assert(html.includes('form id="leadForm"'), "index.html is missing the lead form");
assert(html.includes('id="diagModal"'), "index.html is missing diagnostics modal wiring");

assert(app.includes("KAIXU_ZIP.buildZipPack"), "assets/app.js does not call the ZIP builder");
assert(app.includes("neon-lead-upsert"), "assets/app.js is missing Neon lead upsert endpoint wiring");
assert(app.includes("neon-health"), "assets/app.js is missing Neon health wiring");
assert(app.includes("blob-store-pack"), "assets/app.js is missing blob storage wiring");
assert(app.includes("client-error-report"), "assets/app.js is missing client error reporting wiring");
assert(app.includes("buildPortableSummary"), "assets/app.js is missing the local PDF/text fallback");
assert(zipHelper.includes("buildPortableArchive"), "assets/zip.js is missing the local archive fallback");
assert(zipHelper.includes("buildDocsMap"), "assets/zip.js is missing the reusable docs map builder");

for (const rel of [
  "assets/zip.js",
  "schema.sql",
  "netlify/functions/client-error-report.js",
  "netlify/functions/neon-lead-upsert.js",
  "netlify/functions/neon-health.js",
  "netlify/functions/blob-store-pack.js",
]) {
  assert(exists(rel), `Missing required surface: ${rel}`);
}

for (const rel of [
  "netlify/functions/client-error-report.js",
  "netlify/functions/neon-lead-upsert.js",
  "netlify/functions/neon-health.js",
  "netlify/functions/blob-store-pack.js",
]) {
  checkNode(rel);
}

assert(zipHelper.includes("README.md"), "assets/zip.js no longer defines pack documents");
assert(zipHelper.includes("policy-starters.md"), "assets/zip.js no longer includes policy starters");

console.log(JSON.stringify({
  ok: true,
  app: "BusinessLaunchGo",
  surface: "static PWA with browser ZIP/PDF generation and optional Netlify/Neon function surfaces",
  verified: [
    "index.html contains the launch-pack UI, lead form, and diagnostics modal",
    "browser app wiring references ZIP generation, PDF export, Neon health/upsert, blob storage, and client error reporting",
    "schema.sql and Netlify function entrypoints exist",
    "Netlify function entrypoints pass node --check",
  ],
  not_proven: [
    "live Netlify deploy behavior",
    "actual Neon connectivity",
    "actual blob persistence",
  ],
}, null, 2));
