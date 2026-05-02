const crypto = require('node:crypto');
const { AE_ROSTER, buildAeSystemPrompt } = require('./ae_roster');
const { executeProviderAction, executeWithFailover, isDryRun } = require('./ae_providers');

function resolveProvider(ae) {
  const envOverride = String(process.env.AE_PRIMARY_MODEL_PROVIDER || '').toLowerCase().trim();
  return envOverride || ae.provider || 'openai';
}

function resolveFallbackProviders(ae) {
  const envOverride = String(process.env.AE_FALLBACK_MODEL_PROVIDERS || '').trim();
  if (envOverride) return envOverride.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return Array.isArray(ae.failoverProviders) ? ae.failoverProviders : ['anthropic', 'gemini'];
}

function resolveModel(ae, provider) {
  if (ae.models && ae.models[provider]) return ae.models[provider];
  return ae.model || 'gpt-4.1-mini';
}

// Extract normalized text from provider dispatch result
function extractText(result) {
  if (!result.ok) return null;
  if (result.text) return result.text;
  return null;
}

async function callAeBrain({ aeId, message, model, context = {}, env = process.env } = {}) {
  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) throw new Error('AE brain request requires a non-empty message.');

  const ae = AE_ROSTER.find((item) => item.id === aeId) || AE_ROSTER[0] || { id: 'ae-default', name: 'AE Default', keySlot: 'default', provider: 'anthropic', failoverProviders: ['openai'], models: { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4.1-mini' }, systemPrompt: 'You are a helpful account executive.' };

  const primaryProvider = resolveProvider(ae);
  const fallbacks = resolveFallbackProviders(ae).filter((p) => p !== primaryProvider);
  const resolvedModel = model || resolveModel(ae, primaryProvider);
  const systemPrompt = buildAeSystemPrompt(ae, context);

  const action = {
    model: resolvedModel,
    input: trimmedMessage,
    systemPrompt,
    maxTokens: 1024
  };

  const responseId = `ae_resp_${crypto.randomUUID()}`;

  const { ok, selectedProvider, result, attempts } = await executeWithFailover(
    primaryProvider,
    fallbacks,
    action,
    env
  );

  const text = ok ? (extractText(result) || '[no text in response]') : null;

  return {
    responseId,
    aeId: ae.id,
    aeName: ae.name,
    provider: selectedProvider || primaryProvider,
    model: resolvedModel,
    keySlot: ae.keySlot,
    generatedAt: new Date().toISOString(),
    dryRun: isDryRun(env),
    ok,
    content: ok
      ? { type: 'text', text }
      : { type: 'error', errors: attempts.flatMap((a) => a.errors) },
    usage: result?.usage || {},
    failoverAttempts: attempts
  };
}

function getMergedAeProfile(ae) {
  return ae;
}

module.exports = { callAeBrain, getMergedAeProfile };
