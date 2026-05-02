import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadGateRuntimeConfig } from "../SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/apps/skyequanta-shell/lib/gate-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const runtimeRoot = path.resolve(__dirname, "..");

async function tryFetchJson(url, token) {
  try {
    const response = await fetch(url, {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return {
      ok: response.ok,
      status: response.status,
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

const gateRuntime = loadGateRuntimeConfig(runtimeRoot, process.env);
const remoteChecks = [];

if (gateRuntime.mode === "remote-gated" && gateRuntime.gate.url) {
  const base = gateRuntime.gate.url.replace(/\/+$/, "");
  remoteChecks.push({
    name: "health",
    ...(await tryFetchJson(`${base}/.netlify/functions/health`, gateRuntime.gate.token || ""))
  });
  remoteChecks.push({
    name: "openid-configuration",
    ...(await tryFetchJson(`${base}/.well-known/openid-configuration`, gateRuntime.gate.token || ""))
  });
}

const payload = {
  runtime_root: runtimeRoot,
  mode: gateRuntime.mode,
  validation_ok: !!gateRuntime.validation?.ok,
  validation_errors: gateRuntime.validation?.errors || [],
  gate: {
    url: gateRuntime.gate?.url || null,
    url_source: gateRuntime.gate?.urlSource || null,
    token_configured: !!gateRuntime.gate?.token,
    token_source: gateRuntime.gate?.tokenSource || null,
    model: gateRuntime.gate?.model || null,
    model_source: gateRuntime.gate?.modelSource || null
  },
  remote_checks: remoteChecks
};

console.log(JSON.stringify(payload, null, 2));

if (!payload.validation_ok) {
  process.exitCode = 1;
}
