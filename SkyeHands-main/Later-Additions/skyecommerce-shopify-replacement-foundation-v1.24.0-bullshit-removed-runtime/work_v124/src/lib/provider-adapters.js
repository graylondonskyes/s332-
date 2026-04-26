const PROVIDER_TYPES = new Set([
  'stripe',
  'paypal',
  'ups',
  'resend',
  'google_merchant',
  'meta_catalog',
  'tiktok_catalog'
]);

function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function coerceProvider(value = '') {
  const normalized = normalizedText(value).toLowerCase();
  return PROVIDER_TYPES.has(normalized) ? normalized : 'stripe';
}

function safeJson(value) {
  try {
    return typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
  } catch {
    return {};
  }
}

function coerceEnvironment() {
  return 'production';
}

export function providerConnectionRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    name: row.name || '',
    provider: coerceProvider(row.provider || 'stripe'),
    environment: coerceEnvironment(row.environment),
    accountLabel: row.account_label || row.accountLabel || '',
    endpointBase: row.endpoint_base || row.endpointBase || '',
    config: safeJson(row.config_json || row.config || {}),
    active: Boolean(Number(row.active ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeProviderConnectionInput(body = {}) {
  return {
    name: normalizedText(body.name || ''),
    provider: coerceProvider(body.provider || 'stripe'),
    environment: coerceEnvironment(body.environment),
    accountLabel: normalizedText(body.accountLabel || body.account_label || ''),
    endpointBase: normalizedText(body.endpointBase || body.endpoint_base || ''),
    config: typeof body.config === 'object' && body.config ? body.config : safeJson(body.config),
    active: boolish(body.active, true)
  };
}

export function requiredSecretsForProvider(provider = 'stripe') {
  switch (coerceProvider(provider)) {
    case 'stripe': return ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
    case 'paypal': return ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'];
    case 'ups': return ['UPS_CLIENT_ID', 'UPS_CLIENT_SECRET', 'UPS_ACCOUNT_NUMBER'];
    case 'resend': return ['RESEND_API_KEY'];
    case 'google_merchant': return ['GOOGLE_MERCHANT_ACCESS_TOKEN', 'GOOGLE_MERCHANT_ID'];
    case 'meta_catalog': return ['META_CATALOG_ACCESS_TOKEN', 'META_CATALOG_ID'];
    case 'tiktok_catalog': return ['TIKTOK_CATALOG_ACCESS_TOKEN', 'TIKTOK_CATALOG_ID'];
    default: return [];
  }
}

export function buildProviderHealthSpec(connection = {}) {
  const normalized = providerConnectionRecord(connection);
  const requiredSecrets = requiredSecretsForProvider(normalized.provider);
  const defaultBases = {
    stripe: normalized.environment === 'production' ? 'https://api.stripe.com' : 'https://api.stripe.com',
    paypal: 'https://api-m.paypal.com',
    ups: 'https://onlinetools.ups.com',
    resend: 'https://api.resend.com',
    google_merchant: 'https://shoppingcontent.googleapis.com',
    meta_catalog: 'https://graph.facebook.com',
    tiktok_catalog: 'https://business-api.tiktok.com'
  };
  const endpointBase = normalized.endpointBase || defaultBases[normalized.provider] || '';
  const urlMap = {
    stripe: `${endpointBase}/v1/account`,
    paypal: `${endpointBase}/v1/oauth2/token`,
    ups: `${endpointBase}/api/shipments/v2403/health`,
    resend: `${endpointBase}/domains`,
    google_merchant: `${endpointBase}/content/v2.1/${normalized.config.merchantId || '{merchantId}'}/accounts/authinfo`,
    meta_catalog: `${endpointBase}/v20.0/${normalized.config.catalogId || '{catalogId}'}`,
    tiktok_catalog: `${endpointBase}/open_api/v1.3/catalog/get/`
  };
  return {
    provider: normalized.provider,
    environment: normalized.environment,
    endpointBase,
    url: urlMap[normalized.provider] || endpointBase,
    method: normalized.provider === 'paypal' ? 'POST' : 'GET',
    requiredSecrets,
    headers: normalized.provider === 'paypal'
      ? { 'content-type': 'application/x-www-form-urlencoded' }
      : { accept: 'application/json' }
  };
}

function toCentsString(cents = 0) {
  return ((Number(cents || 0) || 0) / 100).toFixed(2);
}

export function buildPaymentGatewayRequest(connection = {}, payment = {}, context = {}) {
  const normalized = providerConnectionRecord(connection);
  const amountCents = Math.max(0, Number(payment.amountCents ?? context.amountCents ?? 0) || 0);
  const currency = normalizedText(payment.currency || context.currency || 'USD').toUpperCase();
  const orderNumber = normalizedText(context.orderNumber || payment.orderNumber || 'ORDER');
  const origin = normalizedText(context.origin || 'https://example.com');
  const successUrl = normalizedText(payment.returnUrl || `${origin}/payments/success?order=${encodeURIComponent(orderNumber)}`);
  const cancelUrl = normalizedText(payment.cancelUrl || `${origin}/payments/cancel?order=${encodeURIComponent(orderNumber)}`);
  const endpointBase = buildProviderHealthSpec(normalized).endpointBase;
  if (normalized.provider === 'paypal') {
    return {
      provider: normalized.provider,
      url: `${endpointBase}/v2/checkout/orders`,
      method: 'POST',
      requiredSecrets: requiredSecretsForProvider(normalized.provider),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ${PAYPAL_ACCESS_TOKEN}' },
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderNumber,
          amount: { currency_code: currency, value: toCentsString(amountCents) }
        }],
        application_context: { return_url: successUrl, cancel_url: cancelUrl }
      }
    };
  }
  return {
    provider: normalized.provider,
    url: `${endpointBase}/v1/checkout/sessions`,
    method: 'POST',
    requiredSecrets: requiredSecretsForProvider(normalized.provider),
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Bearer ${STRIPE_SECRET_KEY}' },
    body: new URLSearchParams({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'line_items[0][price_data][currency]': currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(amountCents),
      'line_items[0][price_data][product_data][name]': `Order ${orderNumber}`,
      'line_items[0][quantity]': '1'
    }).toString()
  };
}

