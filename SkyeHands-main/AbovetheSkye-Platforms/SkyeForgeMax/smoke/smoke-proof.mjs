#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createSkyeForgeServer } from "../runtime/local-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function checkNode(rel) {
  const sourcePath = path.join(root, rel);
  const ext = path.extname(rel) || ".js";
  const stem = path.basename(rel, ext);
  const tempPath = path.join(os.tmpdir(), `skyeforgemax-proof-${stem}-${process.pid}${ext}`);
  fs.writeFileSync(tempPath, fs.readFileSync(sourcePath, "utf8"));
  const result = spawnSync(process.execPath, ["--check", tempPath], { encoding: "utf8" });
  fs.unlinkSync(tempPath);
  assert(result.status === 0, `${rel} failed syntax check: ${result.stderr || result.stdout}`);
}

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const forgeJs = fs.readFileSync(path.join(root, "assets/forge.js"), "utf8");
const store = JSON.parse(fs.readFileSync(path.join(root, "runtime/store.json"), "utf8"));

assert(indexHtml.includes('href="./runtime/store.json"'), "index.html is missing the local runtime store link");
assert(indexHtml.includes('href="/v1/state"'), "index.html is missing the runtime route link");
assert(indexHtml.includes('data-run-e2e'), "index.html is missing the e2e trigger control");
assert(indexHtml.includes('href="./assets/forge.css"'), "index.html is missing relative stylesheet wiring");
assert(indexHtml.includes('src="./assets/forge.js"'), "index.html is missing relative script wiring");
assert(indexHtml.includes('href="/v1/local-proof/latest"'), "index.html is missing the latest local proof link");
assert(indexHtml.includes('href="/v1/proof-runs"'), "index.html is missing the proof runs link");
assert(!indexHtml.includes("skyehawk-os.js"), "index.html still depends on an external script outside this folder");
assert(forgeJs.includes("const stateUrl = '/v1/state';"), "forge.js is missing the /v1/state runtime binding");
assert(forgeJs.includes("const localStateUrl = './runtime/store.json';"), "forge.js is missing the local runtime store fallback");
assert(forgeJs.includes("const e2eUrl = '/v1/e2e/run';"), "forge.js is missing the /v1/e2e/run runtime binding");
assert(forgeJs.includes("const proofRunsUrl = '/v1/proof-runs';"), "forge.js is missing the /v1/proof-runs runtime binding");
assert(forgeJs.includes("Local snapshot mode found no /v1/e2e/run endpoint."), "forge.js is missing the local snapshot e2e guardrail");
assert(fs.existsSync(path.join(root, "runtime/local-runtime.mjs")), "runtime/local-runtime.mjs is missing");

assert(Array.isArray(store.workspaces) && store.workspaces.length >= 1, "runtime/store.json is missing workspaces");
assert(Array.isArray(store.sovereign?.providerBindings) && store.sovereign.providerBindings.length >= 1, "runtime/store.json is missing provider bindings");
assert(Array.isArray(store.auditEvents) && store.auditEvents.length >= 1, "runtime/store.json is missing audit events");
assert(Array.isArray(store.qualityGate?.runs) && store.qualityGate.runs.length >= 1, "runtime/store.json is missing quality gate runs");
assert(Array.isArray(store.valuation?.certificationRuns) && store.valuation.certificationRuns.length >= 1, "runtime/store.json is missing valuation certification runs");
assert(store.sovereign.providerBindings.every((binding) => binding.status !== "live-ready"), "runtime/store.json overstates provider bindings as live-ready");

for (const rel of [
  "assets/forge.js",
  "runtime/local-runtime.mjs",
]) {
  checkNode(rel);
}

