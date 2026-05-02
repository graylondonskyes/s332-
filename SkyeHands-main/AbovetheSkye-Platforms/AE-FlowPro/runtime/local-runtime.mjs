#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDir = path.join(root, "runtime", "data");
const defaultJournalPath = path.join(defaultDataDir, "ops-journal.json");
const defaultSnapshotsDir = path.join(defaultDataDir, "snapshots");

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
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
    case ".webmanifest":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    case ".txt":
    case ".md":
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

function sanitizeJournalEntry(entry) {
  return {
    id: String(entry.id || makeId("journal")),
    type: String(entry.type || "event"),
    detail: String(entry.detail || ""),
    createdAt: entry.createdAt || new Date().toISOString(),
    meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
  };
}

async function readJournal(context) {
  return readJson(context.journalPath, []);
}

async function writeJournal(context, entries) {
  await writeJson(context.journalPath, entries.slice(0, 160));
}

async function appendJournal(context, entry) {
  const next = sanitizeJournalEntry(entry);
  const current = await readJournal(context);
  current.unshift(next);
  await writeJournal(context, current);
  return next;
}

function sanitizeSnapshotBody(body) {
  return {
    snapshotId: String(body.snapshotId || makeId("snapshot")),
    reason: String(body.reason || "manual"),
    createdAt: body.createdAt || new Date().toISOString(),
    meta: body.meta && typeof body.meta === "object" ? body.meta : {},
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
  };
}

async function listSnapshots(context) {
  await ensureDir(context.snapshotsDir);
  const dirents = await fs.readdir(context.snapshotsDir, { withFileTypes: true });
  const rows = [];
  for (const dirent of dirents) {
    if (!dirent.isFile() || !dirent.name.endsWith(".json")) continue;
    const snapshotPath = path.join(context.snapshotsDir, dirent.name);
    const snapshot = await readJson(snapshotPath, null);
    if (!snapshot) continue;
    rows.push({
      snapshotId: snapshot.snapshotId,
      reason: snapshot.reason,
      createdAt: snapshot.createdAt,
      meta: snapshot.meta || {},
      file: path.relative(root, snapshotPath).replaceAll(path.sep, "/"),
      counts: {
        visits: Array.isArray(snapshot.payload?.visits) ? snapshot.payload.visits.length : 0,
        accounts: Array.isArray(snapshot.payload?.accounts) ? snapshot.payload.accounts.length : 0,
        deals: Array.isArray(snapshot.payload?.deals) ? snapshot.payload.deals.length : 0,
        handoffs: Array.isArray(snapshot.payload?.handoff_log) ? snapshot.payload.handoff_log.length : 0,
      },
    });
  }
  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return rows;
}

async function saveSnapshot(context, body) {
  const snapshot = sanitizeSnapshotBody(body);
  const fileName = `${snapshot.createdAt.replaceAll(/[:.]/g, "-")}-${snapshot.snapshotId}.json`;
  const filePath = path.join(context.snapshotsDir, fileName);
  await ensureDir(context.snapshotsDir);
  await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return {
    snapshotId: snapshot.snapshotId,
    createdAt: snapshot.createdAt,
    reason: snapshot.reason,
    meta: snapshot.meta,
    file: path.relative(root, filePath).replaceAll(path.sep, "/"),
  };
}

async function readSnapshot(context, snapshotId) {
  const snapshots = await listSnapshots(context);
  const match = snapshots.find((item) => item.snapshotId === snapshotId);
  if (!match) return null;
  return readJson(path.join(root, match.file), null);
}

async function summarize(context) {
  const journal = await readJournal(context);
  const snapshots = await listSnapshots(context);
  return {
    ok: true,
    app: "AE-FlowPro",
    mode: "same-folder-local-runtime",
    startedAt: context.startedAt,
    dataDir: path.relative(root, context.dataDir).replaceAll(path.sep, "/"),
    journal: {
      total: journal.length,
      latestAt: journal[0]?.createdAt || null,
      latestEntry: journal[0] || null,
    },
    snapshots: {
      total: snapshots.length,
      latestAt: snapshots[0]?.createdAt || null,
      latest: snapshots[0] || null,
    },
  };
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

export async function createAEFlowLocalRuntime(options = {}) {
  const context = {
    dataDir: path.resolve(options.dataDir || defaultDataDir),
    journalPath: path.resolve(options.journalPath || defaultJournalPath),
    snapshotsDir: path.resolve(options.snapshotsDir || defaultSnapshotsDir),
    startedAt: new Date().toISOString(),
  };

  await ensureDir(context.dataDir);
  await ensureDir(context.snapshotsDir);

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

      if (req.method === "GET" && requestUrl.pathname === "/api/runtime/journal") {
        const entries = await readJournal(context);
        json(res, 200, {
          ok: true,
          total: entries.length,
          entries,
        });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/api/runtime/journal") {
        const body = await readBody(req);
        const entry = await appendJournal(context, body);
        json(res, 200, {
          ok: true,
          entry,
          status: await summarize(context),
        });
        return;
      }

      if (req.method === "DELETE" && requestUrl.pathname === "/api/runtime/journal") {
        await writeJournal(context, []);
        json(res, 200, {
          ok: true,
          cleared: true,
          status: await summarize(context),
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/runtime/snapshots") {
        const snapshots = await listSnapshots(context);
        json(res, 200, {
          ok: true,
          total: snapshots.length,
          snapshots,
        });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/api/runtime/snapshots") {
        const body = await readBody(req);
        const snapshot = await saveSnapshot(context, body);
        await appendJournal(context, {
          type: "runtime-snapshot",
          detail: `Snapshot saved: ${snapshot.reason}`,
          createdAt: snapshot.createdAt,
          meta: {
            snapshotId: snapshot.snapshotId,
            file: snapshot.file,
          },
        });
        json(res, 200, {
          ok: true,
          snapshot,
          status: await summarize(context),
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname.startsWith("/api/runtime/snapshots/")) {
        const snapshotId = decodeURIComponent(requestUrl.pathname.split("/").pop() || "");
        const snapshot = await readSnapshot(context, snapshotId);
        if (!snapshot) {
          json(res, 404, { ok: false, error: "snapshot-not-found", snapshotId });
          return;
        }
        json(res, 200, { ok: true, snapshot });
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
  const host = process.env.AE_FLOW_RUNTIME_HOST || "127.0.0.1";
  const port = Number(process.env.AE_FLOW_RUNTIME_PORT || "4187");
  const runtime = await createAEFlowLocalRuntime({
    dataDir: process.env.AE_FLOW_RUNTIME_DATA_DIR,
    journalPath: process.env.AE_FLOW_RUNTIME_JOURNAL_PATH,
    snapshotsDir: process.env.AE_FLOW_RUNTIME_SNAPSHOTS_DIR,
  });
  runtime.server.listen(port, host, () => {
    const address = runtime.server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(
      JSON.stringify({
        ok: true,
        app: "AE-FlowPro",
        mode: "same-folder-local-runtime",
        url: `http://${host}:${resolvedPort}`,
        dataDir: path.relative(root, runtime.context.dataDir).replaceAll(path.sep, "/"),
      }),
    );
  });
}
