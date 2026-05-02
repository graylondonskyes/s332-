const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const BRAND_PROVIDER = 'SKYES OVER LONDON';
const BRAND_MODEL = 'kAIxU';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
const FAILOVER_URL = process.env.KAIXU_FAILOVER_GATEWAY_URL || process.env.KAIXU_GATEWAY_URL || '';
const FAILOVER_TOKEN = process.env.KAIXU_FAILOVER_GATEWAY_TOKEN || process.env.KAIXU_GATEWAY_TOKEN || '';

export const KAIXU_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function brandSystemPrompt() {
  return [
    'You are kAIxU, the AI system operated by Skyes Over London.',
    'Never mention OpenAI, Anthropic, Gemini, Google, Claude, model vendors, or provider implementation details.',
    'If asked what you are or who powers you, say: "I am kAIxU by Skyes Over London."',
    'Keep branding consistent: provider = SKYES OVER LONDON, AI name = kAIxU.',
    'This product is part of the s0l26 0s Creative Environment Eco-System for this year.'
  ].join(' ');
}

function normalizeMessages(payloadOrMessages) {
  if (Array.isArray(payloadOrMessages)) {
    const normalized = payloadOrMessages
      .filter(Boolean)
      .map((m) => ({
        role: ['system', 'developer', 'user', 'assistant', 'tool'].includes(m.role) ? m.role : 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      }))
      .filter((m) => m.content.trim().length > 0);

    return [
      { role: 'system', content: brandSystemPrompt() },
      ...normalized
    ];
  }

  const payload = payloadOrMessages || {};
  const out = [{ role: 'system', content: brandSystemPrompt() }];

  const sys = payload.systemInstruction?.parts?.map((p) => p?.text || '').join('\n').trim();
  if (sys) out.push({ role: 'developer', content: sys });

  const contents = Array.isArray(payload.contents) ? payload.contents : [];
  for (const item of contents) {
    const role = item?.role === 'model' ? 'assistant' : 'user';
    const text = Array.isArray(item?.parts) ? item.parts.map((p) => p?.text || '').join('\n').trim() : '';
    if (text) out.push({ role, content: text });
  }

  return out;
}

function extractText(data) {
  return data?.choices?.[0]?.message?.content ||
    data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('\n').trim() ||
    data?.content?.map((part) => part?.text || '').join('\n').trim() ||
    data?.output_text ||
    data?.text ||
    data?.message ||
    '';
}

function mapUsage(data) {
  const usage = data?.usage || {};
  return {
    input_tokens: usage.prompt_tokens || 0,
    output_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || 0
  };
}

function modelCandidates(payload = {}) {
  const requested = typeof payload.model === 'string' ? payload.model.trim() : '';
  const custom = requested && requested !== BRAND_MODEL ? requested : '';
  return Array.from(new Set([custom, DEFAULT_MODEL, FALLBACK_MODEL, 'gpt-4o-mini'].filter(Boolean)));
}

function shouldRetryModel(status, body) {
  const text = JSON.stringify(body || {}).toLowerCase();
  return status === 404 || (status === 400 && /(model|does not exist|not found|unsupported)/.test(text));
}

function shouldFailover(status) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(Number(status));
}

async function invokeChat(apiKey, body) {
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  return { resp, text, data };
}

export function configuredGatewayLanes() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    failover: Boolean(FAILOVER_URL),
    failover_authenticated: Boolean(FAILOVER_URL && FAILOVER_TOKEN),
    primary_model: DEFAULT_MODEL,
    fallback_model: FALLBACK_MODEL
  };
}

function fallbackHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (FAILOVER_TOKEN) headers.Authorization = `Bearer ${FAILOVER_TOKEN}`;
  return headers;
}

async function callFailoverGateway(payload = {}, reason = 'primary-unavailable') {
  if (!FAILOVER_URL) {
    const err = new Error('No kAIxU failover gateway configured');
    err.statusCode = 503;
    throw err;
  }

  const resp = await fetch(FAILOVER_URL, {
    method: 'POST',
    headers: fallbackHeaders(),
    body: JSON.stringify({
      ...payload,
      provider: BRAND_PROVIDER,
      model: BRAND_MODEL,
      upstream_reason: reason,
      messages: normalizeMessages(payload.messages ? payload.messages : payload)
    })
  });

  const text = await resp.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}

  if (!resp.ok) {
    const err = new Error(data?.error?.message || data?.error || text || `kAIxU failover HTTP ${resp.status}`);
    err.statusCode = resp.status;
    throw err;
  }

  const outputText = extractText(data);
  return {
    raw: data,
    outputText,
    usage: mapUsage(data),
    resolvedModel: data?.upstream_model || data?.model || 'kAIxU-failover',
    route: 'failover',
    brand: {
      provider: BRAND_PROVIDER,
      model: BRAND_MODEL
    }
  };
}

export async function callKaixu(payload = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return callFailoverGateway(payload, 'missing-openai-api-key');
  }

  const messages = normalizeMessages(payload.messages ? payload.messages : payload);
  let lastError = null;

  for (const model of modelCandidates(payload)) {
    const body = {
      model,
      messages,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.2,
      max_tokens: typeof payload.max_tokens === 'number' ? payload.max_tokens : undefined,
      stream: false
    };

    let response;
    try {
      response = await invokeChat(apiKey, body);
    } catch (error) {
      lastError = error;
      if (FAILOVER_URL) return callFailoverGateway(payload, `primary-fetch-error:${error.message}`);
      const err = new Error(error.message || 'kAIxU primary provider request failed');
      err.statusCode = 502;
      throw err;
    }

    const { resp, text, data } = response;

    if (!resp.ok) {
      if (shouldFailover(resp.status) && FAILOVER_URL) {
        return callFailoverGateway(payload, `primary-http-${resp.status}`);
      }
      if (shouldRetryModel(resp.status, data || text)) {
        lastError = new Error(data?.error?.message || text || `Model ${model} failed`);
        lastError.statusCode = resp.status;
        continue;
      }
      const err = new Error(data?.error?.message || text || `OpenAI HTTP ${resp.status}`);
      err.statusCode = resp.status;
      throw err;
    }

    const outputText = extractText(data);
    const usage = mapUsage(data);
    return {
      raw: data,
      outputText,
      usage,
      resolvedModel: model,
      brand: {
        provider: BRAND_PROVIDER,
        model: BRAND_MODEL
      }
    };
  }

  if (lastError) {
    if (FAILOVER_URL) return callFailoverGateway(payload, `model-fallback-exhausted:${lastError.message}`);
    throw lastError;
  }
  const err = new Error('No compatible model available for kAIxU lane');
  err.statusCode = 500;
  throw err;
}

export function jsonResponse({ outputText, usage, brand, resolvedModel }, month = null) {
  return {
    id: `kaixu_${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: brand.model,
    provider: brand.provider,
    upstream_model: resolvedModel,
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: outputText }
      }
    ],
    candidates: [
      {
        content: {
          parts: [{ text: outputText }]
        }
      }
    ],
    content: [{ text: outputText }],
    output_text: outputText,
    usage,
    month,
    meta: brand
  };
}

export function sseResponse({ outputText, usage, brand, resolvedModel }, month = null) {
  const events = [
    ['meta', { provider: brand.provider, model: brand.model, upstream_model: resolvedModel, month }],
    ['delta', { text: outputText }],
    ['done', { text: outputText, usage, provider: brand.provider, model: brand.model, upstream_model: resolvedModel, month }]
  ];
  return events.map(([event, payload]) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`).join('\n');
}
