#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcherRoot = path.join(root, "AE-Central-Command-Pack-CredentialHub-Launcher");
const defaultDataDir = path.join(root, "runtime", "data");
const defaultAuditDir = path.join(defaultDataDir, "audit-snapshots");
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
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
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
    id: String(entry.id || makeId("auditlog")),
    type: String(entry.type || "event"),
    detail: String(entry.detail || ""),
    createdAt: entry.createdAt || new Date().toISOString(),
    meta: entry.meta && typeof entry.meta === "object" ? entry.meta : {},
  });
  await writeJson(context.journalPath, current.slice(0, 160));
}

function sanitizeAuditSnapshot(body) {
  const audit = body && typeof body.audit === "object" ? body.audit : body;
  const totals = audit && typeof audit.totals === "object" ? audit.totals : {};
  const localSecurity = audit && typeof audit.localSecurity === "object" ? audit.localSecurity : {};
  return {
    snapshotId: String(audit.snapshotId || makeId("audit")),
    generatedAt: audit.generatedAt || new Date().toISOString(),
    currentPage: String(audit.currentPage || "dashboard"),
    totals: {
      contacts: Number(totals.contacts || 0),
      credentials: Number(totals.credentials || 0),
      projects: Number(totals.projects || 0),
      notes: Number(totals.notes || 0),
      internalRoutes: Number(totals.internalRoutes || 0),
      bundledApps: Number(totals.bundledApps || 0),
    },
    localSecurity: {
      lockEnabled: Boolean(localSecurity.lockEnabled),
      serviceWorkerCapable: Boolean(localSecurity.serviceWorkerCapable),
      browserOnline: Boolean(localSecurity.browserOnline),
    },
    routes: Array.isArray(audit.routes) ? audit.routes : [],
    bundledApps: Array.isArray(audit.bundledApps) ? audit.bundledApps : [],
  };
}

async function saveAuditSnapshot(context, body) {
  const snapshot = sanitizeAuditSnapshot(body);
  const fileName = `${snapshot.generatedAt.replaceAll(/[:.]/g, "-")}-${snapshot.snapshotId}.json`;
  const filePath = path.join(context.auditDir, fileName);
  await ensureDir(context.auditDir);
  await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return {
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    currentPage: snapshot.currentPage,
    totals: snapshot.totals,
    file: path.relative(root, filePath).replaceAll(path.sep, "/"),
  };
}

async function listAuditSnapshots(context) {
  await ensureDir(context.auditDir);
  const dirents = await fs.readdir(context.auditDir, { withFileTypes: true });
  const snapshots = [];
  for (const dirent of dirents) {
    if (!dirent.isFile() || !dirent.name.endsWith(".json")) continue;
    const fullPath = path.join(context.auditDir, dirent.name);
    const item = await readJson(fullPath, null);
    if (!item) continue;
    snapshots.push({
      snapshotId: item.snapshotId,
      generatedAt: item.generatedAt,
      currentPage: item.currentPage,
      totals: item.totals || {},
      file: path.relative(root, fullPath).replaceAll(path.sep, "/"),
    });
  }
  snapshots.sort((a, b) => String(b.generatedAt || "").localeCompare(String(a.generatedAt || "")));
  return snapshots;
}

async function readAuditSnapshot(context, snapshotId) {
  const snapshots = await listAuditSnapshots(context);
  const match = snapshots.find((item) => item.snapshotId === snapshotId);
  if (!match) return null;
  return readJson(path.join(root, match.file), null);
}

async function summarize(context) {
  const journal = await readJournal(context);
  const snapshots = await listAuditSnapshots(context);
  return {
    ok: true,
    app: "AE-Central-CommandHub",
    mode: "same-folder-local-runtime",
    launcherRoot: path.relative(root, launcherRoot).replaceAll(path.sep, "/"),
    startedAt: context.startedAt,
    audits: {
      total: snapshots.length,
      latestAt: snapshots[0]?.generatedAt || null,
      latest: snapshots[0] || null,
    },
    journal: {
      total: journal.length,
      latestAt: journal[0]?.createdAt || null,
      latestEntry: journal[0] || null,
    },
  };
}

function resolveStaticPath(urlPath) {
  const requestPath = urlPath === "/"
    ? "/AE-Central-Command-Pack-CredentialHub-Launcher/index.html"
    : urlPath;
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

export async function createAECentralCommandHubLocalRuntime(options = {}) {
  const context = {
    dataDir: path.resolve(options.dataDir || defaultDataDir),
    auditDir: path.resolve(options.auditDir || defaultAuditDir),
    journalPath: path.resolve(options.journalPath || defaultJournalPath),
    startedAt: new Date().toISOString(),
  };

  await ensureDir(context.dataDir);
  await ensureDir(context.auditDir);

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

      if (req.method === "GET" && requestUrl.pathname === "/api/runtime/audit-snapshots") {
        const snapshots = await listAuditSnapshots(context);
        json(res, 200, { ok: true, total: snapshots.length, snapshots });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/api/runtime/audit-snapshots") {
        const body = await readBody(req);
        const snapshot = await saveAuditSnapshot(context, body);
        await appendJournal(context, {
          type: "workspace-audit-snapshot",
          detail: `Saved audit snapshot for ${snapshot.currentPage}`,
          createdAt: snapshot.generatedAt,
          meta: {
            snapshotId: snapshot.snapshotId,
            file: snapshot.file,
            totals: snapshot.totals,
          },
        });
        json(res, 200, { ok: true, snapshot, status: await summarize(context) });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname.startsWith("/api/runtime/audit-snapshots/")) {
        const snapshotId = decodeURIComponent(requestUrl.pathname.split("/").pop() || "");
        const snapshot = await readAuditSnapshot(context, snapshotId);
        if (!snapshot) {
          json(res, 404, { ok: false, error: "audit-snapshot-not-found", snapshotId });
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
  const host = process.env.AE_CENTRAL_RUNTIME_HOST || "127.0.0.1";
  const port = Number(process.env.AE_CENTRAL_RUNTIME_PORT || "4191");
  const runtime = await createAECentralCommandHubLocalRuntime({
    dataDir: process.env.AE_CENTRAL_RUNTIME_DATA_DIR,
    auditDir: process.env.AE_CENTRAL_RUNTIME_AUDIT_DIR,
    journalPath: process.env.AE_CENTRAL_RUNTIME_JOURNAL_PATH,
  });
  runtime.server.listen(port, host, () => {
    const address = runtime.server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(JSON.stringify({
      ok: true,
      app: "AE-Central-CommandHub",
      mode: "same-folder-local-runtime",
      url: `http://${host}:${resolvedPort}`,
      dataDir: path.relative(root, runtime.context.dataDir).replaceAll(path.sep, "/"),
    }));
  });
}
