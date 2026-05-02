import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

for (const rel of [
  "index.html",
  "netlify/functions/kaixu-generate.js",
  "netlify/functions/client-error-report.js",
]) {
  if (!existsSync(path.join(root, rel))) {
    throw new Error(`Missing required BrandKit file: ${rel}`);
  }
}

const { handler: generate } = await import(path.join(root, "netlify/functions/kaixu-generate.js"));
const { handler: errorReport } = await import(path.join(root, "netlify/functions/client-error-report.js"));

const originalEnv = { ...process.env };

try {
  delete process.env.KAIXU_SERVER_LANE;
  delete process.env.KAIXU_API_KEY;
  delete process.env.KAIXU_GATEWAY_BASE;
  delete process.env.KAIXU_GATEWAY_ORIGIN;

  const methodNotAllowed = await generate({ httpMethod: "GET", headers: {} });
  if (methodNotAllowed.statusCode !== 405) {
    throw new Error("BrandKit generate handler no longer rejects non-POST requests.");
  }

  const missingLane = await generate({ httpMethod: "POST", headers: {}, body: JSON.stringify({ prompt: "hello" }) });
  if (missingLane.statusCode !== 500 || !String(missingLane.body).includes("KAIXU_SERVER_LANE")) {
    throw new Error("BrandKit generate handler missing-lane contract drifted.");
  }

  process.env.KAIXU_SERVER_LANE = "lane-test";
  const missingBase = await generate({ httpMethod: "POST", headers: {}, body: JSON.stringify({ prompt: "hello" }) });
  if (missingBase.statusCode !== 500 || !String(missingBase.body).includes("KAIXU_GATEWAY_BASE")) {
    throw new Error("BrandKit generate handler missing-gateway-base contract drifted.");
  }

  process.env.KAIXU_GATEWAY_BASE = "https://runtime.example.invalid";
  const missingPrompt = await generate({ httpMethod: "POST", headers: {}, body: JSON.stringify({}) });
  if (missingPrompt.statusCode !== 400 || !String(missingPrompt.body).includes("Missing prompt")) {
    throw new Error("BrandKit generate handler missing-prompt contract drifted.");
  }

  const report = await errorReport({ body: JSON.stringify({ level: "info", message: "proof" }) });
  if (report.statusCode !== 204) {
    throw new Error("client-error-report handler no longer returns 204.");
  }

  const html = readFileSync(path.join(root, "index.html"), "utf8");
  for (const needle of [
    "kAIxU Studio",
    "btnDownloadPrimary",
    "btnDownloadMark",
    "btnSaveProject",
    "projectLibrary",
    "kaixu_brandkit_projects_v1",
    "/.netlify/functions/kaixu-generate",
    "/.netlify/functions/client-error-report",
  ]) {
    if (!html.includes(needle)) {
      throw new Error(`BrandKit UI is missing expected surface marker: ${needle}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    platform: "kAIxUBrandKit",
    proof: [
      "Static export surface exists",
      "Local project library/export-import surface exists",
      "Server-side gateway function contract rejects bad requests truthfully",
      "Client error report endpoint contract exists",
    ],
    limits: [
      "Does not prove live gateway inference without deployment env",
    ],
  }, null, 2));
} finally {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}
