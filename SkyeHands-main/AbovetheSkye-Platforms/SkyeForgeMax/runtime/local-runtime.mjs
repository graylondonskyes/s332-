#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultStorePath = path.join(root, "runtime/store.json");
const defaultArtifactsDir = path.join(root, "runtime/artifacts");

function latest(list) {
  return Array.isArray(list) && list.length ? list[list.length - 1] : null;
}

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
    default:
      return "application/octet-stream";
  }
}

async function readStore(storePath) {
  return JSON.parse(await fs.readFile(storePath, "utf8"));
}

async function writeStore(storePath, store) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function summarizeStore(store) {
  const workspace = latest(store.workspaces) || {};
  const quality = latest(store.qualityGate?.runs);
  const cert = latest(store.valuation?.certificationRuns);
  const bindings = store.sovereign?.providerBindings || [];
  const blockingBindings = bindings.filter((binding) => binding.status !== "live-ready");

  return {
    workspaceId: workspace.workspaceId || null,
    workspaceName: workspace.name || "SkyeForgeMax Workspace",
    donorCount: Array.isArray(workspace.donorPlatformIds) ? workspace.donorPlatformIds.length : 0,
    scannedDonorCount: quality?.scannedDonorCount || 0,
    totalFindings: quality?.totalFindings || 0,
    assetCount: cert?.summary?.assetCount || 0,
    portfolioCertification: cert?.summary?.portfolioCertification || "Pending",
    blockingBindings: blockingBindings.map((binding) => ({
      provider: binding.provider,
      status: binding.status,
      missingVars: (binding.requiredVars || []).filter((key) => !(binding.presentVars || []).includes(key)),
    })),
  };
}

function withLocalRuntimeMetadata(store, context) {
  return {
    ...store,
    localRuntime: {
      mode: "self-contained-local-api",
      note: "Local runtime lane serves /v1/state and writes proof artifacts for local e2e runs only.",
      statePath: context.statePath,
      artifactsDir: context.artifactsDir,
      serverStartedAt: context.serverStartedAt,
      totalRuns: store.localRuntime?.totalRuns || 0,
      lastRunAt: store.localRuntime?.lastRunAt || null,
      lastRunId: store.localRuntime?.lastRunId || null,
      lastRunArtifact: store.localRuntime?.lastRunArtifact || null,
      lastRunSummary: store.localRuntime?.lastRunSummary || null,
    },
  };
}

async function runLocalE2E(context) {
  const store = await readStore(context.storePath);
  const summary = summarizeStore(store);
  const runAt = new Date().toISOString();
  const runId = makeId("locrun");
  const artifactName = `local_run_${runId}.json`;
  const artifactPath = path.join(context.artifactsDir, artifactName);
  const artifactRel = path.relative(root, artifactPath).replaceAll(path.sep, "/");
  const tenantId = latest(store.tenants)?.tenantId || null;
  const actorId = latest(store.actors)?.actorId || null;

  const artifact = {
    runId,
    runAt,
    mode: "self-contained-local-api",
    summary,
    guardrails: {
      remoteExecutionProven: false,
      liveProvidersReady: summary.blockingBindings.length === 0,
      note: "This run proves local state wiring and artifact generation only.",
    },
  };

  await fs.mkdir(context.artifactsDir, { recursive: true });
  await fs.writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  const nextStore = {
    ...store,
    updatedAt: runAt,
    localRuntime: {
      mode: "self-contained-local-api",
      note: "Local runtime lane serves /v1/state and writes proof artifacts for local e2e runs only.",
      totalRuns: (store.localRuntime?.totalRuns || 0) + 1,
      lastRunAt: runAt,
      lastRunId: runId,
      lastRunArtifact: artifactRel,
      lastRunSummary: summary,
    },
    auditEvents: [
      ...(store.auditEvents || []),
      {
        eventId: makeId("evt"),
        at: runAt,
        tenantId,
        actorId,
        workspaceId: summary.workspaceId,
        action: "local.e2e.proof.completed",
        entityType: "local.runtime.run",
        entityId: runId,
        detail: {
          artifactPath: artifactRel,
          totalFindings: summary.totalFindings,
          donorCount: summary.donorCount,
          blockingBindingCount: summary.blockingBindings.length,
          portfolioCertification: summary.portfolioCertification,
        },
      },
    ],
  };

  await writeStore(context.storePath, nextStore);

  return {
    ok: true,
    runId,
    runAt,
    artifactPath: artifactRel,
    summary,
    guardrails: artifact.guardrails,
    state: withLocalRuntimeMetadata(nextStore, context),
  };
}

