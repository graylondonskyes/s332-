import { buildCarrierLabelGatewayRequest, buildCarrierRateGatewayRequest, buildChannelGatewayRequest, buildPaymentGatewayRequest } from '../src/lib/provider-adapters.js';
import { validateNativeGatewaySpec, summarizeProviderSmoke } from '../src/lib/provider-smoke.js';

const order = { orderNumber: 'SKY-PROVIDER-1', totalCents: 4200, currency: 'USD' };

const checks = [
  validateNativeGatewaySpec(buildPaymentGatewayRequest({ provider: 'stripe', environment: 'production' }, { amountCents: order.totalCents, currency: order.currency }, { orderNumber: order.orderNumber, origin: 'https://merchant.example.com' })),
  validateNativeGatewaySpec(buildPaymentGatewayRequest({ provider: 'paypal', environment: 'production' }, { amountCents: order.totalCents, currency: order.currency }, { orderNumber: order.orderNumber, origin: 'https://merchant.example.com' })),
  validateNativeGatewaySpec(buildCarrierRateGatewayRequest({ provider: 'ups', environment: 'production', config: { accountNumber: 'A12345' } }, { packages: [{ weightOz: 32, lengthIn: 10, widthIn: 8, heightIn: 4 }], shippingAddress: { countryCode: 'US', stateCode: 'AZ', postalCode: '85001' } }, { orderNumber: order.orderNumber })),
  validateNativeGatewaySpec(buildCarrierLabelGatewayRequest({ provider: 'ups', environment: 'production', config: { accountNumber: 'A12345' } }, { serviceCode: 'ground', packages: [{ weightOz: 32 }] }, { orderNumber: order.orderNumber, shippingAddress: { countryCode: 'US', stateCode: 'AZ', postalCode: '85001' } })),
  validateNativeGatewaySpec(buildChannelGatewayRequest({ provider: 'google_merchant', environment: 'production', config: { merchantId: '999' } }, { merchant: { currency: 'USD' }, products: [{ id: 'prd_1', title: 'Product', priceCents: 1299, inventoryOnHand: 3 }] })),
  validateNativeGatewaySpec(buildChannelGatewayRequest({ provider: 'meta_catalog', environment: 'production', config: { catalogId: 'cat_1' } }, { merchant: { currency: 'USD' }, products: [{ id: 'prd_1', title: 'Product', priceCents: 1299, inventoryOnHand: 3 }] })),
  validateNativeGatewaySpec(buildChannelGatewayRequest({ provider: 'tiktok_catalog', environment: 'production', config: { catalogId: 'cat_1' } }, { merchant: { currency: 'USD' }, products: [{ id: 'prd_1', title: 'Product', priceCents: 1299, inventoryOnHand: 3 }] }))
];

const summary = summarizeProviderSmoke(checks);
console.log(JSON.stringify(summary, null, 2));
if (!summary.pass) process.exit(1);
