import assert from 'node:assert/strict';
import { buildChannelCatalogExport, buildChannelSyncDispatch, normalizeSalesChannelInput } from '../src/lib/channels.js';
import { normalizeCarrierProfileInput, normalizeLabelPurchaseInput, normalizeRateRequest, purchaseShippingLabel } from '../src/lib/carriers.js';
import { normalizeInvoicePaymentSessionInput } from '../src/lib/dunning.js';
import { buildHostedPaymentSession, normalizePaymentSessionInput, normalizePaymentWebhookInput, applyPaymentWebhook } from '../src/lib/payments.js';
import { buildCarrierLabelGatewayRequest, buildCarrierRateGatewayRequest, buildPaymentGatewayRequest } from '../src/lib/provider-adapters.js';
import { executeNativeProviderDispatch, executeProviderCarrierRates } from '../src/lib/provider-runtime.js';
import { enforceCarrierProviderPolicy, enforceChannelProviderPolicy, enforcePaymentProviderPolicy, enforceProviderPreviewPolicy, productionRuntimeReadiness } from '../src/lib/production-hardening.js';
import { summarizeProviderSmoke, validateCarrierProviderSmoke, validateNativeGatewaySpec, validatePaymentProviderSmoke } from '../src/lib/provider-smoke.js';

const env = {
  COMMERCE_PRODUCTION_ENFORCEMENT: 'true',
  SESSION_SECRET: 'production-readiness-session-secret',
  PROVIDER_CONFIG_ENCRYPTION_KEY: 'production-readiness-provider-config-key',
  CORS_ALLOWED_ORIGINS: 'https://merchant.example.com',
  STRIPE_SECRET_KEY: 'sk_live_shape',
  STRIPE_WEBHOOK_SECRET: 'whsec_live_shape',
  PAYPAL_CLIENT_ID: 'paypal_client',
  PAYPAL_CLIENT_SECRET: 'paypal_secret',
  PAYPAL_WEBHOOK_ID: 'paypal_webhook',
  UPS_CLIENT_ID: 'ups_client',
  UPS_CLIENT_SECRET: 'ups_secret',
  UPS_ACCOUNT_NUMBER: 'A12345'
};

const readiness = productionRuntimeReadiness(env);
assert.equal(readiness.ok, true);
assert.equal(enforceProviderPreviewPolicy().code, 'PROVIDER_PREVIEW_REMOVED');
assert.equal(enforcePaymentProviderPolicy('stripe').ok, true);
assert.equal(enforcePaymentProviderPolicy('cash').ok, false);
assert.equal(enforceCarrierProviderPolicy('ups').ok, true);
assert.equal(enforceCarrierProviderPolicy('manual').ok, false);
assert.equal(enforceChannelProviderPolicy('google_merchant').ok, true);
assert.equal(enforceChannelProviderPolicy('file_export').ok, false);

const paymentInput = normalizePaymentSessionInput({ provider: 'stripe' }, { totalCents: 4200, currency: 'usd' });
assert.equal(paymentInput.provider, 'stripe');
const checkoutSession = buildHostedPaymentSession({ transactionId: 'pay_live_shape', checkoutToken: 'chk_live_shape', provider: 'stripe', amountCents: paymentInput.amountCents, currency: paymentInput.currency, merchantSlug: 'merchant-store', orderNumber: 'SKY-1001', externalCheckoutUrl: 'https://checkout.stripe.com/c/pay_live_shape' });
assert.equal(checkoutSession.external, true);
const webhook = normalizePaymentWebhookInput({ provider: 'stripe', checkoutToken: checkoutSession.checkoutToken, status: 'paid', amountCents: paymentInput.amountCents, providerReference: 'pi_live_shape' });
assert.equal(applyPaymentWebhook({ provider: 'stripe', status: 'pending', amount_cents: paymentInput.amountCents, currency: 'USD' }, webhook).orderPaymentStatus, 'paid');

const invoiceInput = normalizeInvoicePaymentSessionInput({ provider: 'paypal', amountCents: 4900 }, { amountCents: 4900, currency: 'USD' });
assert.equal(invoiceInput.provider, 'paypal');