async function readLatestLocalProof(context) {
  const store = await readStore(context.storePath);
  const artifactRel = store.localRuntime?.lastRunArtifact;
  if (!artifactRel) {
    return null;
  }
  const artifactPath = path.resolve(root, artifactRel);
  return JSON.parse(await fs.readFile(artifactPath, "utf8"));
}

async function readProofRuns(context) {
  const store = await readStore(context.storePath);
  const localRuntime = store.localRuntime || {};
  const latestProof = localRuntime.lastRunArtifact ? await readLatestLocalProof(context) : null;
  const events = (store.auditEvents || [])
    .filter((event) => event.action === "local.e2e.proof.completed")
    .slice()
    .reverse();
  return {
    totalRuns: localRuntime.totalRuns || 0,
    lastRunId: localRuntime.lastRunId || null,
    lastRunAt: localRuntime.lastRunAt || null,
    lastRunArtifact: localRuntime.lastRunArtifact || null,
    latestProof,
    events,
  };
}

function resolveStaticPath(urlPath) {
  const rawPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(root, rawPath));
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

async function serveStatic(req, res, urlPath) {
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

export async function createSkyeForgeServer(options = {}) {
  const context = {
    storePath: path.resolve(options.storePath || defaultStorePath),
    artifactsDir: path.resolve(options.artifactsDir || defaultArtifactsDir),
    statePath: path.resolve(options.storePath || defaultStorePath),
    serverStartedAt: new Date().toISOString(),
  };

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    try {
      if (req.method === "GET" && requestUrl.pathname === "/health") {
        const store = await readStore(context.storePath);
        json(res, 200, {
          ok: true,
          app: "SkyeForgeMax",
          mode: "self-contained-local-api",
          startedAt: context.serverStartedAt,
          workspaceCount: Array.isArray(store.workspaces) ? store.workspaces.length : 0,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/v1/state") {
        const store = await readStore(context.storePath);
        json(res, 200, withLocalRuntimeMetadata(store, context));
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/v1/e2e/run") {
        await readBody(req);
        json(res, 200, await runLocalE2E(context));
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/v1/local-proof/latest") {
        const latestProof = await readLatestLocalProof(context);
        if (!latestProof) {
          json(res, 404, { ok: false, error: "no-local-proof-yet" });
          return;
        }
        json(res, 200, {
          ok: true,
          mode: "self-contained-local-api",
          latestProof,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/v1/proof-runs") {
        json(res, 200, {
          ok: true,
          mode: "self-contained-local-api",
          ...(await readProofRuns(context)),
        });
        return;
      }

      await serveStatic(req, res, requestUrl.pathname);
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
  const port = Number(process.env.SKYE_FORGE_PORT || "4170");
  const host = process.env.SKYE_FORGE_HOST || "127.0.0.1";
  const { server, context } = await createSkyeForgeServer({
    storePath: process.env.SKYE_FORGE_STORE_PATH,
    artifactsDir: process.env.SKYE_FORGE_ARTIFACTS_DIR,
  });

  server.listen(port, host, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(JSON.stringify({
      ok: true,
      app: "SkyeForgeMax",
      url: `http://${host}:${resolvedPort}`,
      statePath: context.statePath,
      artifactsDir: context.artifactsDir,
      mode: "self-contained-local-api",
    }));
  });
}
