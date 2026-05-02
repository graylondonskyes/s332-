#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDir = path.join(root, "runtime", "data");
const defaultPacketsDir = path.join(defaultDataDir, "packets");
const defaultJournalPath = path.join(defaultDataDir, "runtime-journal.json");

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
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".md":
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readJournal(context) {
  return readJson(context.journalPath, []);
}

async function appendJournal(context, entry) {
  const current = await readJournal(context);
  current.unshift({
    id: String(entry.id || makeId("packetlog")),
    type: String(entry.type || "event"),
    detail: String(entry.detail || ""),
    createdAt: entry.createdAt || new Date().toISOString(),
    meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
  });
  await writeJson(context.journalPath, current.slice(0, 160));
}

function sanitizePacket(body) {
  const packet = body && typeof body.packet === "object" ? body.packet : body;
  const summary = packet && typeof packet.summary === "object" ? packet.summary : {};
  return {
    packetId: String(packet.packetId || makeId("packet")),
    packetType: String(packet.packetType || "soc2-local-proof-packet"),
    generatedAt: packet.generatedAt || new Date().toISOString(),
    organization: String(packet.organization || ""),
    reviewWindow: String(packet.reviewWindow || ""),
    reviewOwner: String(packet.reviewOwner || ""),
    docs: packet.docs && typeof packet.docs === "object" ? packet.docs : {},
    summary: {
      controls: Number(summary.controls || 0),
      evidenceItems: Number(summary.evidenceItems || 0),
      readyControls: Number(summary.readyControls || 0),
      gapControls: Number(summary.gapControls || 0),
    },
    controls: Array.isArray(packet.controls) ? packet.controls : [],
    evidenceItems: Array.isArray(packet.evidenceItems) ? packet.evidenceItems : [],
    notes: String(packet.notes || ""),
  };
}

async function savePacket(context, body) {
  const packet = sanitizePacket(body);
  const fileName = `${packet.generatedAt.replaceAll(/[:.]/g, "-")}-${packet.packetId}.json`;
  const filePath = path.join(context.packetsDir, fileName);
  await ensureDir(context.packetsDir);
  await fs.writeFile(filePath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  return {
    packetId: packet.packetId,
    packetType: packet.packetType,
    generatedAt: packet.generatedAt,
    organization: packet.organization,
    reviewWindow: packet.reviewWindow,
    reviewOwner: packet.reviewOwner,
    summary: packet.summary,
    file: path.relative(root, filePath).replaceAll(path.sep, "/"),
  };
}

async function listPackets(context) {
  await ensureDir(context.packetsDir);
  const dirents = await fs.readdir(context.packetsDir, { withFileTypes: true });
  const packets = [];
  for (const dirent of dirents) {
    if (!dirent.isFile() || !dirent.name.endsWith(".json")) continue;
    const fullPath = path.join(context.packetsDir, dirent.name);
    const packet = await readJson(fullPath, null);
    if (!packet) continue;
    packets.push({
      packetId: packet.packetId,
      packetType: packet.packetType,
      generatedAt: packet.generatedAt,
      organization: packet.organization,
      reviewWindow: packet.reviewWindow,
      reviewOwner: packet.reviewOwner,
      summary: packet.summary || {},
      file: path.relative(root, fullPath).replaceAll(path.sep, "/"),
    });
  }
  packets.sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));
  return packets;
}

async function readPacket(context, packetId) {
  const packets = await listPackets(context);
  const match = packets.find((item) => item.packetId === packetId);
  if (!match) return null;
  return readJson(path.join(root, match.file), null);
}

async function summarize(context) {
  const packets = await listPackets(context);
  const journal = await readJournal(context);
  return {
    ok: true,
    app: "Skye Identity Standard: Global Command Center",
    mode: "same-folder-local-runtime",
    startedAt: context.startedAt,
    packets: {
      total: packets.length,
      latestAt: packets[0]?.generatedAt || null,
      latest: packets[0] || null,
    },
    journal: {
      total: journal.length,
      latestAt: journal[0]?.createdAt || null,
      latestEntry: journal[0] || null,
    },
  };
}

function resolveStaticPath(urlPath) {
  const requestPath = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = path.normalize(path.join(root, requestPath));
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

export async function createSISLocalRuntime(options = {}) {
  const context = {
    dataDir: path.resolve(options.dataDir || defaultDataDir),
    packetsDir: path.resolve(options.packetsDir || defaultPacketsDir),
    journalPath: path.resolve(options.journalPath || defaultJournalPath),
    startedAt: new Date().toISOString(),
  };

  await ensureDir(context.dataDir);
  await ensureDir(context.packetsDir);

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    try {
      if (req.method === "GET" && requestUrl.pathname === "/health") {
        json(res, 200, await summarize(context));
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/runtime/status") {
        json(res, 200, await summarize(context));
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/runtime/packets") {
        const packets = await listPackets(context);
        json(res, 200, { ok: true, total: packets.length, packets });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/api/runtime/packets") {
        const body = await readBody(req);
        const packet = await savePacket(context, body);
        await appendJournal(context, {
          type: "soc2-local-proof-packet",
          detail: `Saved packet for ${packet.organization || "local worksheet"}`,
          createdAt: packet.generatedAt,
          meta: {
            packetId: packet.packetId,
            file: packet.file,
            summary: packet.summary,
          },
        });
        json(res, 200, { ok: true, packet, status: await summarize(context) });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname.startsWith("/api/runtime/packets/")) {
        const packetId = decodeURIComponent(requestUrl.pathname.split("/").pop() || "");
        const packet = await readPacket(context, packetId);
        if (!packet) {
          json(res, 404, { ok: false, error: "packet-not-found", packetId });
          return;
        }
        json(res, 200, { ok: true, packet });
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
    context,
    close: async () =>
      new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const host = process.env.SIS_RUNTIME_HOST || "127.0.0.1";
  const port = Number(process.env.SIS_RUNTIME_PORT || "4192");
  const runtime = await createSISLocalRuntime({
    dataDir: process.env.SIS_RUNTIME_DATA_DIR,
    packetsDir: process.env.SIS_RUNTIME_PACKETS_DIR,
    journalPath: process.env.SIS_RUNTIME_JOURNAL_PATH,
  });
  runtime.server.listen(port, host, () => {
    const address = runtime.server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(JSON.stringify({
      ok: true,
      app: "Skye Identity Standard: Global Command Center",
      mode: "same-folder-local-runtime",
      url: `http://${host}:${resolvedPort}`,
      dataDir: path.relative(root, runtime.context.dataDir).replaceAll(path.sep, "/"),
    }));
  });
}
