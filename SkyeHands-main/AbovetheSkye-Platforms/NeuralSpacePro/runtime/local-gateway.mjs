#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultStatePath = path.join(root, "runtime/local-state.json");

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
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".png":
      return "image/png";
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

async function ensureState(statePath) {
  try {
    return JSON.parse(await fs.readFile(statePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const emptyState = { sessions: [], updatedAt: null };
    await writeState(statePath, emptyState);
    return emptyState;
  }
}

async function writeState(statePath, state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function summarizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => String(message?.content || "").trim())
    .filter(Boolean)
    .slice(-3)
    .join("\n\n")
    .slice(0, 1400);
}

export async function createNeuralSpaceProLocalGateway() {
  const startedAt = new Date().toISOString();
  const statePath = path.resolve(process.env.NEURAL_SPACE_PRO_STATE_PATH || defaultStatePath);
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && requestUrl.pathname === "/health") {
        const state = await ensureState(statePath);
        json(res, 200, {
          ok: true,
          app: "NeuralSpacePro",
          mode: "local-proof-harness",
          startedAt,
          sessionCount: state.sessions.length,
          routes: ["/health", "/.netlify/functions/gateway-chat", "/v1/sessions"],
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/v1/sessions") {
        const state = await ensureState(statePath);
        json(res, 200, {
          ok: true,
          mode: "local-proof-harness",
          totalSessions: state.sessions.length,
          sessions: state.sessions,
        });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/.netlify/functions/gateway-chat") {
        const body = await readBody(req);
        const summary = summarizeMessages(body.messages);
        if (!summary) {
          json(res, 400, { ok: false, error: "messages-required" });
          return;
        }
        const outputText = [
          "Local proof harness response.",
          "This folder proves same-origin chat route wiring without claiming live provider execution.",
          "",
          "Recent prompt context:",
          summary,
        ].join("\n");
        const state = await ensureState(statePath);
        const session = {
          sessionId: `sess_${Date.now().toString(36)}`,
          recordedAt: new Date().toISOString(),
          model: "deterministic-workspace-echo",
          promptExcerpt: summary.slice(0, 240),
          outputExcerpt: outputText.slice(0, 240),
          messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
        };
        await writeState(statePath, {
          sessions: [...state.sessions, session].slice(-25),
          updatedAt: session.recordedAt,
        });
        json(res, 200, {
          ok: true,
          mode: "local-proof-harness",
          provider: "local-proof-harness",
          model: "deterministic-workspace-echo",
          sessionId: session.sessionId,
          sessionCount: state.sessions.length + 1,
          output_text: outputText,
        });
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

  return { server, startedAt, statePath };
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const host = process.env.NEURAL_SPACE_PRO_HOST || "127.0.0.1";
  const port = Number(process.env.NEURAL_SPACE_PRO_PORT || "8787");
  const { server, startedAt } = await createNeuralSpaceProLocalGateway();
  server.listen(port, host, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(JSON.stringify({
      ok: true,
      app: "NeuralSpacePro",
      mode: "local-proof-harness",
      url: `http://${host}:${resolvedPort}`,
      startedAt,
      statePath,
    }));
  });
}
