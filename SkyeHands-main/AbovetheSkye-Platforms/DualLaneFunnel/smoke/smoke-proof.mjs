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

const home = read("public/index.html");
const jobseekers = read("public/jobseekers.html");
const employers = read("public/employers.html");
const diagnostics = read("public/diagnostics.html");
const intake = read("public/assets/intake.js");

assert(home.includes("Dual‑Lane Conversion System") || home.includes("Dual-Lane Conversion System"), "public/index.html is missing the funnel home surface");
assert(jobseekers.includes('data-lane="jobseekers"'), "public/jobseekers.html is missing job seeker intake lane wiring");
assert(employers.includes('data-lane="employers"'), "public/employers.html is missing employer intake lane wiring");
assert(diagnostics.includes('id="diagnosticsBox"'), "public/diagnostics.html is missing diagnostics box");
assert(diagnostics.includes('id="localQueueBox"'), "public/diagnostics.html is missing the local queue diagnostics box");

assert(intake.includes("postNetlifyForm"), "public/assets/intake.js is missing Netlify Forms submission wiring");
assert(intake.includes("/.netlify/functions/intake"), "public/assets/intake.js is missing intake function wiring");
assert(intake.includes("/.netlify/functions/health"), "public/assets/intake.js is missing health function wiring");
assert(intake.includes("flushQueuedSubmissions"), "public/assets/intake.js is missing queue flush support");
assert(intake.includes("saveDraft"), "public/assets/intake.js is missing local draft persistence");
assert(intake.includes("sol_duallane_submission_queue_v1"), "public/assets/intake.js is missing the queue storage key");
assert(fs.existsSync(path.join(root, "public/assets/sol-logo.svg")), "public/assets/sol-logo.svg is missing");

for (const rel of ["netlify/functions/intake.js", "netlify/functions/health.js"]) {
  checkNode(rel);
}

console.log(JSON.stringify({
  ok: true,
  app: "DualLaneFunnel",
  surface: "static Netlify funnel with job-seeker/employer forms and optional functions",
  verified: [
    "home, job seeker, employer, and diagnostics pages exist",
    "frontend intake script posts to Netlify Forms and optional intake/health functions",
    "Netlify function entrypoints pass node --check",
  ],
  not_proven: [
    "live Netlify Forms capture",
    "live Neon persistence",
    "live Netlify Blobs persistence",
  ],
}, null, 2));
