#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultStorePath = path.join(root, "runtime/store.json");

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

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
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".pdf":
      return "application/pdf";
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

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function ensureStore(storePath) {
  try {
    return JSON.parse(await fs.readFile(storePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const emptyStore = {
      requests: [],
      streams: [],
      updatedAt: null,
    };
    await writeStore(storePath, emptyStore);
    return emptyStore;
  }
}

async function writeStore(storePath, store) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function extractPrompt(body) {
  if (body?.input?.type === "text" && typeof body.input.content === "string") {
    return body.input.content.trim();
  }
  if (Array.isArray(body?.messages)) {
    return body.messages
      .map((message) => String(message?.content || "").trim())
      .filter(Boolean)
      .slice(-3)
      .join("\n\n")
      .trim();
  }
  return "";
}

function buildDeterministicText(prompt, model) {
  const excerpt = prompt.slice(0, 280);
  return [
    "kAIxUDeltaGate local proof response.",
    `Model lane: ${model}.`,
    "This folder proves request parsing, response shaping, and local request logging only.",
    "Remote worker reachability, token allowlists, and provider execution remain out of scope here.",
    "",
    "Prompt excerpt:",
    excerpt || "(empty prompt)",
  ].join("\n");
}

async function recordRequest(context, request) {
  const store = await ensureStore(context.storePath);
  const nextStore = {
    ...store,
    updatedAt: request.recordedAt,
    requests: [...store.requests, request].slice(-25),
  };
  await writeStore(context.storePath, nextStore);
}

async function recordStream(context, streamEvent) {
  const store = await ensureStore(context.storePath);
  const nextStore = {
    ...store,
    updatedAt: streamEvent.recordedAt,
    streams: [...(store.streams || []), streamEvent].slice(-25),
  };
  await writeStore(context.storePath, nextStore);
}

function parseBearerToken(req) {
  const auth = String(req.headers.authorization || "");
  const xToken = String(req.headers["x-kaixu-token"] || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return xToken.trim();
}

export async function createDeltaGateLocalRuntime(options = {}) {
  const context = {
    storePath: path.resolve(options.storePath || defaultStorePath),
    startedAt: new Date().toISOString(),
  };
  const models = [
    {
      id: "delta-proof-planner",
      provider: "local-proof",
      capabilities: ["health", "request-planning", "deterministic-generate"],
    },
    {
      id: "delta-proof-stream",
      provider: "local-proof",
      capabilities: ["sse", "deterministic-stream"],
    },
  ];

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    try {
      if (req.method === "GET" && requestUrl.pathname === "/health") {
        json(res, 200, {
          ok: true,
          app: "kAIxUDeltaGate",
          mode: "self-contained-local-proof-api",
          startedAt: context.startedAt,
          storePath: context.storePath,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/v1/health") {
        const token = parseBearerToken(req);
        json(res, 200, {
          ok: true,
          mode: "self-contained-local-proof-api",
          keyConfigured: false,
          authConfigured: false,
          openGate: false,
          remoteExecutionRequired: true,
          tokenProvided: Boolean(token),
          note: "Local proof lane only. This does not certify the remote worker, auth allowlists, or providers.",
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/v1/models") {
        json(res, 200, {
          ok: true,
          mode: "self-contained-local-proof-api",
          models,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/v1/requests") {
        const store = await ensureStore(context.storePath);
        json(res, 200, {
          ok: true,
          mode: "self-contained-local-proof-api",
          totalRequests: store.requests.length,
          totalStreams: (store.streams || []).length,
          requests: store.requests,
          streams: store.streams || [],
        });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/v1/generate") {
        const body = await readBody(req);
        const prompt = extractPrompt(body);
        if (!prompt) {
          json(res, 400, { ok: false, error: "prompt-required" });
          return;
        }
        const model = String(body.model || "delta-proof-planner");
        const token = parseBearerToken(req);
        const recordedAt = new Date().toISOString();
        const requestId = makeId("req");
        const text = buildDeterministicText(prompt, model);
        await recordRequest(context, {
          requestId,
          recordedAt,
          mode: "generate",
          model,
          prompt,
          tokenProvided: Boolean(token),
          messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
        });
        json(res, 200, {
          ok: true,
          mode: "self-contained-local-proof-api",
          requestId,
          model,
          text,
          finishReason: "STOP",
          usage: {
            promptTokens: Math.max(12, Math.ceil(prompt.length / 4)),
            candidatesTokens: Math.max(24, Math.ceil(text.length / 4)),
            thoughtsTokens: 0,
            totalTokens: Math.max(36, Math.ceil((prompt.length + text.length) / 4)),
          },
          guardrails: {
            remoteExecutionProven: false,
            providerExecutionProven: false,
          },
        });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/v1/stream") {
        const body = await readBody(req);
        const prompt = extractPrompt(body);
        if (!prompt) {
          json(res, 400, { ok: false, error: "prompt-required" });
          return;
        }
        const model = String(body.model || "delta-proof-stream");
        const token = parseBearerToken(req);
        const recordedAt = new Date().toISOString();
        const requestId = makeId("stream");
        const text = buildDeterministicText(prompt, model);
        await recordStream(context, {
          requestId,
          recordedAt,
          model,
          prompt,
          tokenProvided: Boolean(token),
        });

        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          connection: "keep-alive",
        });
        const chunks = [
          "kAIxUDeltaGate local proof stream.",
          "This proves SSE framing and request logging only.",
          `Prompt excerpt: ${prompt.slice(0, 120) || "(empty prompt)"}`,
        ];
        for (const chunk of chunks) {
          const payload = {
            requestId,
            model,
            candidates: [
              {
                content: {
                  parts: [{ text: `${chunk}\n` }],
                },
              },
            ],
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
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

  return { server, context };
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const host = process.env.DELTA_GATE_LOCAL_HOST || "127.0.0.1";
  const port = Number(process.env.DELTA_GATE_LOCAL_PORT || "8788");
  const { server, context } = await createDeltaGateLocalRuntime({
    storePath: process.env.DELTA_GATE_LOCAL_STORE_PATH,
  });
  server.listen(port, host, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(JSON.stringify({
      ok: true,
      app: "kAIxUDeltaGate",
      mode: "self-contained-local-proof-api",
      url: `http://${host}:${resolvedPort}`,
      storePath: context.storePath,
    }));
  });
}