export function buildCarrierLabelGatewayRequest(connection = {}, label = {}, context = {}) {
  const normalized = providerConnectionRecord(connection);
  const endpointBase = buildProviderHealthSpec(normalized).endpointBase;
  const shipment = {
    orderNumber: context.orderNumber || label.orderNumber || 'ORDER',
    shipTo: context.shippingAddress || {},
    packages: Array.isArray(label.packages) ? label.packages : [],
    serviceCode: normalizedText(label.serviceCode || 'ground').toUpperCase(),
    accountNumber: normalized.config.accountNumber || '${UPS_ACCOUNT_NUMBER}'
  };
  return {
    provider: normalized.provider,
    url: `${endpointBase}/api/shipments/v2403/ship`,
    method: 'POST',
    requiredSecrets: requiredSecretsForProvider(normalized.provider),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ${UPS_ACCESS_TOKEN}' },
    body: {
      ShipmentRequest: {
        Shipment: {
          Shipper: { ShipperNumber: shipment.accountNumber },
          Service: { Code: shipment.serviceCode },
          ShipTo: { Address: shipment.shipTo },
          Package: shipment.packages.map((item) => ({
            PackagingType: { Code: '02' },
            PackageWeight: { UnitOfMeasurement: { Code: 'LBS' }, Weight: String(Math.max(1, Number(item.weightLb || item.weightOz / 16 || 1))) }
          }))
        },
        LabelSpecification: { LabelImageFormat: { Code: 'GIF' } }
      }
    }
  };
}

export function buildCarrierRateGatewayRequest(connection = {}, rateRequest = {}, context = {}) {
  const normalized = providerConnectionRecord(connection);
  const endpointBase = buildProviderHealthSpec(normalized).endpointBase;
  const packages = Array.isArray(rateRequest.packages) ? rateRequest.packages : [];
  const shipTo = rateRequest.shippingAddress || context.shippingAddress || {};
  const shipFrom = normalized.config.shipperAddress || context.shipperAddress || {};
  return {
    provider: normalized.provider,
    url: `${endpointBase}/api/rating/v2403/Rate`,
    method: 'POST',
    requiredSecrets: requiredSecretsForProvider(normalized.provider),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ${UPS_ACCESS_TOKEN}' },
    body: {
      RateRequest: {
        Request: { TransactionReference: { CustomerContext: context.orderNumber || 'commerce-rate' } },
        Shipment: {
          Shipper: { ShipperNumber: normalized.config.accountNumber || '${UPS_ACCOUNT_NUMBER}', Address: shipFrom },
          ShipTo: { Address: shipTo },
          Package: packages.map((item) => ({
            PackagingType: { Code: '02' },
            Dimensions: {
              UnitOfMeasurement: { Code: 'IN' },
              Length: String(Math.max(1, Number(item.lengthIn || 1))),
              Width: String(Math.max(1, Number(item.widthIn || 1))),
              Height: String(Math.max(1, Number(item.heightIn || 1)))
            },
            PackageWeight: { UnitOfMeasurement: { Code: 'LBS' }, Weight: String(Math.max(1, Number(item.weightLb || item.weightOz / 16 || 1))) }
          }))
        }
      }
    }
  };
}

