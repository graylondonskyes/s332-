/**
 * AE Provider Router — real provider dispatch with dry-run mode
 * Directive sections 5.1 and 16
 *
 * Supported providers: openai, anthropic, gemini, dry-run
 *
 * Rules:
 *   - Production mode NEVER silently falls back to dry-run
 *   - Dry-run MUST pass through the SAME dispatch function as production
 *   - Missing env vars create clear blocked states (loud failure)
 *   - Dry-run returns realistic provider-shaped responses
 */

'use strict';

const PROVIDERS = {
  openai: {
    envVar: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  },
  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-6',
  },
  gemini: {
    envVar: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-1.5-pro',
  },
};

// ─── Env checks ───────────────────────────────────────────────────────────

function checkProviderEnv(providerName) {
  const cfg = PROVIDERS[providerName];
  if (!cfg) return { available: false, reason: `Unknown provider: ${providerName}` };
  const key = process.env[cfg.envVar];
  if (!key) return { available: false, reason: `Missing env var: ${cfg.envVar}` };
  return { available: true };
}

function requireProviderEnv(providerName) {
  const check = checkProviderEnv(providerName);
  if (!check.available) {
    throw new Error(`[AE Provider Router] BLOCKED — ${check.reason}. Set the required env var or use DRY_RUN=true.`);
  }
}

// ─── Core dispatch ────────────────────────────────────────────────────────

async function dispatchCompletion({
  brainId,
  tenantId,
  provider,
  model,
  messages,
  maxTokens = 1024,
  dryRun = false,
}) {
  const isDryRun = dryRun || process.env.AE_DRY_RUN === 'true';
  const resolvedProvider = provider ?? 'anthropic';
  const cfg = PROVIDERS[resolvedProvider];

  if (!cfg) throw new Error(`Unknown provider: ${resolvedProvider}`);

  // In production mode, require env var — no silent fallback
  if (!isDryRun) {
    requireProviderEnv(resolvedProvider);
  }

  const resolvedModel = model ?? cfg.defaultModel;
  const startMs = Date.now();

  if (isDryRun) {
    return _dryRunResponse({ brainId, provider: resolvedProvider, model: resolvedModel, messages, startMs });
  }

  // Real dispatch — provider-specific
  if (resolvedProvider === 'anthropic') {
    return _anthropicDispatch({ brainId, tenantId, model: resolvedModel, messages, maxTokens, startMs });
  } else if (resolvedProvider === 'openai') {
    return _openaiDispatch({ brainId, tenantId, model: resolvedModel, messages, maxTokens, startMs });
  } else if (resolvedProvider === 'gemini') {
    return _geminiDispatch({ brainId, tenantId, model: resolvedModel, messages, maxTokens, startMs });
  }

  throw new Error(`No dispatch handler for provider: ${resolvedProvider}`);
}

// ─── Dry-run — SAME function path, realistic response shape ───────────────

function _dryRunResponse({ brainId, provider, model, messages, startMs }) {
  const lastMessage = messages?.[messages.length - 1]?.content ?? '';
  const durationMs = Date.now() - startMs;

  return {
    provider,
    model,
    brainId,
    isDryRun: true,
    content: `[DRY-RUN] Brain ${brainId} on ${provider}/${model} responding to: "${String(lastMessage).slice(0, 80)}..."`,
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    costUsd: 0,
    durationMs,
    finishReason: 'stop',
  };
}

// ─── Anthropic dispatch ───────────────────────────────────────────────────

async function _anthropicDispatch({ brainId, tenantId, model, messages, maxTokens, startMs }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? '';
  const userMessages = messages.filter(m => m.role !== 'system');

  const body = {
    model,
    max_tokens: maxTokens,
    system: systemMsg,
    messages: userMessages,
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    provider: 'anthropic',
    model,
    brainId,
    isDryRun: false,
    content: data.content?.[0]?.text ?? '',
    usage: data.usage ?? {},
    costUsd: _estimateCost('anthropic', model, data.usage),
    durationMs: Date.now() - startMs,
    finishReason: data.stop_reason ?? 'stop',
  };
}

// ─── OpenAI dispatch ──────────────────────────────────────────────────────

async function _openaiDispatch({ brainId, tenantId, model, messages, maxTokens, startMs }) {
  const apiKey = process.env.OPENAI_API_KEY;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    provider: 'openai',
    model,
    brainId,
    isDryRun: false,
    content: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage ?? {},
    costUsd: _estimateCost('openai', model, data.usage),
    durationMs: Date.now() - startMs,
    finishReason: data.choices?.[0]?.finish_reason ?? 'stop',
  };
}

// ─── Gemini dispatch ──────────────────────────────────────────────────────

async function _geminiDispatch({ brainId, tenantId, model, messages, maxTokens, startMs }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const lastUser = messages.filter(m => m.role === 'user').pop()?.content ?? '';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: lastUser }] }] }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    provider: 'gemini',
    model,
    brainId,
    isDryRun: false,
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    usage: { input_tokens: data.usageMetadata?.promptTokenCount ?? 0, output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0 },
    costUsd: 0,
    durationMs: Date.now() - startMs,
    finishReason: 'stop',
  };
}

// ─── Cost estimation ──────────────────────────────────────────────────────

function _estimateCost(provider, model, usage) {
  if (!usage) return 0;
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;

  const rates = {
    'anthropic': { 'claude-sonnet-4-6': [0.000003, 0.000015] },
    'openai': { 'gpt-4o': [0.0000025, 0.00001] },
  };

  const r = rates[provider]?.[model];
  if (!r) return 0;
  return (inputTokens * r[0]) + (outputTokens * r[1]);
}

module.exports = {
  dispatchCompletion,
  checkProviderEnv,
  requireProviderEnv,
  PROVIDERS,
};
