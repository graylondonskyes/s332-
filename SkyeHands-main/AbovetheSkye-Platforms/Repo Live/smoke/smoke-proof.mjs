#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listCommandPresets, saveCommandPreset, listReports, saveRunReport } from "../runtime/repo-live-runtime.mjs";
import { runBrowserSmoke } from "./smoke-browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const html = read("index.html");
const headers = read("_headers");

assert(html.includes("Drop ZIP or Folder here"), "index.html is missing the repo drop surface");
assert(html.includes('id="pickZipBtn"'), "index.html is missing ZIP picker control");
assert(html.includes('id="pickFolderFsBtn"'), "index.html is missing File System Access picker control");
assert(html.includes('id="prepareBtn"'), "index.html is missing prepare control");
assert(html.includes('id="runBtn"'), "index.html is missing run control");
assert(html.includes('id="reportBtn"'), "index.html is missing report download control");
assert(html.includes('id="presetSelect"'), "index.html is missing saved preset control");
assert(html.includes('id="reportHistory"'), "index.html is missing local report history surface");
assert(html.includes('<script type="module">'), "index.html is missing the inline module boot script");
assert(html.includes("showDirectoryPicker"), "index.html is missing File System Access API usage");
assert(html.includes("repo-live-runtime.mjs"), "index.html is missing local runtime helper import");
assert(fs.existsSync(path.join(root, "smoke/smoke-browser.mjs")), "Missing browser smoke: smoke/smoke-browser.mjs");

assert(headers.includes("Cross-Origin-Embedder-Policy: require-corp"), "_headers is missing COEP");
assert(headers.includes("Cross-Origin-Opener-Policy: same-origin"), "_headers is missing COOP");

const mem = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  removeItem(key) { this.data.delete(key); },
};
saveCommandPreset(mem, { label: "Typecheck", command: "npm run typecheck --if-present", subdir: "apps/api" });
saveRunReport(mem, { sourceName: "sample", command: "npm test", ok: true, exitCode: 0, log: "PASS 1", endedAt: new Date().toISOString() });
assert(listCommandPresets(mem).length === 1, "runtime preset helper did not persist a preset");
assert(listReports(mem).length === 1, "runtime report helper did not persist a report");

const browserProof = await runBrowserSmoke();
assert(browserProof.ok === true || browserProof.skipped === true, "Repo Live browser smoke did not report ok or an honest skip");

console.log(JSON.stringify({
  ok: true,
  app: "Repo Live",
  surface: "browser-side repo test shell with persisted command presets and local run-report history",
  verified: [
    "index.html exposes the ZIP/folder load surface and run/report controls",
    "inline module boot logic is present",
    "runtime helper persists command presets and run reports",
    "COOP/COEP headers required by the stated browser runtime are present",
    ...(browserProof.ok ? ["browser preset and local report-history surfaces render and persist in a live page"] : []),
    ...(browserProof.skipped ? [`browser smoke skipped honestly: ${browserProof.reason}`] : []),
  ],
  browser_proof: browserProof,
  not_proven: [
    "actual browser WebContainer boot",
    "actual package install or command execution in a live session",
  ],
}, null, 2));
