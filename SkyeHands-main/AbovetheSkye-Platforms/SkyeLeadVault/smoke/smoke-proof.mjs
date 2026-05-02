#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parse(response) {
  return JSON.parse(response.body || "{}");
}

async function call(handler, { method = "GET", query = {}, body, authToken } = {}) {
  return handler.handler({
    httpMethod: method,
    queryStringParameters: query,
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
    body: body === undefined ? "" : JSON.stringify(body),
  });
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skye-leadvault-proof-"));
process.env.LEAD_VAULT_DATA_DIR = tmpDir;
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.SKYGATE_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" });
process.env.SKYGATE_LOCAL_SESSION_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" });
process.env.SKYGATE_ENABLE_LOCAL_SESSION_BOOTSTRAP = "1";
process.env.SKYGATE_LOCAL_OPERATOR_EMAIL = "operator@internal.invalid";
process.env.SKYGATE_LOCAL_OPERATOR_PASSWORD = "proof-password";
process.env.SKYGATE_LOCAL_OPERATOR_ROLE = "admin";
const leads = require(path.join(root, "netlify/functions/leads.js"));
const scoring = require(path.join(root, "netlify/functions/lead-scoring.js"));
const analytics = require(path.join(root, "netlify/functions/lead-analytics.js"));
const session = require(path.join(root, "netlify/functions/skygate-session.js"));

const publicHtml = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
const authHelper = fs.readFileSync(path.join(root, "public/skygate-auth.js"), "utf8");

assert(publicHtml.includes("const API = '/.netlify/functions';"), "public/index.html is missing the shared function base path");
assert(publicHtml.includes("fetch(`${API}/leads`"), "public/index.html is missing leads API wiring");
assert(publicHtml.includes("fetch(`${API}/lead-scoring?leadId=${leadId}`"), "public/index.html is missing lead-scoring wiring");
assert(adminHtml.includes('leadId: editingId, type, note'), "admin.html is not wired to the activity handler payload");
assert(adminHtml.includes("skygate-auth.js"), "admin.html is missing the shared SkyGate browser auth helper");
assert(adminHtml.includes("skygate-session"), "admin.html is missing local SkyGate session bootstrap wiring");
assert(adminHtml.includes("bootstrapAdminAuth"), "admin.html is missing the local proof auth bootstrap control");
assert(adminHtml.includes("Operator Login"), "admin.html is missing the operator login control");
assert(adminHtml.includes("headers: authHeaders()"), "admin.html is missing auth header wiring for protected actions");
assert(authHelper.includes("window.sessionStorage"), "skygate-auth.js is not using session-scoped token storage");
assert(authHelper.includes("loginLocalOperator"), "skygate-auth.js is missing local operator login wiring");
assert(adminHtml.includes('value="proposal"'), "admin.html is missing the canonical proposal stage option");
assert(adminHtml.includes('value="closed_won"'), "admin.html is missing the canonical closed_won stage option");
assert(adminHtml.includes('value="closed_lost"'), "admin.html is missing the canonical closed_lost stage option");
assert(adminHtml.includes("action=list&status=${stage}"), "admin.html lead filter is not wired to the handler's status query");

const sessionRes = await call(session, {
  method: "POST",
  body: { subject: "proof-operator", role: "admin" },
});
assert(sessionRes.statusCode === 200, `local session bootstrap failed: ${sessionRes.statusCode}`);
const sessionData = parse(sessionRes);
const token = sessionData.token;
assert(token, "local session bootstrap did not return a token");

const operatorLoginRes = await call(session, {
  method: "POST",
  body: {
    grantType: "password",
    email: "operator@internal.invalid",
    password: "proof-password",
    subject: "proof-operator-login",
  },
});
assert(operatorLoginRes.statusCode === 200, `local operator login failed: ${operatorLoginRes.statusCode}`);
const operatorToken = parse(operatorLoginRes).token;
assert(operatorToken, "local operator login did not return a token");

const createdRes = await call(leads, {
  method: "POST",
  body: {
    action: "create",
    name: "Proof Lead",
    email: "proof.lead@internal.invalid",
    phone: "+1 555-0101",
    company: "Proof Co",
    source: "referral",
    notes: "Certification smoke lead",
  },
});
assert(createdRes.statusCode === 201, `lead create failed: ${createdRes.statusCode}`);
const created = parse(createdRes);
const leadId = created.lead?.id;
assert(leadId, "lead create did not return an id");

const activityRes = await call(leads, {
  method: "POST",
  authToken: token,
  body: { action: "activity", leadId, type: "call", note: "Reached lead by phone" },
});
assert(activityRes.statusCode === 201, `lead activity failed: ${activityRes.statusCode}`);

const stageRes = await call(leads, {
  method: "POST",
  authToken: token,
  body: { action: "stage", id: leadId, stage: "proposal" },
});
assert(stageRes.statusCode === 200, `lead stage update failed: ${stageRes.statusCode}`);

const listRes = await call(leads, { method: "GET", query: { action: "list", status: "proposal" } });
assert(listRes.statusCode === 200, `lead list failed: ${listRes.statusCode}`);
const listData = parse(listRes);
assert(Array.isArray(listData.leads) && listData.leads.some((lead) => lead.id === leadId), "proposal lead not returned from list");

const scoreRes = await call(scoring, { method: "GET", query: { leadId } });
assert(scoreRes.statusCode === 200, `lead scoring failed: ${scoreRes.statusCode}`);
const scoreData = parse(scoreRes);
assert(scoreData.finalScore >= 60, `lead score unexpectedly low: ${scoreData.finalScore}`);
assert(Array.isArray(scoreData.breakdown) && scoreData.breakdown.some((item) => item.rule === "stage_proposal" && item.applied), "score breakdown is missing proposal-stage credit");

const analyticsRes = await call(analytics, { method: "GET", authToken: token });
assert(analyticsRes.statusCode === 200, `lead analytics failed: ${analyticsRes.statusCode}`);
const analyticsByOperatorRes = await call(analytics, { method: "GET", authToken: operatorToken });
assert(analyticsByOperatorRes.statusCode === 200, `lead analytics via local operator login failed: ${analyticsByOperatorRes.statusCode}`);

console.log(JSON.stringify({
  ok: true,
  app: "SkyeLeadVault",
  surface: "public lead capture plus local SkyGate-backed admin handlers",
  verified: [
    "public lead form wiring exists",
    "local SkyGate session bootstrap can mint an admin token",
    "local operator credentials can mint an admin session token",
    "browser auth storage is scoped to the active session",
    "browser admin stage controls use the same canonical stage names as the handler",
    "lead create works from the local handler",
    "authenticated activity, analytics, and stage transitions work",
    "lead scoring returns a real breakdown for the created lead",
    "admin browser surface is wired to the local proof auth bootstrap for protected actions"
  ],
  not_proven: [
    "real identity-provider handoff into SkyGate tokens",
    "deployed Netlify runtime behavior",
  ],
  leadId,
  finalScore: scoreData.finalScore,
}, null, 2));