export function buildNotificationGatewayRequest(connection = {}, message = {}) {
  const normalized = providerConnectionRecord(connection);
  const endpointBase = buildProviderHealthSpec(normalized).endpointBase;
  return {
    provider: normalized.provider,
    url: `${endpointBase}/emails`,
    method: 'POST',
    requiredSecrets: requiredSecretsForProvider(normalized.provider),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ${RESEND_API_KEY}' },
    body: {
      from: normalized.config.fromEmail || 'commerce@example.com',
      to: [normalizedText(message.recipient || 'merchant@example.com')],
      subject: normalizedText(message.subject || message.templateKey || 'Commerce notification'),
      text: normalizedText(message.bodyText || 'Notification body')
    }
  };
}

export function buildChannelGatewayRequest(connection = {}, exportPayload = {}) {
  const normalized = providerConnectionRecord(connection);
  const endpointBase = buildProviderHealthSpec(normalized).endpointBase;
  const merchantId = normalized.config.merchantId || '${GOOGLE_MERCHANT_ID}';
  const catalogId = normalized.config.catalogId || '${CATALOG_ID}';
  const products = Array.isArray(exportPayload.products) ? exportPayload.products : [];
  if (normalized.provider === 'google_merchant') {
    return {
      provider: normalized.provider,
      url: `${endpointBase}/content/v2.1/${merchantId}/products/batch`,
      method: 'POST',
      requiredSecrets: requiredSecretsForProvider(normalized.provider),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ${GOOGLE_MERCHANT_ACCESS_TOKEN}' },
      body: {
        entries: products.map((item, index) => ({
          batchId: index + 1,
          merchantId,
          method: 'insert',
          product: {
            offerId: item.id || item.sku || `sku-${index + 1}`,
            title: item.title || '',
            description: item.shortDescription || '',
            price: { value: toCentsString(item.priceCents || 0), currency: exportPayload.merchant?.currency || 'USD' },
            availability: Number(item.inventoryOnHand || 0) > 0 ? 'in stock' : 'out of stock',
            imageLink: item.heroImageUrl || ''
          }
        }))
      }
    };
  }
  if (normalized.provider === 'meta_catalog') {
    return {
      provider: normalized.provider,
      url: `${endpointBase}/v20.0/${catalogId}/batch`,
      method: 'POST',
      requiredSecrets: requiredSecretsForProvider(normalized.provider),
      headers: { 'content-type': 'application/json', authorization: 'Bearer ${META_CATALOG_ACCESS_TOKEN}' },
      body: {
        requests: products.map((item) => ({
          method: 'CREATE',
          retailer_id: item.id || item.sku || '',
          data: {
            name: item.title || '',
            description: item.shortDescription || '',
            price: toCentsString(item.priceCents || 0),
            inventory: Number(item.inventoryOnHand || 0),
            image_url: item.heroImageUrl || ''
          }
        }))
      }
    };
  }
  return {
    provider: normalized.provider,
    url: `${endpointBase}/open_api/v1.3/catalog/product/upload/`,
    method: 'POST',
    requiredSecrets: requiredSecretsForProvider(normalized.provider),
    headers: { 'content-type': 'application/json', authorization: 'Bearer ${TIKTOK_CATALOG_ACCESS_TOKEN}' },
    body: {
      catalog_id: catalogId,
      products: products.map((item) => ({
        sku_id: item.id || item.sku || '',
        title: item.title || '',
        description: item.shortDescription || '',
        price: toCentsString(item.priceCents || 0),
        availability: Number(item.inventoryOnHand || 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        image_url: item.heroImageUrl || ''
      }))
    }
  };
}

export function buildNativeProviderDispatch(connection = {}, payload = {}) {
  const normalized = providerConnectionRecord(connection);
  if (['stripe', 'paypal'].includes(normalized.provider)) return buildPaymentGatewayRequest(normalized, payload.payment || payload, payload.context || {});
  if (normalized.provider === 'ups' && (payload.action === 'carrier_rate' || payload.rateRequest)) return buildCarrierRateGatewayRequest(normalized, payload.rateRequest || payload, payload.context || {});
  if (normalized.provider === 'ups') return buildCarrierLabelGatewayRequest(normalized, payload.label || payload, payload.context || {});
  if (normalized.provider === 'resend') return buildNotificationGatewayRequest(normalized, payload.message || payload);
  return buildChannelGatewayRequest(normalized, payload.exportPayload || payload);
}