for (const artifact of [
  "runtime/artifacts/cert_d2323cecdd9373e4.json",
  "runtime/artifacts/dash_e5d49c8f184d15d1.json",
  "runtime/artifacts/skye_c4deb76c3f129d2f.skye.json",
]) {
  assert(fs.existsSync(path.join(root, artifact)), `missing runtime artifact: ${artifact}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skyeforgemax-local-runtime-"));
const tempStorePath = path.join(tempDir, "store.json");
const tempArtifactsDir = path.join(tempDir, "artifacts");
fs.writeFileSync(tempStorePath, JSON.stringify(store, null, 2));
fs.mkdirSync(tempArtifactsDir, { recursive: true });

const { server } = await createSkyeForgeServer({
  storePath: tempStorePath,
  artifactsDir: tempArtifactsDir,
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const port = typeof address === "object" && address ? address.port : null;
assert(port, "SkyeForgeMax local runtime failed to bind to a port");

try {
  const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
  assert(health.ok === true, "local runtime /health did not return ok");
  assert(health.mode === "self-contained-local-api", "local runtime /health did not report self-contained mode");

  const rootResponse = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text());
  assert(rootResponse.includes("SkyeForgeMax"), "local runtime did not serve index.html");

  const stateResponse = await fetch(`http://127.0.0.1:${port}/v1/state`).then((response) => response.json());
  assert(stateResponse.localRuntime?.mode === "self-contained-local-api", "local runtime /v1/state did not expose local runtime metadata");
  assert(stateResponse.workspaces?.[0]?.workspaceId === store.workspaces[0]?.workspaceId, "local runtime /v1/state returned the wrong workspace");

  const runResponse = await fetch(`http://127.0.0.1:${port}/v1/e2e/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true }),
  }).then((response) => response.json());

  assert(runResponse.ok === true, "local runtime /v1/e2e/run did not return ok");
  assert(runResponse.summary?.workspaceId === store.workspaces[0]?.workspaceId, "local runtime /v1/e2e/run returned the wrong workspace summary");
  assert(runResponse.guardrails?.remoteExecutionProven === false, "local runtime /v1/e2e/run overstated remote execution");

  const updatedStore = JSON.parse(fs.readFileSync(tempStorePath, "utf8"));
  assert(updatedStore.localRuntime?.mode === "self-contained-local-api", "local runtime run did not persist local runtime metadata");
  assert(updatedStore.auditEvents.some((event) => event.action === "local.e2e.proof.completed"), "local runtime run did not append an audit event");
  assert(typeof updatedStore.localRuntime?.lastRunArtifact === "string", "local runtime run did not persist the proof artifact path");
  assert(fs.existsSync(path.join(root, updatedStore.localRuntime.lastRunArtifact)) || fs.existsSync(path.join(tempDir, path.basename(updatedStore.localRuntime.lastRunArtifact))), "local runtime run did not write a proof artifact");

  const latestProof = await fetch(`http://127.0.0.1:${port}/v1/local-proof/latest`).then((response) => response.json());
  assert(latestProof.ok === true, "local runtime /v1/local-proof/latest did not return ok");
  assert(latestProof.latestProof?.runId === runResponse.runId, "local runtime /v1/local-proof/latest returned the wrong run");

  const proofRuns = await fetch(`http://127.0.0.1:${port}/v1/proof-runs`).then((response) => response.json());
  assert(proofRuns.ok === true, "local runtime /v1/proof-runs did not return ok");
  assert(proofRuns.lastRunId === runResponse.runId, "local runtime /v1/proof-runs returned the wrong latest run");
  assert(Array.isArray(proofRuns.events) && proofRuns.events.length >= 1, "local runtime /v1/proof-runs did not expose local proof events");
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log(JSON.stringify({
  ok: true,
  app: "SkyeForgeMax",
  surface: "static command shell plus self-contained local runtime API lane",
  verified: [
    "the static shell exists and is wired to documented state/e2e endpoints",
    "the shell can fall back to a local runtime/store.json snapshot when the runtime route is absent",
    "the browser runtime script parses successfully",
    "the local runtime server serves the shell, /health, /v1/state, and latest-proof inspection from this folder only",
    "the local runtime server exposes /v1/proof-runs for local proof history inspection",
    "the local runtime /v1/e2e/run writes a local proof artifact and audit event without claiming remote execution",
    "the local runtime store includes workspaces, provider bindings, audit events, quality runs, and certification runs",
    "representative runtime artifacts exist on disk",
  ],
  not_proven: [
    "deployed runtime execution",
    "live provider credentials",
    "remote integration success",
  ],
}, null, 2));
