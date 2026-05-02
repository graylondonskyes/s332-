import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = normalize(join(__dirname, ".."));
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 8787);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.SKYDEXIA_DEFAULT_MODEL || "qwen2.5-coder:7b";

const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8" };

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(payload, null, 2));
}
function bad(res, status, message, detail = undefined) { json(res, status, { ok:false, error:message, detail }); }

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { const err = new Error("Invalid JSON body"); err.status = 400; throw err; }
}

function chooseModel(prompt = "", requested = "") {
  if (requested && requested !== "auto") return requested;
  const p = String(prompt).toLowerCase();
  if (p.includes("summarize") || p.includes("extract") || p.includes("synopsis") || p.includes("keys")) return "phi4-mini";
  if (p.includes("general") || p.includes("chat") || p.includes("explain simply")) return "llama3.2:3b";
  if (p.includes("deep scan") || p.includes("hard debug") || p.includes("architecture audit")) return "deepseek-coder-v2:lite";
  return DEFAULT_MODEL;
}

async function ollamaGenerate({ model, prompt, system }) {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, system, stream: false })
  });
  if (!response.ok) throw new Error(`Ollama failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function listOllamaModels() {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) throw new Error(`Ollama tags failed: ${response.status}`);
  return response.json();
}

async function runScript(script, args = []) {
  return new Promise((resolve) => {
    const isNode = script.endsWith(".mjs");
    const child = spawn(isNode ? process.execPath : "bash", isNode ? [script, ...args] : [script, ...args], { cwd: ROOT, env: process.env });
    let out = "", err = "";
    child.stdout.on("data", d => out += d);
    child.stderr.on("data", d => err += d);
    child.on("close", code => {
      let parsed = null;
      try { parsed = JSON.parse(out); } catch {}
      resolve({ ok: code === 0, code, output: parsed || out, error: err || null });
    });
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const safePath = normalize(join(PUBLIC_DIR, pathname));
  if (!safePath.startsWith(PUBLIC_DIR)) return bad(res, 403, "Forbidden path");
  try {
    const s = await stat(safePath);
    if (!s.isFile()) return bad(res, 404, "Not found");
    res.writeHead(200, { "content-type": MIME[extname(safePath)] || "application/octet-stream" });
    createReadStream(safePath).pipe(res);
  } catch { bad(res, 404, "Not found"); }
}

const SYSTEM_PROMPT = `You are SkyeDexia 90GB Edition, a compact local AI brain for Skyes Over London LC.
Be direct. Do not fake success. Do not claim heavyweight model capability unless the model is installed.
Respect 90GB storage limits. Prefer practical local workflows.`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/api/health") return json(res, 200, {
      ok:true, name:"SkyeDexia AI Brain Drive — 90GB Edition", version:"0.1.0", edition:"90GB compact",
      ollama_url: OLLAMA_URL, default_model: DEFAULT_MODEL, ollama_models_path: process.env.OLLAMA_MODELS || null
    });
    if (req.method === "GET" && url.pathname === "/api/models") {
      try { return json(res, 200, { ok:true, runtime:"ollama", ...(await listOllamaModels()) }); }
      catch (err) { return bad(res, 503, "Ollama is not reachable or not started.", err.message); }
    }
    if (req.method === "GET" && url.pathname === "/api/hardware") {
      const result = await runScript(join(ROOT, "scripts", "hardware-check.mjs"), ["--json"]);
      return json(res, result.ok ? 200 : 500, result.output);
    }
    if (req.method === "GET" && url.pathname === "/api/space") {
      const result = await runScript(join(ROOT, "scripts", "drive-space-json.sh"));
      return json(res, result.ok ? 200 : 500, result.output || { ok:false, error:result.error });
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) return bad(res, 400, "Prompt is required");
      const model = chooseModel(prompt, body.model);
      const started = Date.now();
      const data = await ollamaGenerate({ model, prompt, system: SYSTEM_PROMPT });
      return json(res, 200, { ok:true, edition:"90GB", model, elapsed_ms:Date.now()-started, response:data.response || "", raw:{ total_duration:data.total_duration, load_duration:data.load_duration, eval_count:data.eval_count, eval_duration:data.eval_duration } });
    }
    if (req.method === "GET") return serveStatic(req, res);
    bad(res, 405, "Method not allowed");
  } catch (err) { bad(res, err.status || 500, err.message || "Server error"); }
});
server.listen(PORT, () => console.log(`SkyeDexia 90GB Edition running on http://localhost:${PORT}`));
