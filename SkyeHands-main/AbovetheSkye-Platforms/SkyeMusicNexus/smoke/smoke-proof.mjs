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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skye-musicnexus-proof-"));
process.env.MUSIC_NEXUS_DATA_DIR = tmpDir;
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.SKYGATE_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" });
process.env.SKYGATE_LOCAL_SESSION_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" });
process.env.SKYGATE_ENABLE_LOCAL_SESSION_BOOTSTRAP = "1";
process.env.SKYGATE_LOCAL_OPERATOR_EMAIL = "operator@internal.invalid";
process.env.SKYGATE_LOCAL_OPERATOR_PASSWORD = "proof-password";
process.env.SKYGATE_LOCAL_OPERATOR_ROLE = "admin";
const artists = require(path.join(root, "netlify/functions/music-artists.js"));
const releases = require(path.join(root, "netlify/functions/music-releases.js"));
const payments = require(path.join(root, "netlify/functions/music-payments.js"));
const analytics = require(path.join(root, "netlify/functions/music-analytics.js"));
const session = require(path.join(root, "netlify/functions/skygate-session.js"));

const indexHtml = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
const authHelper = fs.readFileSync(path.join(root, "public/skygate-auth.js"), "utf8");
assert(indexHtml.includes("/.netlify/functions/music-artists"), "public/index.html is missing music-artists wiring");
assert(indexHtml.includes("/.netlify/functions/music-releases"), "public/index.html is missing music-releases wiring");
assert(indexHtml.includes("/.netlify/functions/music-payments"), "public/index.html is missing music-payments wiring");
assert(indexHtml.includes("skygate-auth.js"), "public/index.html is missing the shared SkyGate browser auth helper");
assert(indexHtml.includes("skygate-session"), "public/index.html is missing local SkyGate session bootstrap wiring");
assert(indexHtml.includes("Operator Login"), "public/index.html is missing the operator login control");
assert(adminHtml.includes("skygate-auth.js"), "public/admin.html is missing the shared SkyGate browser auth helper");
assert(adminHtml.includes("skygate-session"), "public/admin.html is missing local SkyGate session bootstrap wiring");
assert(adminHtml.includes("Operator Login"), "public/admin.html is missing the operator login control");
assert(authHelper.includes("window.sessionStorage"), "skygate-auth.js is not using session-scoped token storage");
assert(authHelper.includes("loginLocalOperator"), "skygate-auth.js is missing local operator login wiring");

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

const artistRes = await call(artists, {
  method: "POST",
  authToken: token,
  body: {
    action: "register",
    name: "Proof Artist",
    email: "proof.artist@internal.invalid",
    genre: ["ambient", "electronic"],
    bio: "Certification lane artist",
  },
});
assert(artistRes.statusCode === 201, `artist register failed: ${artistRes.statusCode}`);
const artistData = parse(artistRes);
const artistId = artistData.artistId;
assert(artistId, "artist register did not return an artistId");

const approveRes = await call(artists, {
  method: "POST",
  authToken: token,
  body: { action: "approve", id: artistId },
});
assert(approveRes.statusCode === 200, `artist approve failed: ${approveRes.statusCode}`);

const submitRes = await call(releases, {
  method: "POST",
  authToken: token,
  body: {
    action: "submit",
    artistId,
    title: "Proof Release",
    type: "single",
    tracks: [{ title: "Proof Track", duration: 181 }],
    distributionTargets: ["Spotify", "Apple Music"],
  },
});
assert(submitRes.statusCode === 201, `release submit failed: ${submitRes.statusCode}`);
const submitData = parse(submitRes);
const releaseId = submitData.release?.id;
assert(releaseId, "release submit did not return a release id");

const reviewRes = await call(releases, {
  method: "POST",
  authToken: token,
  body: { action: "review", id: releaseId, decision: "approve", notes: "Ready for lane proof" },
});
assert(reviewRes.statusCode === 200, `release review failed: ${reviewRes.statusCode}`);

const publishRes = await call(releases, {
  method: "POST",
  authToken: token,
  body: { action: "publish", id: releaseId },
});
assert(publishRes.statusCode === 200, `release publish failed: ${publishRes.statusCode}`);

const streamsRes = await call(releases, {
  method: "POST",
  authToken: token,
  body: { action: "report-streams", id: releaseId, streams: 2500, downloads: 80, saves: 120 },
});
assert(streamsRes.statusCode === 200, `stream report failed: ${streamsRes.statusCode}`);

const creditRes = await call(payments, {
  method: "POST",
  authToken: token,
  body: { action: "credit", artistId, amount: 145.5, reason: "Proof royalty credit", referenceId: releaseId },
});
assert(creditRes.statusCode === 201, `credit failed: ${creditRes.statusCode}`);

const ledgerRes = await call(payments, {
  method: "GET",
  authToken: token,
  query: { action: "ledger", artistId },
});
assert(ledgerRes.statusCode === 200, `ledger failed: ${ledgerRes.statusCode}`);
const ledgerData = parse(ledgerRes);
assert(Array.isArray(ledgerData.ledger) && ledgerData.ledger.length >= 1, "ledger did not record the credit");

const payoutRes = await call(payments, {
  method: "POST",
  authToken: token,
  body: { action: "payout", artistId, amount: 45.5, payoutMethod: "paypal" },
});
assert(payoutRes.statusCode === 201, `payout request failed: ${payoutRes.statusCode}`);
const payoutData = parse(payoutRes);
const payoutId = payoutData.payout?.id;
assert(payoutId, "payout request did not return a payout id");

const publicArtistRes = await call(artists, { method: "GET", query: { action: "get", id: artistId } });
assert(publicArtistRes.statusCode === 200, `public artist get failed: ${publicArtistRes.statusCode}`);
const publicReleaseRes = await call(releases, { method: "GET", query: { action: "list", artistId } });
assert(publicReleaseRes.statusCode === 200, `public release list failed: ${publicReleaseRes.statusCode}`);

const payoutListRes = await call(payments, { method: "GET", authToken: token, query: { action: "payouts", status: "pending" } });
assert(payoutListRes.statusCode === 200, `payout list failed: ${payoutListRes.statusCode}`);
const payoutListData = parse(payoutListRes);
assert(Array.isArray(payoutListData.payouts) && payoutListData.payouts.some((entry) => entry.id === payoutId), "payout list did not include the requested payout");

const analyticsRes = await call(analytics, { method: "GET", authToken: token });
assert(analyticsRes.statusCode === 200, `music analytics failed: ${analyticsRes.statusCode}`);
const analyticsByOperatorRes = await call(analytics, { method: "GET", authToken: operatorToken });
assert(analyticsByOperatorRes.statusCode === 200, `music analytics via local operator login failed: ${analyticsByOperatorRes.statusCode}`);

console.log(JSON.stringify({
  ok: true,
  app: "SkyeMusicNexus",
  surface: "artist portal shell plus local SkyGate-backed artist, release, and payments handlers",
  verified: [
    "browser artist and admin surfaces are wired to the local SkyGate bootstrap",
    "local operator credentials can mint an admin session token",
    "browser auth storage is scoped to the active session",
    "artist registration works in the local handler surface",
    "release submit, review, publish, and stream reporting work",
    "payments credit, ledger, payout request, and payout queue work",
    "admin analytics accepts the locally bootstrapped token",
    "public artist and release read endpoints return the created records",
  ],
  not_proven: [
    "real identity-provider handoff into SkyGate tokens",
    "deployed platform distribution integrations",
  ],
  artistId,
  releaseId,
  payoutId,
}, null, 2));
