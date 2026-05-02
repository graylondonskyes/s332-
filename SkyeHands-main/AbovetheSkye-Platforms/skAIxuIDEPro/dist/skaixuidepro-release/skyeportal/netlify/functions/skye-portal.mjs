export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const keyRing = buildKeyRing(process.env);
  const purposes = Object.keys(keyRing).sort((a, b) => a.localeCompare(b));
  const defaultPurpose = sanitizePurpose(process.env.SKYE_DEFAULT_PURPOSE || "default") || "default";

  // GET meta (no secrets)
  if (event.httpMethod === "GET") {
    const url = new URL(event.rawUrl || "https://example.invalid/.netlify/functions/skye-portal");
    if (url.searchParams.get("meta") === "1") {
      return json(200, corsHeaders, {
        purposes: purposes.length ? purposes : ["default"],
        defaultPurpose: purposes.includes(defaultPurpose) ? defaultPurpose : (purposes[0] || "default")
      });
    }
    return json(200, corsHeaders, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, corsHeaders, { error: { message: "Use POST." } });
  }

  if (!purposes.length) {
    return json(500, corsHeaders, {
      error: {
        message:
          "No keys found. Set env vars like SKYE_KEY_DEFAULT, SKYE_KEY_AUDIO, etc. (or OPENAI_API_KEY as fallback)."
      }
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, corsHeaders, { error: { message: "Invalid JSON body." } });
  }

  const input = (body.input || "").toString().trim();
  if (!input) return json(400, corsHeaders, { error: { message: "Missing 'input'." } });

  const maxChars = Number(process.env.MAX_INPUT_CHARS || 8000);
  if (input.length > maxChars) {
    return json(413, corsHeaders, { error: { message: `Input too large. Max ${maxChars} chars.` } });
  }

  // Purpose routing (client can request a purpose, server chooses key; server never returns the key)
  const requestedPurpose = sanitizePurpose(body.purpose || "") || "";
  const purpose = pickPurpose(requestedPurpose, keyRing, defaultPurpose);
  const apiKey = keyRing[purpose];

  const model = (body.model || "").toString().trim() || process.env.OPENAI_MODEL || "gpt-5.2";

  const upstreamRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, input })
  });

  const upstreamJson = await upstreamRes.json().catch(() => ({}));

  if (!upstreamRes.ok) {
    const msg = upstreamJson?.error?.message || `OpenAI request failed (${upstreamRes.status}).`;
    return json(upstreamRes.status, corsHeaders, {
      error: { message: msg, purposeUsed: purpose }
    });
  }

  const text = extractText(upstreamJson);

  return json(200, corsHeaders, {
    text,
    purposeUsed: purpose
  });
};

function json(statusCode, corsHeaders, obj) {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}

function sanitizePurpose(p) {
  return (p || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function buildKeyRing(env) {
  const ring = {};

  // Primary pattern: SKYE_KEY_<PURPOSE>
  for (const [k, v] of Object.entries(env || {})) {
    if (!k || typeof v !== "string") continue;
    if (!k.startsWith("SKYE_KEY_")) continue;

    const rawPurpose = k.slice("SKYE_KEY_".length);
    const purpose = sanitizePurpose(rawPurpose);
    const key = v.trim();
    if (purpose && key) ring[purpose] = key;
  }

  // Fallback: OPENAI_API_KEY becomes "default" if not already set
  if (!ring.default && typeof env.OPENAI_API_KEY === "string" && env.OPENAI_API_KEY.trim()) {
    ring.default = env.OPENAI_API_KEY.trim();
  }

  return ring;
}

function pickPurpose(requested, ring, defaultPurpose) {
  if (requested && ring[requested]) return requested;
  if (ring[defaultPurpose]) return defaultPurpose;
  if (ring.default) return "default";
  // last resort: first available key
  return Object.keys(ring)[0];
}

function extractText(resp) {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text;

  const chunks = [];
  if (Array.isArray(resp?.output)) {
    for (const item of resp.output) {
      if (!item) continue;

      if (item.type === "output_text" && typeof item.text === "string") {
        chunks.push(item.text);
        continue;
      }

      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (!part) continue;
          if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
            chunks.push(part.text);
          }
        }
      }
    }
  }
  const joined = chunks.join("\n").trim();
  return joined || "(No text found in model output.)";
}
