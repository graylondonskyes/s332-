#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function safePath(urlPath) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const resolved = path.resolve(root, "." + rel);
  if (!resolved.startsWith(root + path.sep) && resolved !== path.join(root, "index.html")) return null;
  return resolved;
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function handleFunction(req, res, url) {
  const name = url.pathname.split("/").pop();
  const handler = globalThis.__VALLEYVERIFIED_HANDLERS__?.[name];
  if (!handler) return send(res, 404, JSON.stringify({ ok: false, error: "Function not found" }), { "content-type": "application/json" });
  const body = await readBody(req);
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    rawUrl: url.href,
    path: url.pathname,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body,
    isBase64Encoded: false,
  };
  try {
    const result = await handler(event);
    send(res, Number(result?.statusCode || 200), result?.body || "", result?.headers || { "content-type": "application/json" });
  } catch (error) {
    send(res, 500, JSON.stringify({ ok: false, error: error.message || "Unhandled function error" }), { "content-type": "application/json" });
  }
}

function handleStatic(req, res, url) {
  const file = safePath(url.pathname);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, "Not found", { "content-type": "text/plain; charset=utf-8" });
  }
  return send(res, 200, fs.readFileSync(file), { "content-type": CONTENT_TYPES.get(path.extname(file).toLowerCase()) || "application/octet-stream" });
}

export async function startLocalOpsServer(options = {}) {
  if (!process.env.VALLEYVERIFIED_DATA_DIR) {
    process.env.VALLEYVERIFIED_DATA_DIR = options.dataDir || fs.mkdtempSync(path.join(os.tmpdir(), "valleyverified-browser-"));
  }
  process.env.VALLEYVERIFIED_LOCAL_OPERATOR_EMAIL = options.operatorEmail || process.env.VALLEYVERIFIED_LOCAL_OPERATOR_EMAIL || "operator@internal.invalid";
  process.env.VALLEYVERIFIED_LOCAL_OPERATOR_PASSWORD = options.operatorPassword || process.env.VALLEYVERIFIED_LOCAL_OPERATOR_PASSWORD || "smoke-pass-123";
  process.env.VALLEYVERIFIED_LOCAL_SESSION_SECRET = options.sessionSecret || process.env.VALLEYVERIFIED_LOCAL_SESSION_SECRET || "valleyverified-browser-secret";
  globalThis.__VALLEYVERIFIED_HANDLERS__ = {
    "valley-session": require(path.join(root, "netlify/functions/valley-session.js")).handler,
    "valley-jobs": require(path.join(root, "netlify/functions/valley-jobs.js")).handler,
    "valley-contractors": require(path.join(root, "netlify/functions/valley-contractors.js")).handler,
    "valley-claims": require(path.join(root, "netlify/functions/valley-claims.js")).handler,
    "valley-fulfillment": require(path.join(root, "netlify/functions/valley-fulfillment.js")).handler,
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/.netlify/functions/")) {
      handleFunction(req, res, url);
      return;
    }
    handleStatic(req, res, url);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port || 0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runtime = await startLocalOpsServer();
  process.stdout.write(`${runtime.baseUrl}\n`);
}
