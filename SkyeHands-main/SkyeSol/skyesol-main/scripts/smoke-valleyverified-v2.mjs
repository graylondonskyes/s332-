import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(new URL("..", import.meta.url).pathname);
const repoRoot = path.resolve(root, "..", "..");
const vvRoot = path.join(repoRoot, "AbovetheSkye-Platforms", "ValleyVerified-v2");
const adapterFile = path.join(root, "Platforms-Apps-Infrastructure", "SkyeRoutex", "app-fabric", "adapters", "valleyverified-v2.v1.json");
const contractFile = path.join(vvRoot, "integration.contract.json");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "valleyverified-v2-smoke-"));
process.env.VALLEYVERIFIED_DATA_DIR = tmp;
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.SKYGATE_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" });

const { issueTestSkyGateToken } = require(path.join(vvRoot, "netlify", "functions", "_lib", "skygate-auth.js"));
const jobs = require(path.join(vvRoot, "netlify", "functions", "valley-jobs.js"));
const contractors = require(path.join(vvRoot, "netlify", "functions", "valley-contractors.js"));
const claims = require(path.join(vvRoot, "netlify", "functions", "valley-claims.js"));
const fulfillment = require(path.join(vvRoot, "netlify", "functions", "valley-fulfillment.js"));

const token = issueTestSkyGateToken({ sub: "smoke-operator", email: "operator@valleyverified.local", role: "operator" }, privateKey);
const headers = { authorization: `Bearer ${token}` };
const event = (method, body = null, queryStringParameters = {}) => ({
  httpMethod: method,
  headers,
  queryStringParameters,
  body: body ? JSON.stringify(body) : "",
});
const parse = (response) => JSON.parse(response.body);

for (const file of [
  path.join(vvRoot, "index.html"),
  path.join(vvRoot, "assets", "valleyverified.js"),
  path.join(vvRoot, "assets", "valleyverified.css"),
  contractFile,
  adapterFile,
]) {
  assert(fs.existsSync(file), `Missing required file: ${path.relative(root, file)}`);
}

const adapter = JSON.parse(fs.readFileSync(adapterFile, "utf8"));
const contract = JSON.parse(fs.readFileSync(contractFile, "utf8"));
assert.equal(adapter.status, "active");
assert(adapter.integratesWith.includes("jobping"));
assert(adapter.integratesWith.includes("ae-contractor-network"));
assert(adapter.integratesWith.includes("skye-routex-core"));
assert(adapter.capabilities.includes("procurement"));
assert(adapter.capabilities.includes("fulfillment"));
assert.equal(contract.auth.provider, "SkyGate");

for (const required of adapter.qa.requiredFiles) {
  const resolved = path.resolve(path.dirname(adapterFile), required);
  assert(fs.existsSync(resolved), `Missing adapter QA file: ${required}`);
}

const jobCreate = parse(await jobs.handler(event("POST", {
  company: "Desert Line Kitchen",
  title: "Friday dinner shift coverage",
  type: "restaurant_shift",
  location: "Phoenix",
  rate_cents: 18000,
  description: "Need reliable coverage for peak service.",
})));
assert.equal(jobCreate.ok, true);
assert.equal(jobCreate.job.status, "posted");

const contractorCreate = parse(await contractors.handler(event("POST", {
  name: "Valley Runner One",
  email: "runner@example.com",
  serviceArea: "Phoenix",
  skills: ["restaurant_shift", "event_staffing"],
  status: "verified",
})));
assert.equal(contractorCreate.ok, true);
assert.equal(contractorCreate.contractor.status, "verified");

const claimCreate = parse(await claims.handler(event("POST", {
  job_id: jobCreate.job.id,
  contractor_id: contractorCreate.contractor.id,
})));
assert.equal(claimCreate.ok, true);
assert.equal(claimCreate.fulfillment.procurement_status, "ready_for_work_order");
assert.equal(claimCreate.fulfillment.payment_status, "pending_skye_routex");

const fulfillUpdate = parse(await fulfillment.handler(event("POST", {
  fulfillment_id: claimCreate.fulfillment.id,
  status: "fulfilled",
  procurement_status: "work_order_closed",
  payment_status: "ready_for_payout",
  notes: "Smoke closeout.",
})));
assert.equal(fulfillUpdate.ok, true);
assert.equal(fulfillUpdate.fulfillment.status, "fulfilled");
assert.equal(fulfillUpdate.job.status, "fulfilled");

const board = parse(await jobs.handler(event("GET", null, { status: "all" })));
assert.equal(board.jobs.length, 1);
assert.equal(board.jobs[0].status, "fulfilled");

console.log(JSON.stringify({
  ok: true,
  platform: "ValleyVerified-v2",
  cycle: ["job posted", "contractor onboarded", "job claimed", "fulfillment closed"],
  job_id: jobCreate.job.id,
  contractor_id: contractorCreate.contractor.id,
  fulfillment_id: claimCreate.fulfillment.id,
  integrations: adapter.integratesWith,
  dataDir: tmp,
}, null, 2));
