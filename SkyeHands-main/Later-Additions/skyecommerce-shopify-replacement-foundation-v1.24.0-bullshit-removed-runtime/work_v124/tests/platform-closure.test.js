import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAppSettlement,
  buildEndOfDayReconciliation,
  buildPublicCheckoutReturnUrls,
  buildPublicOrderAccessToken,
  buildRoutePlan,
  verifyPublicOrderAccessToken,
  buildTaxFilingPayload,
  executeReceiptPrinterJob,
  executeStripeTerminalPayment
} from '../src/lib/platform-closure.js';

test('public checkout URLs bind a real order to return and cancel URLs', async () => {
  const access = await buildPublicOrderAccessToken('status_secret', 'merchant-one', 'ord_123');
  const urls = buildPublicCheckoutReturnUrls('https://shop.example.com', 'merchant-one', 'ord_123', access);
  assert.match(urls.returnUrl, /checkout_status=return/);
  assert.match(urls.returnUrl, /order=ord_123/);
  assert.match(urls.returnUrl, /access=/);
  assert.match(urls.cancelUrl, /checkout_status=cancel/);
  assert.equal(await verifyPublicOrderAccessToken('status_secret', 'merchant-one', 'ord_123', access), true);
  assert.equal(await verifyPublicOrderAccessToken('status_secret', 'merchant-one', 'ord_999', access), false);
});

test('Routex route plan performs deterministic nearest-stop sequencing', () => {
  const plan = buildRoutePlan({ start: { lat: 0, lng: 0 }, stops: [{ id: 'far', lat: 10, lng: 0 }, { id: 'near', lat: 1, lng: 0 }] });
  assert.equal(plan.stopCount, 2);
  assert.equal(plan.stops[0].id, 'near');
  assert.equal(plan.stops[1].id, 'far');
});

test('Stripe Terminal execution creates a card-present intent then sends it to a reader', async () => {
  const calls = [];
  const result = await executeStripeTerminalPayment({
    stripeSecretKey: 'sk_live_terminal',
    readerId: 'tmr_123',
    amountCents: 4299,
    currency: 'USD',
    orderRef: 'cart_123',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (String(url).includes('/payment_intents')) return new Response(JSON.stringify({ id: 'pi_card_present', status: 'requires_payment_method' }), { status: 200 });
      return new Response(JSON.stringify({ id: 'tmr_123', action: { status: 'in_progress' } }), { status: 200 });
    }
  });
  assert.equal(result.status, 'processing');
  assert.equal(result.providerReference, 'pi_card_present');
  assert.equal(calls.length, 2);
  assert.match(calls[0].init.body, /payment_method_types/);
  assert.match(calls[1].url, /process_payment_intent/);
});

test('receipt printer jobs require HTTPS and signed delivery', async () => {
  await assert.rejects(() => executeReceiptPrinterJob({ url: 'http://printer.local', secret: 'secret', receipt: {} }), /HTTPS/);
  let signature = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    signature = init.headers['x-skye-signature'];
    return new Response(JSON.stringify({ printed: true }), { status: 202 });
  };
  try {
    const result = await executeReceiptPrinterJob({ url: 'https://printer.example.com/jobs', secret: 'printer_secret', receipt: { orderNumber: 'POS-1' } });
    assert.equal(result.status, 'delivered');
    assert.match(signature, /^sha256=/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POS end-of-day reconciliation proves cash variance math', () => {
  const report = buildEndOfDayReconciliation({
    shifts: [{ opening_cash_cents: 10000, closing_cash_cents: 17500 }],
    carts: [{ status: 'paid', total_cents: 5000, tenders_json: '[{"type":"cash"}]' }],
    drawerEvents: [{ event_type: 'paid_in', amount_cents: 2500 }]
  });
  assert.equal(report.expectedCashCents, 17500);
  assert.equal(report.varianceCents, 0);
});

test('tax filing payload and app settlement calculate accountable totals', () => {
  const tax = buildTaxFilingPayload({ merchant: { id: 'm1', slug: 'm' }, orders: [{ total_cents: 10000, tax_cents: 830 }, { total_cents: 5000, tax_cents: 415 }], nexusRules: [{ stateCode: 'AZ' }], period: { start: '2026-04-01', end: '2026-04-30' } });
  assert.equal(tax.grossSalesCents, 15000);
  assert.equal(tax.taxCollectedCents, 1245);
  const settlement = buildAppSettlement({ developer: { id: 'dev_1' }, invoices: [{ total_cents: 10000 }, { total_cents: 2500 }], periodStart: '2026-04-01', periodEnd: '2026-04-30', platformFeeBps: 3000 });
  assert.equal(settlement.grossCents, 12500);
  assert.equal(settlement.platformFeeCents, 3750);
  assert.equal(settlement.developerPayoutCents, 8750);
});
