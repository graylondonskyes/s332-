#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultStatePath = path.join(root, "runtime/local-worker-state.json");
const defaultOutputDir = path.join(root, "runtime/output");

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
    const emptyState = { projects: [], queue: [], updatedAt: null };
    await writeState(statePath, emptyState);
    return emptyState;
  }
}

async function writeState(statePath, state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function computeQualityScore(brief) {
  const words = brief.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(72, Math.min(96, 68 + Math.min(words, 28)));
}

function unauthorized(res) {
  json(res, 401, { ok: false, error: "unauthorized" });
}

function requireSecret(req, res, workerSecret) {
  if (!workerSecret) return true;
  if (req.headers["x-worker-secret"] === workerSecret) return true;
  unauthorized(res);
  return false;
}

async function createProjectArtifacts(outputDir, project, event) {
  const artifactDir = path.join(outputDir, project.id);
  const relArtifactDir = path.relative(root, artifactDir).replaceAll(path.sep, "/");
  const files = ["project.json", "brief.md", "build-summary.json"];

  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir, "project.json"), `${JSON.stringify(project, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(artifactDir, "brief.md"), `# ${project.siteName}\n\n${project.brief}\n`, "utf8");
  await fs.writeFile(path.join(artifactDir, "build-summary.json"), `${JSON.stringify({
    workerMode: "local-proof-harness",
    generatedAt: project.generatedAt,
    projectId: project.id,
    queueEventId: event.eventId,
    note: "This local worker proves the build contract and writes local artifacts only.",
  }, null, 2)}\n`, "utf8");

  return { artifactDir, relArtifactDir, files };
}

function resolveArtifactPath(baseDir, projectId, fileName) {
  const projectDir = path.normalize(path.join(baseDir, projectId));
  const artifactPath = path.normalize(path.join(projectDir, fileName));
  if (!artifactPath.startsWith(projectDir)) return null;
  return artifactPath;
}

export async function createSkyeDexiaLocalWorker(options = {}) {
  const context = {
    statePath: path.resolve(options.statePath || defaultStatePath),
    outputDir: path.resolve(options.outputDir || defaultOutputDir),
    workerSecret: options.workerSecret ?? process.env.SKYDEXIA_WORKER_SECRET ?? "",
    startedAt: new Date().toISOString(),
  };

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    try {
      if (!requireSecret(req, res, context.workerSecret)) return;

      if (req.method === "GET" && requestUrl.pathname === "/health") {
        const state = await ensureState(context.statePath);
        const uptime = Math.floor((Date.now() - Date.parse(context.startedAt)) / 1000);
        json(res, 200, {
          ok: true,
          mode: "local-proof-harness",
          uptime,
          projectCount: state.projects.length,
          queueDepth: state.queue.length,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/status") {
        const state = await ensureState(context.statePath);
        json(res, 200, {
          ok: true,
          workerMode: "local-proof-harness",
          totalProjects: state.projects.length,
          projects: state.projects,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/projects") {
        const state = await ensureState(context.statePath);
        json(res, 200, {
          ok: true,
          workerMode: "local-proof-harness",
          totalProjects: state.projects.length,
          projects: state.projects,
        });
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/build-website") {
        const state = await ensureState(context.statePath);
        const body = await readBody(req);
        const brief = String(body.brief || "").trim();
        if (!brief) {
          json(res, 400, { ok: false, error: "brief-required" });
          return;
        }

        const generatedAt = new Date().toISOString();
        const projectId = makeId("prj");
        const siteName = String(body.name || brief.slice(0, 60)).trim() || "Untitled Site";
        const qualityScore = computeQualityScore(brief);
        const event = {
          eventId: makeId("evt"),
          type: "app.generated",
          at: generatedAt,
          projectId,
          tenantId: body.tenantId || "ae-commandhub",
          actorId: body.actorId || "neural-space-pro",
        };
        const project = {
          id: projectId,
          siteName,
          name: siteName,
          tenantId: body.tenantId || "ae-commandhub",
          actorId: body.actorId || "neural-space-pro",
          brief,
          status: "local-proof-generated",
          generatedAt,
          quality: qualityScore,
          qualityResult: { score: qualityScore },
        };
        const artifacts = await createProjectArtifacts(context.outputDir, project, event);
        const persistedProject = {
          ...project,
          artifactsDir: artifacts.relArtifactDir,
          files: artifacts.files,
          workerMode: "local-proof-harness",
        };

        const nextState = {
          projects: [...state.projects, persistedProject],
          queue: [...state.queue, { ...event, artifactsDir: artifacts.relArtifactDir }],
          updatedAt: generatedAt,
        };
        await writeState(context.statePath, nextState);

        json(res, 200, {
          ok: true,
          projectId,
          orchestratorProjectId: projectId,
          qualityScore,
          artifactsDir: artifacts.relArtifactDir,
          files: artifacts.files,
          appGeneratedEventId: event.eventId,
          status: "local-proof-generated",
          workerMode: "local-proof-harness",
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname.startsWith("/projects/")) {
        const state = await ensureState(context.statePath);
        const projectId = decodeURIComponent(requestUrl.pathname.slice("/projects/".length));
        const project = state.projects.find((entry) => entry.id === projectId);
        if (!project) {
          json(res, 404, { ok: false, error: "project-not-found", projectId });
          return;
        }
        json(res, 200, {
          ok: true,
          workerMode: "local-proof-harness",
          project,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname.startsWith("/artifacts/")) {
        const [, , projectId, ...rest] = requestUrl.pathname.split("/");
        const fileName = rest.join("/");
        if (!projectId || !fileName) {
          json(res, 400, { ok: false, error: "artifact-path-required" });
          return;
        }
        const artifactPath = resolveArtifactPath(context.outputDir, decodeURIComponent(projectId), decodeURIComponent(fileName));
        if (!artifactPath) {
          json(res, 403, { ok: false, error: "forbidden" });
          return;
        }
        try {
          const contents = await fs.readFile(artifactPath, "utf8");
          json(res, 200, {
            ok: true,
            workerMode: "local-proof-harness",
            projectId: decodeURIComponent(projectId),
            fileName: decodeURIComponent(fileName),
            contents,
          });
        } catch (error) {
          if (error.code === "ENOENT") {
            json(res, 404, { ok: false, error: "artifact-not-found", projectId, fileName });
            return;
          }
          throw error;
        }
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/queue/drain") {
        const state = await ensureState(context.statePath);
        const drained = state.queue;
        await writeState(context.statePath, {
          ...state,
          queue: [],
          updatedAt: new Date().toISOString(),
        });
        json(res, 200, {
          ok: true,
          workerMode: "local-proof-harness",
          drainedCount: drained.length,
          events: drained,
        });
        return;
      }

      json(res, 404, { ok: false, error: "not-found", path: requestUrl.pathname });
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
  const host = process.env.SKYDEXIA_WORKER_HOST || "127.0.0.1";
  const port = Number(process.env.SKYDEXIA_WORKER_PORT || "4120");
  const { server, context } = await createSkyeDexiaLocalWorker({
    statePath: process.env.SKYDEXIA_LOCAL_WORKER_STATE_PATH,
    outputDir: process.env.SKYDEXIA_LOCAL_WORKER_OUTPUT_DIR,
    workerSecret: process.env.SKYDEXIA_WORKER_SECRET,
  });

  server.listen(port, host, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(JSON.stringify({
      ok: true,
      workerMode: "local-proof-harness",
      url: `http://${host}:${resolvedPort}`,
      statePath: context.statePath,
      outputDir: context.outputDir,
      secretRequired: Boolean(context.workerSecret),
    }));
  });
}
