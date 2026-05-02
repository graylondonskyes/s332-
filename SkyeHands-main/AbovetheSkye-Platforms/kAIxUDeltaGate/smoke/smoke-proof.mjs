import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createDeltaGateLocalRuntime } from "../runtime/local-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel, encoding = "utf8") {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(full, encoding);
}

function mustContain(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const readme = read("README.md");
const html = read("index.html");
read("kAIxu_Gateway_Implementation_Directives_2026.pdf", null);

mustContain(readme, "Netlify Drop-ready", "README deploy contract");
mustContain(readme, "local directive/test shell only", "README boundary note");
mustContain(html, "kaixu67.skyesoverlondon.workers.dev", "gateway base URL");
mustContain(html, "Launch Delta Gate Live", "launch CTA");
mustContain(html, "Local proof boundary", "boundary heading");
mustContain(html, 'id="run"', "tester run button");
mustContain(html, 'id="base"', "tester base field");
mustContain(html, 'id="token"', "tester token field");
mustContain(html, 'id="mode"', "tester mode selector");
mustContain(html, 'id="prompt"', "tester prompt field");
mustContain(html, 'id="out"', "tester output surface");
mustContain(html, 'id="previewPlan"', "local preview button");
mustContain(html, 'id="copyCurl"', "copy curl control");
mustContain(html, 'id="copyGate"', "copy gateway control");
mustContain(html, "/v1/health", "health route reference");
mustContain(html, "/v1/models", "models route reference");
mustContain(html, "/v1/generate", "generate route reference");
mustContain(html, "The preview lane is fully local", "preview lane copy");
mustContain(html, "Health check blocked (CORS?)", "browser CORS guardrail copy");
mustContain(html, "If this mentions CORS, use curl from the directive text.", "tester CORS fallback copy");
mustContain(html, "Leave the base blank when this page is served by the local proof runtime in this folder.", "same-origin proof note");
mustContain(html, "function normalizeBase(raw)", "base normalization logic");
mustContain(html, "function buildRequestPlan(base, token, mode, prompt)", "local request-plan builder");
mustContain(html, "function mkCurl(base, token, mode, prompt)", "curl helper logic");
mustContain(html, "remoteExecutionRequired: true", "request-plan boundary marker");
mustContain(html, 'byId("run").addEventListener("click"', "tester event wiring");
mustContain(html, 'byId("previewPlan").addEventListener("click"', "preview event wiring");
mustContain(html, 'type="module"', "page module logic");
mustContain(html, 'https://unpkg.com/three@0.161.0/build/three.module.js', "isolated visual module dependency");
mustContain(html, 'type="module"', "page module logic");
mustContain(html, "Local proof API online", "local proof health text");
if (!fs.existsSync(path.join(root, "runtime/local-runtime.mjs"))) {
  throw new Error("Missing runtime/local-runtime.mjs");
}
if (!fs.existsSync(path.join(root, "runtime/store.json"))) {
  throw new Error("Missing runtime/store.json");
}

const runtimeSource = read("runtime/local-runtime.mjs");
const tempRuntimePath = path.join(os.tmpdir(), `delta-gate-local-runtime-${process.pid}.mjs`);
fs.writeFileSync(tempRuntimePath, runtimeSource);
const runtimeCheck = spawnSync(process.execPath, ["--check", tempRuntimePath], { encoding: "utf8" });
fs.unlinkSync(tempRuntimePath);
if (runtimeCheck.status !== 0) {
  throw new Error(`runtime/local-runtime.mjs failed syntax check: ${runtimeCheck.stderr || runtimeCheck.stdout}`);
}

const { server } = await createDeltaGateLocalRuntime();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const port = typeof address === "object" && address ? address.port : null;
if (!port) {
  throw new Error("Delta Gate local proof runtime failed to bind to a port");
}

try {
  const rootHtml = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text());
  mustContain(rootHtml, "kAIxu Gateway", "served directive shell");

  const localHealth = await fetch(`http://127.0.0.1:${port}/v1/health`).then((response) => response.json());
  if (localHealth.ok !== true || localHealth.mode !== "self-contained-local-proof-api") {
    throw new Error("Local proof /v1/health did not return the expected payload");
  }

  const models = await fetch(`http://127.0.0.1:${port}/v1/models`).then((response) => response.json());
  if (models.ok !== true || !Array.isArray(models.models) || models.models.length < 2) {
    throw new Error("Local proof /v1/models did not return deterministic models");
  }

  const generate = await fetch(`http://127.0.0.1:${port}/v1/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: { type: "text", content: "Plan a same-origin proof request." } }),
  }).then((response) => response.json());
  if (generate.ok !== true || generate.mode !== "self-contained-local-proof-api") {
    throw new Error("Local proof /v1/generate did not return the expected payload");
  }
  if (!String(generate.text || "").includes("same-origin proof request")) {
    throw new Error("Local proof /v1/generate did not include prompt context");
  }

  const streamResponse = await fetch(`http://127.0.0.1:${port}/v1/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input: { type: "text", content: "Stream the local proof lane." } }),
  });
  const streamText = await streamResponse.text();
  mustContain(streamText, "data: [DONE]", "local proof SSE terminator");
  mustContain(streamText, "kAIxUDeltaGate local proof stream.", "local proof SSE body");

  const requests = await fetch(`http://127.0.0.1:${port}/v1/requests`).then((response) => response.json());
  if (requests.ok !== true || requests.totalRequests < 1 || requests.totalStreams < 1) {
    throw new Error("Local proof /v1/requests did not expose recorded request history");
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log(JSON.stringify({
  ok: true,
  folder: "kAIxUDeltaGate",
  status: "partial",
  proof: [
    "static-files-present",
    "gateway-reference-present",
    "local-tester-ui-present",
    "browser-tester-guardrails-present",
    "copy-and-curl-helper-contract-present",
    "local-request-planner-present",
    "self-contained-local-proof-api-present"
  ]
}, null, 2));
