#!/usr/bin/env node
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSkyeDexiaLocalWorker } from "./local-worker.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function mimeType(filePath) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function resolveStaticPath(urlPath) {
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = path.normalize(path.join(root, requestedPath));
  if (!normalized.startsWith(root)) return null;
  return normalized;
}

async function serveStatic(res, urlPath) {
  const filePath = resolveStaticPath(urlPath);
  if (!filePath) {
    json(res, 403, { ok: false, error: "forbidden" });
    return;
  }
  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const data = await fs.readFile(finalPath);
    res.writeHead(200, {
      "content-type": mimeType(finalPath),
      "cache-control": "no-store",
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      json(res, 404, { ok: false, error: "not-found", path: urlPath });
      return;
    }
    json(res, 500, { ok: false, error: error.message });
  }
}

export async function createSkyeDexiaLocalRuntime(options = {}) {
  const workerHost = options.workerHost || "127.0.0.1";
  const workerPort = Number(options.workerPort || 0);
  const worker = await createSkyeDexiaLocalWorker(options);

  await new Promise((resolve, reject) => {
    worker.server.once("error", reject);
    worker.server.listen(workerPort, workerHost, resolve);
  });

  const workerAddress = worker.server.address();
  const boundWorkerPort = typeof workerAddress === "object" && workerAddress ? workerAddress.port : workerPort;
  const workerBase = `http://${workerHost}:${boundWorkerPort}`;

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    try {
      if (
        requestUrl.pathname === "/health" ||
        requestUrl.pathname === "/status" ||
        requestUrl.pathname === "/projects" ||
        requestUrl.pathname.startsWith("/projects/") ||
        requestUrl.pathname.startsWith("/artifacts/")
      ) {
        const headers = worker.context.workerSecret ? { "x-worker-secret": worker.context.workerSecret } : {};
        const response = await fetch(`${workerBase}${requestUrl.pathname}`, { headers });
        const payload = await response.text();
        res.writeHead(response.status, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(payload);
        return;
      }

      if (req.method === "POST" && (requestUrl.pathname === "/build-website" || requestUrl.pathname === "/queue/drain")) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const headers = {
          "content-type": req.headers["content-type"] || "application/json",
        };
        if (worker.context.workerSecret) headers["x-worker-secret"] = worker.context.workerSecret;
        const response = await fetch(`${workerBase}${requestUrl.pathname}`, {
          method: "POST",
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        });
        const payload = await response.text();
        res.writeHead(response.status, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(payload);
        return;
      }

      await serveStatic(res, requestUrl.pathname);
    } catch (error) {
      if (error instanceof SyntaxError) {
        json(res, 400, { ok: false, error: "invalid-json-body" });
        return;
      }
      json(res, 500, { ok: false, error: error.message });
    }
  });

  return {
    server,
    context: {
      workerBase,
      workerSecret: worker.context.workerSecret,
      statePath: worker.context.statePath,
      outputDir: worker.context.outputDir,
      workerMode: "local-proof-harness",
    },
    close: async () => {
      await new Promise((resolve, reject) => worker.server.close((error) => (error ? reject(error) : resolve())));
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const host = process.env.SKYDEXIA_RUNTIME_HOST || "127.0.0.1";
  const port = Number(process.env.SKYDEXIA_RUNTIME_PORT || "4121");
  const runtime = await createSkyeDexiaLocalRuntime({
    statePath: process.env.SKYDEXIA_LOCAL_WORKER_STATE_PATH,
    outputDir: process.env.SKYDEXIA_LOCAL_WORKER_OUTPUT_DIR,
    workerSecret: process.env.SKYDEXIA_WORKER_SECRET,
    workerHost: process.env.SKYDEXIA_WORKER_HOST || "127.0.0.1",
    workerPort: Number(process.env.SKYDEXIA_WORKER_PORT || 0),
  });
  runtime.server.listen(port, host, () => {
    const address = runtime.server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(JSON.stringify({
      ok: true,
      app: "SkyeDexiaNeural",
      mode: "local-proof-harness",
      url: `http://${host}:${resolvedPort}`,
      workerBase: runtime.context.workerBase,
      secretRequired: Boolean(runtime.context.workerSecret),
    }));
  });
}
