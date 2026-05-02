import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createSkyeDexiaLocalWorker } from "../runtime/local-worker.mjs";
import { createSkyeDexiaLocalRuntime } from "../runtime/local-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(full, "utf8");
}

function mustContain(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const index = read("index.html");
const original = read("neural-space-pro.html");
const manifestText = read("RELEASE_MANIFEST.json");
const manifest = JSON.parse(manifestText);

mustContain(index, "sdx_worker_url", "saved worker URL setting");
mustContain(index, "sdx_worker_secret", "saved worker secret setting");
mustContain(index, "sessionStorage.getItem('sdx_worker_secret')", "session-scoped worker secret storage");
mustContain(index, "Secret is kept for this browser session only.", "session-only secret note");
mustContain(index, "the worker can run on the same origin", "same-origin local runtime note");
mustContain(index, "/health", "worker health route");
mustContain(index, "/status", "worker status route");
mustContain(index, "/build-website", "worker build route");
mustContain(index, "/projects", "worker project list route");
mustContain(index, "/artifacts/", "worker artifact route");
mustContain(index, "A connected worker can run the 5-step pipeline", "conservative worker build claim");
mustContain(index, "Sites reported by the connected worker", "archive worker-source claim");
mustContain(index, "three.min.js", "Three.js dependency");
mustContain(index, "canvas.getContext('2d')", "2D canvas runtime");
mustContain(index, "actorId:'neural-space-pro'", "worker build actor id");
mustContain(index, "tenantId:tenant", "worker build tenant id");
mustContain(original, "three-overlay", "original 3D overlay");
mustContain(original, "THREE.Scene()", "original Three.js scene");
mustContain(original, "status: 'WIRED'", "conservative wired platform statuses");
mustContain(original, "status: 'PLANNED'", "conservative planned platform statuses");
mustContain(manifestText, "/queue/drain", "queue drain worker route");
if (index.includes("localStorage.setItem('sdx_worker_secret')") || index.includes("localStorage.getItem('sdx_worker_secret')")) {
  throw new Error("Worker secret is still stored in localStorage");
}
if (original.includes("status: 'LIVE'") || original.includes("status: 'STAGING'") || original.includes("status: 'BUILDING'")) {
  throw new Error("Original edition still overstates platform runtime status");
}

if (manifest.product !== "SkyeDexia Neural Space Pro") {
  throw new Error(`Unexpected manifest product: ${manifest.product}`);
}
if (manifest.workerConnection?.defaultUrl !== "http://<runtime-host>:4120") {
  throw new Error("Unexpected worker default URL contract");
}
if (manifest.workerConnection?.sameOriginLocalRuntime !== true) {
  throw new Error("Missing same-origin local runtime contract");
}
if (manifest.status !== "partial") {
  throw new Error(`Unexpected manifest status: ${manifest.status}`);
}
if (manifest.proofStatus?.status !== "partial") {
  throw new Error("Missing conservative proof status metadata");
}
if (!fs.existsSync(path.join(root, "runtime/local-worker.mjs"))) {
  throw new Error("Missing runtime/local-worker.mjs");
}
if (!fs.existsSync(path.join(root, "runtime/local-runtime.mjs"))) {
  throw new Error("Missing runtime/local-runtime.mjs");
}

for (const rel of [
  "runtime/local-worker.mjs",
  "runtime/local-runtime.mjs",
]) {
  const sourcePath = path.join(root, rel);
  const tempPath = path.join(os.tmpdir(), `skydexia-proof-${path.basename(rel)}-${process.pid}.mjs`);
  fs.writeFileSync(tempPath, fs.readFileSync(sourcePath, "utf8"));
  const result = spawnSync(process.execPath, ["--check", tempPath], { encoding: "utf8" });
  fs.unlinkSync(tempPath);
  if (result.status !== 0) {
    throw new Error(`${rel} failed syntax check: ${result.stderr || result.stdout}`);
  }
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skydexia-local-worker-"));
const tempStatePath = path.join(tempDir, "local-worker-state.json");
const tempOutputDir = path.join(tempDir, "output");
const workerSecret = "proof-secret";

const { server } = await createSkyeDexiaLocalWorker({
  statePath: tempStatePath,
  outputDir: tempOutputDir,
  workerSecret,
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const port = typeof address === "object" && address ? address.port : null;
if (!port) {
  throw new Error("Local worker failed to bind to a port");
}

const workerBase = `http://127.0.0.1:${port}`;

try {
  const unauthorizedHealth = await fetch(`${workerBase}/health`);
  if (unauthorizedHealth.status !== 401) {
    throw new Error(`Expected unauthorized health check without secret, got ${unauthorizedHealth.status}`);
  }

  const headers = { "x-worker-secret": workerSecret, "content-type": "application/json" };
  const health = await fetch(`${workerBase}/health`, { headers: { "x-worker-secret": workerSecret } }).then((response) => response.json());
  if (health.ok !== true || health.mode !== "local-proof-harness") {
    throw new Error("Local worker /health did not return the expected proof-harness payload");
  }

  const emptyBuild = await fetch(`${workerBase}/build-website`, {
    method: "POST",
    headers,
    body: JSON.stringify({ brief: "" }),
  });
  if (emptyBuild.status !== 400) {
    throw new Error(`Expected brief validation failure, got ${emptyBuild.status}`);
  }

  const build = await fetch(`${workerBase}/build-website`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      brief: "Build a local proof-ready SaaS workspace for sovereign app launch operators.",
      name: "Proof Harness Workspace",
      tenantId: "ae-commandhub",
      actorId: "neural-space-pro",
    }),
  }).then((response) => response.json());

  if (build.ok !== true) {
    throw new Error("Local worker /build-website did not return ok");
  }
  if (build.workerMode !== "local-proof-harness") {
    throw new Error("Local worker /build-website did not report local-proof-harness mode");
  }
  if (build.status !== "local-proof-generated") {
    throw new Error(`Unexpected build status: ${build.status}`);
  }
  if (!Array.isArray(build.files) || build.files.length < 3) {
    throw new Error("Local worker /build-website did not return artifact files");
  }

  const status = await fetch(`${workerBase}/status`, {
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (status.ok !== true || status.totalProjects !== 1) {
    throw new Error("Local worker /status did not return the generated project");
  }
  if (status.projects[0]?.status !== "local-proof-generated") {
    throw new Error("Local worker /status overstated the generated project state");
  }

  const projects = await fetch(`${workerBase}/projects`, {
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (projects.ok !== true || projects.totalProjects !== 1) {
    throw new Error("Local worker /projects did not return the generated project list");
  }

  const projectDetail = await fetch(`${workerBase}/projects/${build.projectId}`, {
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (projectDetail.ok !== true || projectDetail.project?.id !== build.projectId) {
    throw new Error("Local worker /projects/:id did not return the generated project");
  }

  const artifact = await fetch(`${workerBase}/artifacts/${build.projectId}/project.json`, {
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (artifact.ok !== true || !String(artifact.contents || "").includes(build.projectId)) {
    throw new Error("Local worker /artifacts/:projectId/:file did not return the generated artifact");
  }

  const drain = await fetch(`${workerBase}/queue/drain`, {
    method: "POST",
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (drain.ok !== true || drain.drainedCount !== 1) {
    throw new Error("Local worker /queue/drain did not return the generated event");
  }
  if (drain.events[0]?.type !== "app.generated") {
    throw new Error("Local worker /queue/drain returned the wrong event type");
  }

  const secondDrain = await fetch(`${workerBase}/queue/drain`, {
    method: "POST",
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (secondDrain.drainedCount !== 0) {
    throw new Error("Local worker /queue/drain did not empty the queue");
  }

  const projectDir = path.join(tempOutputDir, build.projectId);
  for (const file of build.files) {
    if (!fs.existsSync(path.join(projectDir, file))) {
      throw new Error(`Missing generated local worker artifact: ${file}`);
    }
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), "skydexia-local-runtime-"));
const runtimeStatePath = path.join(runtimeDir, "local-worker-state.json");
const runtimeOutputDir = path.join(runtimeDir, "output");
const runtime = await createSkyeDexiaLocalRuntime({
  statePath: runtimeStatePath,
  outputDir: runtimeOutputDir,
  workerSecret,
  workerPort: 0,
});

await new Promise((resolve, reject) => {
  runtime.server.once("error", reject);
  runtime.server.listen(0, "127.0.0.1", resolve);
});

const runtimeAddress = runtime.server.address();
const runtimePort = typeof runtimeAddress === "object" && runtimeAddress ? runtimeAddress.port : null;
if (!runtimePort) {
  throw new Error("Local runtime failed to bind to a port");
}

try {
  const runtimeIndex = await fetch(`http://127.0.0.1:${runtimePort}/`).then((response) => response.text());
  if (!runtimeIndex.includes("SkyeDexia Neural Space Pro")) {
    throw new Error("Local runtime did not serve index.html");
  }

  const runtimeHealth = await fetch(`http://127.0.0.1:${runtimePort}/health`, {
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (runtimeHealth.ok !== true || runtimeHealth.mode !== "local-proof-harness") {
    throw new Error("Local runtime /health did not proxy the proof worker correctly");
  }

  const runtimeBuild = await fetch(`http://127.0.0.1:${runtimePort}/build-website`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: JSON.stringify({
      brief: "Build a local same-origin proof runtime for SkyeDexia.",
      name: "Same Origin Proof",
      tenantId: "ae-commandhub",
      actorId: "neural-space-pro",
    }),
  }).then((response) => response.json());
  if (runtimeBuild.ok !== true || runtimeBuild.workerMode !== "local-proof-harness") {
    throw new Error("Local runtime /build-website did not return the expected proof-harness payload");
  }

  const runtimeProjects = await fetch(`http://127.0.0.1:${runtimePort}/projects`, {
    headers: { "x-worker-secret": workerSecret },
  }).then((response) => response.json());
  if (runtimeProjects.ok !== true || runtimeProjects.totalProjects !== 1) {
    throw new Error("Local runtime /projects did not proxy the proof worker project list");
  }
} finally {
  await runtime.close();
}

console.log(JSON.stringify({
  ok: true,
  folder: "SkyeDexiaNeural",
  status: "partial",
  proof: [
    "ui-files-present",
    "worker-contract-present",
    "2d-and-3d-markers-present",
    "local-worker-harness-contract-proven",
    "same-origin local runtime proven"
  ]
}, null, 2));
