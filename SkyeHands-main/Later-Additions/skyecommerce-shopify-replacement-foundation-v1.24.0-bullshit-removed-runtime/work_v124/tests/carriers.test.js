import test from 'node:test';
import assert from 'node:assert/strict';
import { carrierProfileRecord, normalizeCarrierProfileInput, normalizeLabelPurchaseInput, normalizeRateRequest, purchaseShippingLabel, quoteCarrierRates, shippingLabelRecord } from '../src/lib/carriers.js';

test('normalizeCarrierProfileInput accepts only UPS and services', () => {
  const payload = normalizeCarrierProfileInput({
    name: 'UPS Main',
    provider: 'UPS',
    services: JSON.stringify([{ code: 'ground', label: 'Ground', baseCents: 900, perPoundCents: 50, estimatedDays: 5 }])
  });
  assert.equal(payload.provider, 'ups');
  assert.equal(payload.services[0].code, 'ground');
  const mapped = carrierProfileRecord({ id: 'car_1', merchant_id: 'm1', name: 'UPS Main', provider: 'ups', services_json: JSON.stringify(payload.services), enabled: 1 });
  assert.equal(mapped.services.length, 1);
});

test('quoteCarrierRates keeps merchant-rate tables separate from label purchase', () => {
  const profile = { id: 'car_1', provider: 'ups', services: [{ code: 'ground', label: 'Ground', baseCents: 1200, perPoundCents: 80, estimatedDays: 2 }] };
  const order = { currency: 'USD', items: [{ quantity: 2 }] };
  const rateRequest = normalizeRateRequest({ packages: [{ weightOz: 32, lengthIn: 10, widthIn: 8, heightIn: 4 }] }, order);
  const quotes = quoteCarrierRates(profile, rateRequest, order);
  assert.equal(quotes.length, 1);
  const input = normalizeLabelPurchaseInput({ serviceCode: 'ground' }, order);
  const providerDispatch = { trackingNumber: '1ZPROD123', labelUrl: 'data:application/pdf;base64,UEs=', status: 'executed' };
  const label = purchaseShippingLabel({ profile, order, input, selectedRate: quotes[0], providerDispatch });
  assert.equal(label.provider, 'ups');
  assert.equal(label.trackingNumber, '1ZPROD123');
  assert.equal(label.status, 'purchased');
  const mapped = shippingLabelRecord({ id: 'lbl_1', merchant_id: 'm1', order_id: 'o1', provider: label.provider, service_code: 'ground', tracking_number: label.trackingNumber, tracking_url: label.trackingUrl, label_url: label.labelUrl, rate_cents: label.rateCents, status: label.status, meta_json: JSON.stringify(label.meta) });
  assert.equal(mapped.meta.provider, 'ups');
});
