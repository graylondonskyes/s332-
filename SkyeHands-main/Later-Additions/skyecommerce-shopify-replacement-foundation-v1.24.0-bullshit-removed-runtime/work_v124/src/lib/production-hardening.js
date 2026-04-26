const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'production', 'prod']);
const LIVE_PAYMENT_PROVIDERS = new Set(['stripe', 'paypal']);
const LIVE_CARRIER_PROVIDERS = new Set(['ups']);
const LIVE_CHANNEL_TYPES = new Set(['google_merchant', 'meta_catalog', 'tiktok_catalog']);

function text(value = '') {
  return String(value ?? '').trim();
}

function bool(value) {
  return TRUE_VALUES.has(text(value).toLowerCase());
}

export function productionEnforcementEnabled(env = {}) {
  return bool(env.COMMERCE_PRODUCTION_ENFORCEMENT) || bool(env.PRODUCTION_ENFORCEMENT);
}

function pass() {
  return { ok: true, code: '', message: '', blockers: [] };
}

function block(code, message, blockers = []) {
  return { ok: false, code, message, blockers: blockers.length ? blockers : [code] };
}

export function enforceProviderPreviewPolicy() {
  return block(
    'PROVIDER_PREVIEW_REMOVED',
    'Provider preview/spec generation has been removed from the production package. Use provider validation or live dispatch.',
    ['provider_preview_removed']
  );
}

export function enforcePaymentProviderPolicy(provider = '') {
  const normalized = text(provider).toLowerCase();
  if (LIVE_PAYMENT_PROVIDERS.has(normalized)) return pass();
  return block(
    'LIVE_PAYMENT_PROVIDER_REQUIRED',
    'Payment sessions require live Stripe or PayPal provider execution. Cash, manual, and non-live payment providers are not accepted in this package.',
    ['live_payment_provider_required']
  );
}

export function enforceCarrierProviderPolicy(provider = '') {
  const normalized = text(provider).toLowerCase();
  if (LIVE_CARRIER_PROVIDERS.has(normalized)) return pass();
  return block(
    'LIVE_CARRIER_PROVIDER_REQUIRED',
    'Carrier quotes and label purchase require a live UPS provider connection. Manual and non-live carrier providers are not accepted in this package.',
    ['live_carrier_provider_required']
  );
}

export function enforceChannelProviderPolicy(channelType = '') {
  const normalized = text(channelType).toLowerCase();
  if (LIVE_CHANNEL_TYPES.has(normalized)) return pass();
  return block(
    'LIVE_CHANNEL_PROVIDER_REQUIRED',
    'Sales channel sync requires Google Merchant, Meta Catalog, or TikTok Catalog provider execution. Feed-only channel types are not accepted in this package.',
    ['live_channel_provider_required']
  );
}

export function productionRuntimeReadiness(env = {}) {
  const enforced = productionEnforcementEnabled(env);
  const blockers = [];
  const envText = (name) => text(env[name]);

  if (!enforced) blockers.push('production_enforcement_disabled');
  if (!envText('SESSION_SECRET')) blockers.push('session_secret_missing');
  if (!envText('PROVIDER_CONFIG_ENCRYPTION_KEY')) blockers.push('provider_config_encryption_key_missing');
  if (envText('CSRF_ENFORCEMENT').toLowerCase() === 'false') blockers.push('csrf_enforcement_disabled');
  if (bool(env.CORS_ALLOW_ALL)) blockers.push('cors_allow_all_enabled');
  if (!envText('CORS_ALLOWED_ORIGINS') && !bool(env.CORS_ALLOW_ALL)) blockers.push('cors_allowed_origins_missing');
  if (envText('FULFILLMENT_SYNC_URL') && !envText('FULFILLMENT_SYNC_SECRET')) blockers.push('fulfillment_sync_secret_missing');
  if (envText('ROUTEX_INGEST_URL') && !envText('ROUTEX_INGEST_TOKEN')) blockers.push('routex_ingest_token_missing');

  return {
    ok: blockers.length === 0,
    enforced,
    blockers,
    warnings: [],
    controls: {
      providerPreviewRemoved: true,
      paymentProviders: [...LIVE_PAYMENT_PROVIDERS],
      carrierProviders: [...LIVE_CARRIER_PROVIDERS],
      channelProviders: [...LIVE_CHANNEL_TYPES],
      refundSimulationRemoved: true,
      liveDnsDomainVerification: true,
      fulfillmentSyncRequiresHttpsSignedPost: true,
      routexHandoffRequiresLiveIngest: true,
      donorVisualIngestFetchesSourceUrl: true,
      productDetailStorefrontRoutes: true
    }
  };
}
