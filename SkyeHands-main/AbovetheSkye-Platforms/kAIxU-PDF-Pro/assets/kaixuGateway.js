/**
 * kAIxuGateway13 Client (server-managed lanes)
 * Routes AI calls through same-origin runtime-configured endpoints.
 * Payload: { provider, model, messages, max_tokens, temperature }
 */
(() => {
  "use strict";

  /* ── BroadcastChannel diagnostics (kAIxuGateway13 integration directive) ── */
  let diagChannel = null;
  try { diagChannel = new BroadcastChannel('kaixu_events'); } catch (_) {}

  function broadcastLog(source, payload) {
    try {
      const msg = { source, payload, app: 'kAIxU-PDF-Pro', timestamp: Date.now() };
      if (diagChannel) diagChannel.postMessage(msg);
    } catch (_) {}
  }

  const DEFAULT_RUNTIME = {
    gateway: {
      mode: "same-origin",
      managedAuth: true,
      chat: "/api/gateway-chat",
      stream: "/api/gateway-stream",
      health: "/api/health"
    },
    ui: {
      authMode: "server-managed",
      authMessage: "Server-managed lane active"
    }
  };

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function mergeRuntime(base, extra) {
    const out = { ...base };
    if (!isPlainObject(extra)) return out;
    Object.keys(extra).forEach((key) => {
      const incoming = extra[key];
      if (isPlainObject(incoming) && isPlainObject(base[key])) {
        out[key] = { ...base[key], ...incoming };
      } else {
        out[key] = incoming;
      }
    });
    return out;
  }

  function readInlineRuntimeConfig() {
    const node = document.getElementById("kaixu-runtime-config");
    if (!node) return null;
    try {
      return JSON.parse(node.textContent || "{}");
    } catch (_) {
      broadcastLog("kaixuRuntime:error", { error: "invalid_inline_runtime_config" });
      return null;
    }
  }

  const runtimeConfig = mergeRuntime(
    DEFAULT_RUNTIME,
    mergeRuntime(readInlineRuntimeConfig() || {}, window.__KAIXU_RUNTIME__ || {})
  );

  function runtimeEndpoint(name) {
    const endpoint = runtimeConfig.gateway && runtimeConfig.gateway[name];
    if (!endpoint || typeof endpoint !== "string") {
      throw { status: 500, error: `Missing runtime gateway endpoint: ${name}` };
    }
    return endpoint;
  }

  async function request(endpointName, opts) {
    const endpoint = runtimeEndpoint(endpointName);
    return fetch(endpoint, opts);
  }

  async function kaixuHealth() {
    const r = await request("health", { method: "GET" });
    return { ok: r.ok, status: r.status, text: await r.text() };
  }

  async function kaixuChat(payload) {
    broadcastLog('kaixuChat:request', { provider: payload.provider, model: payload.model });

    const r = await request("chat", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    let js = null;
    try { js = JSON.parse(text); } catch {}

    if (!r.ok) {
      const err = js || { status: r.status, body: text };
      err.status = err.status || r.status;
      broadcastLog('kaixuChat:error', { status: err.status });
      throw err;
    }
    if (!js) throw { status: r.status, error: "Invalid JSON from gateway", body: text };
    broadcastLog('kaixuChat:response', { status: r.status });
    return js;
  }

  function parseSSE(buffer) {
    const events = [];
    const parts = buffer.split("\n\n");
    const keep = parts.pop() || "";
    for (const chunk of parts) {
      const lines = chunk.split("\n").filter(Boolean);
      let event = "message";
      const dataLines = [];
      for (const ln of lines) {
        if (ln.startsWith("event:")) event = ln.slice(6).trim();
        else if (ln.startsWith("data:")) dataLines.push(ln.slice(5).trim());
      }
      events.push({ event, dataRaw: dataLines.join("\n") });
    }
    return { events, keep };
  }

  async function kaixuStreamChat(payload, { onMeta, onDelta, onDone, onError } = {}) {
    broadcastLog('kaixuStreamChat:request', { provider: payload.provider, model: payload.model });

    const r = await request("stream", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text().catch(()=> "");
      let js = null;
      try { js = JSON.parse(text); } catch {}
      const err = js || { status: r.status, body: text };
      err.status = err.status || r.status;
      broadcastLog('kaixuStreamChat:error', { status: err.status });
      if (onError) onError(err);
      throw err;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let gotDone = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const parsed = parseSSE(buf);
      buf = parsed.keep;

      for (const e of parsed.events) {
        if (!e.dataRaw) continue;

        if (e.event === "meta") {
          let m = null; try { m = JSON.parse(e.dataRaw); } catch {}
          if (m && onMeta) onMeta(m);
        }

        if (e.event === "delta") {
          let d = null; try { d = JSON.parse(e.dataRaw); } catch {}
          const t = d && typeof d.text === "string" ? d.text : "";
          if (t && onDelta) onDelta(t);
        }

        if (e.event === "done") {
          let d = null; try { d = JSON.parse(e.dataRaw); } catch {}
          gotDone = true;
          if (d && onDone) onDone(d);
        }

        if (e.event === "error") {
          let er = null; try { er = JSON.parse(e.dataRaw); } catch {}
          if (onError) onError(er || { error: e.dataRaw });
        }
      }
    }

    if (!gotDone) {
      const err = { status: 500, error: "Stream ended without done event" };
      broadcastLog('kaixuStreamChat:error', { status: 500, reason: 'no_done_event' });
      if (onError) onError(err);
      throw err;
    }

    broadcastLog('kaixuStreamChat:done', { status: 200 });
    return true;
  }

  window.kAIxuGateway13 = { runtimeConfig, kaixuHealth, kaixuChat, kaixuStreamChat };
})();