const channel = normalizeSalesChannelInput({ name: 'Google Merchant', type: 'google_merchant', destinationUrl: 'https://shoppingcontent.googleapis.com', format: 'json' });
const exportPayload = buildChannelCatalogExport({ merchant: { id: 'm1', slug: 'merchant-store', brandName: 'Merchant Store' }, channel, products: [{ id: 'p1', slug: 'prod', title: 'Product', priceCents: 1299, inventoryOnHand: 4 }] });
assert.equal(exportPayload.counts.products, 1);
assert.equal(buildChannelSyncDispatch({ id: 'chn_1', type: channel.type, format: channel.format, destination_url: channel.destinationUrl }, exportPayload).status, 'dispatched');

const carrierProfile = normalizeCarrierProfileInput({ name: 'UPS Main', provider: 'ups' });
assert.equal(carrierProfile.provider, 'ups');
const rateRequest = normalizeRateRequest({ packages: [{ weightOz: 32, lengthIn: 10, widthIn: 8, heightIn: 4 }], shippingAddress: { countryCode: 'US', stateCode: 'AZ', postalCode: '85001' } }, {});
const rateSpec = buildCarrierRateGatewayRequest({ provider: 'ups', environment: 'production', config: { accountNumber: 'A12345' } }, rateRequest, { orderNumber: 'SKY-1001' });
const labelSpec = buildCarrierLabelGatewayRequest({ provider: 'ups', environment: 'production', config: { accountNumber: 'A12345' } }, { serviceCode: 'ground', packages: rateRequest.packages }, { orderNumber: 'SKY-1001', shippingAddress: rateRequest.shippingAddress });
assert.equal(validateNativeGatewaySpec(rateSpec).pass, true);
assert.equal(validateNativeGatewaySpec(labelSpec).pass, true);
assert.equal(validateNativeGatewaySpec(buildPaymentGatewayRequest({ provider: 'stripe', environment: 'production' }, { amountCents: 4200, currency: 'USD' }, { orderNumber: 'SKY-1001', origin: 'https://merchant.example.com' })).pass, true);

const scriptedFetcher = async (url) => {
  if (url.includes('/security/v1/oauth/token')) return new Response(JSON.stringify({ access_token: 'ups_access' }), { status: 200 });
  if (url.includes('/api/rating/')) return new Response(JSON.stringify({ RateResponse: { RatedShipment: [{ Service: { Code: '03', Description: 'Ground' }, TotalCharges: { MonetaryValue: '12.34', CurrencyCode: 'USD' } }] } }), { status: 200 });
  if (url.includes('/api/shipments/')) return new Response(JSON.stringify({ ShipmentResponse: { ShipmentResults: { ShipmentIdentificationNumber: '1ZLIVE123', PackageResults: { TrackingNumber: '1ZLIVE123', ShippingLabel: { GraphicImage: 'JVBERi0x' } } } } }), { status: 200 });
  if (url.includes('/v1/checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_live_shape', url: 'https://checkout.stripe.com/c/cs_live_shape' }), { status: 200 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
const rateExecution = await executeProviderCarrierRates({ provider: 'ups', environment: 'production', config: { accountNumber: 'A12345' } }, { rateRequest, context: { orderNumber: 'SKY-1001', currency: 'USD' } }, env, { fetcher: scriptedFetcher });
assert.equal(rateExecution.status, 'executed');
assert.equal(rateExecution.rates.length, 1);
const labelExecution = await executeNativeProviderDispatch({ provider: 'ups', environment: 'production', config: { accountNumber: 'A12345' } }, { label: { serviceCode: rateExecution.rates[0].serviceCode, packages: rateRequest.packages }, context: { orderNumber: 'SKY-1001', shippingAddress: rateRequest.shippingAddress } }, env, { fetcher: scriptedFetcher });
const label = purchaseShippingLabel({ profile: carrierProfile, order: { currency: 'USD' }, input: normalizeLabelPurchaseInput({ serviceCode: rateExecution.rates[0].serviceCode }, {}), selectedRate: rateExecution.rates[0], providerDispatch: labelExecution });
assert.equal(label.status, 'purchased');

const paymentProviderSummary = summarizeProviderSmoke([
  validatePaymentProviderSmoke({ session: checkoutSession, webhook, transaction: { provider: 'stripe', amountCents: 4200 } }),
  validateCarrierProviderSmoke({ profile: { provider: 'ups' }, quoteRequest: rateRequest, quotes: rateExecution.rates, label })
]);
assert.equal(paymentProviderSummary.pass, true);

console.log(JSON.stringify({ ok: true, tests: ['production-readiness', 'runtime-overrides-removed', 'provider-policies', 'payment-session', 'channel-export', 'ups-rate-label', 'provider-smoke'] }, null, 2));
