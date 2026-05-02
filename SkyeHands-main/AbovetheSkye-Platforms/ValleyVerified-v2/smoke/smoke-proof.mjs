#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { runBrowserSmoke } from "./browser-smoke.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

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
  const result = spawnSync(process.execPath, ["--check", path.join(root, rel)], { encoding: "utf8" });
  assert(result.status === 0, `${rel} failed syntax check: ${result.stderr || result.stdout}`);
}

const html = read("index.html");
const app = read("assets/valleyverified.js");

assert(html.includes('id="postJobBtn"'), "index.html is missing job posting control");
assert(html.includes('id="contractorBtn"'), "index.html is missing contractor onboarding control");
assert(html.includes('id="refreshBtn"'), "index.html is missing board refresh control");
assert(html.includes('id="tokenInput"'), "index.html is missing token input");
assert(html.includes('id="operatorLoginBtn"'), "index.html is missing local operator login control");
assert(html.includes('id="fulfillmentsList"'), "index.html is missing fulfillment list surface");
assert(!html.includes("SkyeHands-Website/assets/skyehawk-os.js"), "index.html still depends on a script outside ValleyVerified-v2");

assert(app.includes("/.netlify/functions/valley-jobs"), "assets/valleyverified.js is missing valley-jobs wiring");
assert(app.includes("/.netlify/functions/valley-contractors"), "assets/valleyverified.js is missing valley-contractors wiring");
assert(app.includes("/.netlify/functions/valley-claims"), "assets/valleyverified.js is missing valley-claims wiring");
assert(app.includes("/.netlify/functions/valley-session"), "assets/valleyverified.js is missing local operator session wiring");
assert(app.includes("/.netlify/functions/valley-fulfillment"), "assets/valleyverified.js is missing valley-fulfillment wiring");
assert(app.includes("sessionStorage.getItem(\"valleyVerifiedToken\")"), "assets/valleyverified.js is missing session-scoped token persistence");

for (const rel of [
  "integration.contract.json",
  "netlify/functions/valley-session.js",
  "netlify/functions/valley-jobs.js",
  "netlify/functions/valley-contractors.js",
  "netlify/functions/valley-claims.js",
  "netlify/functions/valley-fulfillment.js",
  "netlify/functions/_lib/skygate-auth.js",
  "netlify/functions/_lib/store.js",
]) {
  assert(exists(rel), `Missing required surface: ${rel}`);
}

for (const rel of [
  "netlify/functions/valley-session.js",
  "netlify/functions/valley-jobs.js",
  "netlify/functions/valley-contractors.js",
  "netlify/functions/valley-claims.js",
  "netlify/functions/valley-fulfillment.js",
  "netlify/functions/_lib/skygate-auth.js",
  "netlify/functions/_lib/store.js",
]) {
  checkNode(rel);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "valleyverified-smoke-"));
process.env.VALLEYVERIFIED_DATA_DIR = tmpDir;
process.env.VALLEYVERIFIED_LOCAL_OPERATOR_EMAIL = "operator@internal.invalid";
process.env.VALLEYVERIFIED_LOCAL_OPERATOR_PASSWORD = "smoke-pass-123";
process.env.VALLEYVERIFIED_LOCAL_SESSION_SECRET = "valleyverified-smoke-secret";
const jobsHandler = (await import("../netlify/functions/valley-jobs.js")).default;
const contractorsHandler = (await import("../netlify/functions/valley-contractors.js")).default;
const claimsHandler = (await import("../netlify/functions/valley-claims.js")).default;
const fulfillmentHandler = (await import("../netlify/functions/valley-fulfillment.js")).default;
const sessionHandler = (await import("../netlify/functions/valley-session.js")).default;

const sessionResponse = await sessionHandler.handler({
  httpMethod: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "operator@internal.invalid", password: "smoke-pass-123" }),
});
assert(sessionResponse.statusCode === 200, "valley-session did not issue a local operator token");
const sessionData = JSON.parse(sessionResponse.body);
const auth = { authorization: `Bearer ${sessionData.token}` };

const jobResponse = await jobsHandler.handler({
  httpMethod: "POST",
  headers: auth,
  body: JSON.stringify({ company: "Maggies", title: "Dinner shift", type: "restaurant_shift", location: "Phoenix", rate_cents: 15000 }),
});
assert(jobResponse.statusCode === 201, "valley-jobs did not create a job");
const jobData = JSON.parse(jobResponse.body);

const contractorResponse = await contractorsHandler.handler({
  httpMethod: "POST",
  headers: auth,
  body: JSON.stringify({
    name: "Jordan",
    email: `jordan.${Date.now()}@internal.invalid`,
    serviceArea: "Phoenix",
    skills: "restaurant_shift",
    status: "verified",
  }),
});
assert(contractorResponse.statusCode === 201, "valley-contractors did not create a contractor");
const contractorData = JSON.parse(contractorResponse.body);

const claimResponse = await claimsHandler.handler({
  httpMethod: "POST",
  headers: auth,
  body: JSON.stringify({ job_id: jobData.job.id, contractor_id: contractorData.contractor.id }),
});
assert(claimResponse.statusCode === 201, "valley-claims did not create a fulfillment claim");
const claimData = JSON.parse(claimResponse.body);

const fulfillmentResponse = await fulfillmentHandler.handler({
  httpMethod: "PUT",
  headers: auth,
  body: JSON.stringify({ fulfillment_id: claimData.fulfillment.id, status: "fulfilled", procurement_status: "closed", payment_status: "ready_for_release" }),
});
assert(fulfillmentResponse.statusCode === 200, "valley-fulfillment did not update the fulfillment");
const fulfillmentData = JSON.parse(fulfillmentResponse.body);
assert(fulfillmentData.fulfillment.status === "fulfilled", "fulfillment did not reach fulfilled state");

const browserSmoke = await runBrowserSmoke();
if (!browserSmoke.ok && !browserSmoke.skipped) {
  throw new Error(browserSmoke.reason || "browser smoke failed");
}

console.log(JSON.stringify({
  ok: true,
  app: "ValleyVerified-v2",
  surface: "browser operator dashboard plus local operator-session and Netlify APIs for jobs, contractors, claims, and fulfillment",
  verified: [
    "index.html exposes local operator login, job post, contractor onboarding, board refresh, and fulfillment controls",
    "browser app wiring points at the documented operator session and Netlify function lanes",
    "integration contract and function entrypoints exist",
    "function files and shared libs pass node --check",
    "local smoke exercises session login, job post, contractor onboarding, claim, and fulfillment update flows",
    ...(browserSmoke.ok ? ["browser smoke drives operator login, job posting, contractor onboarding, claim, and fulfillment to fulfilled state against an in-folder local runtime"] : []),
  ],
  browser_smoke: browserSmoke,
  not_proven: [
    "live SkyGate token verification against production secrets",
    "live external provider wiring",
    "end-to-end deployed job/claim/fulfillment flows",
  ],
}, null, 2));
