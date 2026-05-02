// kAIxU Gateway — React/Vite integration module
// Routes through same-origin by default and accepts runtime overrides.

const DEFAULT_FUNCTIONS_BASE = "/.netlify/functions";

function getRuntimeConfig() {
  if (typeof window === "undefined") return {};
  return window.NexusForgeRuntime || window.SMVRuntime || window.__SKYE_RUNTIME__ || {};
}

function normalizeBase(base) {
  const value = String(base || "").trim() || DEFAULT_FUNCTIONS_BASE;
  return value.replace(/\/+$/, "");
}

function resolveGatewayBase() {
  const runtime = getRuntimeConfig();
  return normalizeBase(
    (runtime.gateway && runtime.gateway.baseUrl) ||
    runtime.gatewayBase ||
    runtime.kaixuGatewayBase ||
    DEFAULT_FUNCTIONS_BASE
  );
}

function resolveGatewayUrl(path) {
  const base = resolveGatewayBase();
  const suffix = String(path || "").replace(/^\/+/, "");
  if (/^https?:\/\//i.test(base)) return `${base}/${suffix}`;
  return `${base.startsWith("/") ? base : `/${base}`}/${suffix}`;
}

export const GW_BASE = resolveGatewayBase();
export const GW_URL  = resolveGatewayUrl("gateway-chat");

export function getKey() {
  try {
    const runtime = getRuntimeConfig();
    return window.KaixuSession?.getToken?.() || runtime.kaixuAuthToken || runtime.gatewayToken || "";
  } catch {
    return "";
  }
}
export function setKey(k) {
  return k ? "server-managed" : "";
}

/**
 * Send a chat request through the kAIxU gateway.
 * @param {Array<{role:"user"|"assistant", content:string}>} messages
 * @param {{ provider?:string, model?:string, maxTokens?:number }} opts
 * @returns {Promise<string>} — the model's reply text
 */
export async function gwChat(
  messages,
  { provider='SKYES OVER LONDON', model = "kAIxU", maxTokens = 2048 } = {}
) {
  const key = getKey();
  const res = await fetch(GW_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      ...(key ? { "Authorization": `Bearer ${key}` } : {}),
    },
    credentials: "same-origin",
    body: JSON.stringify({ provider, model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gateway error HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const j = await res.json();
  const reply =
    j.choices?.[0]?.message?.content               // OpenAI shape
    ?? j.candidates?.[0]?.content?.parts?.[0]?.text // Gemini shape
    ?? j.content?.[0]?.text                         // Claude shape
    ?? null;

  if (!reply) throw new Error("Gateway returned an unexpected response shape.");
  return reply;
}

/** Quick gateway health ping — returns ms or null on failure. */
export async function gwPing() {
  try {
    const t0 = performance.now();
    await fetch(GW_URL, { method: "HEAD", credentials: "same-origin", signal: AbortSignal.timeout(5000) });
    return Math.round(performance.now() - t0);
  } catch {
    return null;
  }
}
