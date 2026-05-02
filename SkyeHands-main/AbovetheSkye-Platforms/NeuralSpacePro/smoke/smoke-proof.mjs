import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createNeuralSpaceProLocalGateway } from "../runtime/local-gateway.mjs";

const root = path.resolve(process.cwd());

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relPath) {
  const fullPath = path.join(root, relPath);
  assert(existsSync(fullPath), `Missing required file: ${relPath}`);
  return readFileSync(fullPath, "utf8");
}

const indexHtml = read("index.html");
const manifest = JSON.parse(read("manifest.json"));
const serviceWorker = read("sw.js");

assert(indexHtml.includes("kAIxu Neural Space Pro"), "index.html is missing the Neural Space Pro title");
assert(indexHtml.includes("serviceWorker.register('./sw.js')"), "index.html is missing service worker registration");
assert(indexHtml.includes("firebase-app.js"), "index.html is missing the Firebase app import");
assert(indexHtml.includes("signInAnonymously"), "index.html is missing anonymous auth bootstrap");
assert(indexHtml.includes("const gatewayBaseKey = 'kaixu_gateway_base';"), "index.html is missing runtime host configuration");
assert(indexHtml.includes("Leave blank to use same-origin server lanes."), "index.html is missing same-origin runtime guidance");
assert(indexHtml.includes("local proof runtime in this folder can serve the chat lane and keep a local session archive"), "index.html is missing the local proof runtime guidance");
assert(indexHtml.includes("fetch(gatewayUrl('/.netlify/functions/gateway-chat')"), "index.html is missing the gateway chat fetch path");
assert(indexHtml.includes("canvas-preview"), "index.html is missing the live run canvas surface");
assert(!indexHtml.includes("kaixu_api_key"), "index.html still contains browser-held API key storage");
assert(existsSync(path.join(root, "runtime/local-gateway.mjs")), "Missing runtime/local-gateway.mjs");
assert(existsSync(path.join(root, "runtime/local-state.json")), "Missing runtime/local-state.json");

assert(manifest.name === "kAIxu Neural Space Pro", "manifest.json has an unexpected app name");
assert(manifest.start_url === "./index.html", "manifest.json is missing the local start_url contract");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "manifest.json is missing icon metadata");
for (const icon of manifest.icons) {
  assert(typeof icon.src === "string" && icon.src.length > 0, "manifest.json contains an icon without a source");
  assert(existsSync(path.join(root, icon.src)), `manifest icon is missing on disk: ${icon.src}`);
}
assert(!("iconUrl" in manifest), "manifest.json still contains a transient iconUrl field");
assert(serviceWorker.includes("fetch"), "sw.js is missing offline fetch handling");

const runtimeSource = read("runtime/local-gateway.mjs");
const tempRuntimePath = path.join(os.tmpdir(), `neuralspacepro-local-gateway-${process.pid}.mjs`);
writeFileSync(tempRuntimePath, runtimeSource);
const runtimeCheck = spawnSync(process.execPath, ["--check", tempRuntimePath], { encoding: "utf8" });
unlinkSync(tempRuntimePath);
assert(runtimeCheck.status === 0, `runtime/local-gateway.mjs failed syntax check: ${runtimeCheck.stderr || runtimeCheck.stdout}`);

const { server } = await createNeuralSpaceProLocalGateway();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const port = typeof address === "object" && address ? address.port : null;
assert(port, "NeuralSpacePro local proof gateway failed to bind to a port");

try {
  const rootResponse = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text());
  assert(rootResponse.includes("kAIxu Neural Space Pro"), "local proof runtime did not serve index.html");

  const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
  assert(health.ok === true, "local proof runtime /health did not return ok");
  assert(health.mode === "local-proof-harness", "local proof runtime /health did not report the harness mode");

  const emptyChat = await fetch(`http://127.0.0.1:${port}/.netlify/functions/gateway-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  assert(emptyChat.status === 400, `Expected gateway-chat validation failure, got ${emptyChat.status}`);

  const chat = await fetch(`http://127.0.0.1:${port}/.netlify/functions/gateway-chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are kAIxu." },
        { role: "user", content: "Summarize the local proof lane." },
      ],
    }),
  }).then((response) => response.json());
  assert(chat.ok === true, "local proof runtime /gateway-chat did not return ok");
  assert(chat.mode === "local-proof-harness", "local proof runtime /gateway-chat did not report harness mode");
  assert(String(chat.output_text || "").includes("Summarize the local proof lane."), "local proof runtime /gateway-chat did not echo prompt context");
  assert(typeof chat.sessionId === "string" && chat.sessionId.length > 0, "local proof runtime /gateway-chat did not persist a local session id");

  const sessions = await fetch(`http://127.0.0.1:${port}/v1/sessions`).then((response) => response.json());
  assert(sessions.ok === true, "local proof runtime /v1/sessions did not return ok");
  assert(sessions.totalSessions >= 1, "local proof runtime /v1/sessions did not record the chat");
  assert(sessions.sessions.some((session) => session.sessionId === chat.sessionId), "local proof runtime /v1/sessions did not return the recorded session");
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log(JSON.stringify({
  ok: true,
  platform: "NeuralSpacePro",
  status: "partial",
  proof: [
    "Static PWA shell present",
    "Firebase-authenticated workspace shell present",
    "Gateway chat route wiring present",
    "Canvas/editor workspace surface present",
    "Settings use runtime-host configuration instead of browser-held API keys",
    "Self-contained local proof runtime serves same-origin chat, health, and local session archive lanes"
  ],
  unproven: [
    "Live gateway/provider execution is not proven in this folder",
    "External CDN dependencies are required for full runtime behavior"
  ]
}, null, 2));
