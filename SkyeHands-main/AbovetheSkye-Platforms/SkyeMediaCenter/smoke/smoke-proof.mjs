#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaAssets = require(path.join(root, "netlify/functions/media-assets.js"));
const mediaFile = require(path.join(root, "netlify/functions/media-file.js"));
const mediaPublish = require(path.join(root, "netlify/functions/media-publish.js"));
const mediaSearch = require(path.join(root, "netlify/functions/media-search.js"));
const mediaStats = require(path.join(root, "netlify/functions/media-stats.js"));
const session = require(path.join(root, "netlify/functions/skygate-session.js"));

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skye-mediacenter-proof-"));
process.env.MEDIA_CENTER_DATA_DIR = tmpDir;
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.SKYGATE_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" });
process.env.SKYGATE_LOCAL_SESSION_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" });
process.env.SKYGATE_ENABLE_LOCAL_SESSION_BOOTSTRAP = "1";
process.env.SKYGATE_LOCAL_OPERATOR_EMAIL = "operator@internal.invalid";
process.env.SKYGATE_LOCAL_OPERATOR_PASSWORD = "proof-password";
process.env.SKYGATE_LOCAL_OPERATOR_ROLE = "admin";

const indexHtml = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const adminHtml = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
const authHelper = fs.readFileSync(path.join(root, "public/skygate-auth.js"), "utf8");
assert(indexHtml.includes("content_base64"), "public/index.html is not wired to the media-assets upload contract");
assert(indexHtml.includes("media-assets?action=list"), "public/index.html is not wired to the public recent-assets list");
assert(indexHtml.includes("skygate-auth.js"), "public/index.html is missing the shared SkyGate browser auth helper");
assert(indexHtml.includes("skygate-session"), "public/index.html is missing local SkyGate session bootstrap wiring");
assert(indexHtml.includes("Operator Login"), "public/index.html is missing the operator login control");
assert(adminHtml.includes("skygate-auth.js"), "public/admin.html is missing the shared SkyGate browser auth helper");
assert(adminHtml.includes("skygate-session"), "public/admin.html is missing local SkyGate session bootstrap wiring");
assert(adminHtml.includes("Operator Login"), "public/admin.html is missing the operator login control");
assert(adminHtml.includes("content_base64"), "public/admin.html is not wired to the media-assets upload contract");
assert(authHelper.includes("window.sessionStorage"), "skygate-auth.js is not using session-scoped token storage");
assert(authHelper.includes("loginLocalOperator"), "skygate-auth.js is missing local operator login wiring");
assert(adminHtml.includes("window.open(asset.url"), "public/admin.html is not wired to open local asset URLs");

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

const uploadRes = await call(mediaAssets, {
  method: "POST",
  authToken: token,
  body: {
    action: "upload",
    title: "Proof Asset",
    type: "document",
    filename: "proof-asset.txt",
    content_base64: Buffer.from("proof asset body", "utf8").toString("base64"),
    tags: ["proof", "certification"],
    description: "Local proof upload",
    status: "draft",
    mimeType: "text/plain; charset=utf-8",
  },
});
assert(uploadRes.statusCode === 201, `asset upload failed: ${uploadRes.statusCode}`);
const uploadData = parse(uploadRes);
const assetId = uploadData.asset?.id;
assert(assetId, "asset upload did not return an id");
assert(uploadData.asset?.status === "draft", "asset upload did not preserve draft status");

const listRes = await call(mediaAssets, { method: "GET", query: { action: "list" } });
assert(listRes.statusCode === 200, `asset list failed: ${listRes.statusCode}`);
const listData = parse(listRes);
assert(Array.isArray(listData.assets) && listData.assets.some((asset) => asset.id === assetId), "uploaded asset not present in public list");

const searchRes = await call(mediaSearch, { method: "GET", query: { q: "proof", type: "document" } });
assert(searchRes.statusCode === 200, `media search failed: ${searchRes.statusCode}`);
const searchData = parse(searchRes);
assert(Array.isArray(searchData.results) && searchData.results.some((result) => result.asset?.id === assetId), "uploaded asset not present in media search results");

const protectedFileRes = await call(mediaFile, { method: "GET", query: { id: assetId } });
assert(protectedFileRes.statusCode === 401, `draft asset unexpectedly served without auth: ${protectedFileRes.statusCode}`);

const publishRes = await call(mediaPublish, {
  method: "POST",
  authToken: token,
  body: { assetId, publishTarget: "web" },
});
assert(publishRes.statusCode === 200, `media publish failed: ${publishRes.statusCode}`);

const fileRes = await call(mediaFile, { method: "GET", query: { id: assetId } });
assert(fileRes.statusCode === 200, `published media file fetch failed: ${fileRes.statusCode}`);
assert(fileRes.isBase64Encoded === true, "published media file response is not marked base64");
assert(Buffer.from(fileRes.body || "", "base64").toString("utf8") === "proof asset body", "published media file did not return the stored asset body");

const statsRes = await call(mediaStats, { method: "GET", authToken: token });
assert(statsRes.statusCode === 200, `media stats failed: ${statsRes.statusCode}`);
const statsData = parse(statsRes);
assert(statsData.totalAssets >= 1, "media stats did not count the uploaded asset");
assert(Array.isArray(statsData.recentUploads) && statsData.recentUploads.some((asset) => asset.id === assetId), "uploaded asset not present in media stats recent uploads");
const statsByOperatorRes = await call(mediaStats, { method: "GET", authToken: operatorToken });
assert(statsByOperatorRes.statusCode === 200, `media stats via local operator login failed: ${statsByOperatorRes.statusCode}`);

const deleteRes = await call(mediaAssets, { method: "DELETE", query: { id: assetId }, authToken: token });
assert(deleteRes.statusCode === 200, `asset delete failed: ${deleteRes.statusCode}`);

console.log(JSON.stringify({
  ok: true,
  app: "SkyeMediaCenter",
  surface: "browser upload shell plus local SkyGate-backed media handlers",
  verified: [
    "browser upload and admin surfaces are wired to the local SkyGate bootstrap",
    "local operator credentials can mint an admin session token",
    "browser auth storage is scoped to the active session",
    "browser upload payload matches the local upload contract",
    "authenticated media upload works",
    "draft assets stay protected until explicitly published",
    "published assets can be retrieved through the local media-file handler",
    "public asset list and search can see uploaded assets",
    "authenticated publish, stats, and delete handlers work",
  ],
  not_proven: [
    "real identity-provider handoff into SkyGate tokens",
    "deployed file serving behavior",
  ],
  assetId,
}, null, 2));
