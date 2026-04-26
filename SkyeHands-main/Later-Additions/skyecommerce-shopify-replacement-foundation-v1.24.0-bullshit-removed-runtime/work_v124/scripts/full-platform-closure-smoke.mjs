import assert from 'node:assert/strict';
import {
  buildAppSettlement,
  buildEndOfDayReconciliation,
  buildPublicCheckoutReturnUrls,
  buildRoutePlan,
  buildTaxFilingPayload,
  executeStripeTerminalPayment
} from '../src/lib/platform-closure.js';
import { verifyPaypalWebhookSignature } from '../src/lib/provider-runtime.js';

const urls = buildPublicCheckoutReturnUrls('https://commerce.example.com', 'merchant', 'ord_1');
assert.match(urls.returnUrl, /checkout_status=return/);

const route = buildRoutePlan({ start: { lat: 0, lng: 0 }, stops: [{ id: 'b', lat: 4, lng: 0 }, { id: 'a', lat: 1, lng: 0 }] });
assert.equal(route.stops[0].id, 'a');

const terminal = await executeStripeTerminalPayment({
  stripeSecretKey: 'sk_live_smoke', readerId: 'tmr_smoke', amountCents: 1000, currency: 'USD', orderRef: 'cart_smoke',
  fetcher: async (url) => String(url).includes('/payment_intents')
    ? new Response(JSON.stringify({ id: 'pi_smoke' }), { status: 200 })
    : new Response(JSON.stringify({ id: 'tmr_smoke', action: { status: 'in_progress' } }), { status: 200 })
});
assert.equal(terminal.status, 'processing');

const report = buildEndOfDayReconciliation({ shifts: [{ opening_cash_cents: 5000, closing_cash_cents: 7000 }], carts: [{ status: 'paid', total_cents: 2000, tenders_json: '[{"type":"cash"}]' }], drawerEvents: [] });
assert.equal(report.varianceCents, 0);

const tax = buildTaxFilingPayload({ merchant: { id: 'm1' }, orders: [{ total_cents: 1000, tax_cents: 82 }], nexusRules: [], period: { start: '2026-04-01', end: '2026-04-30' } });
assert.equal(tax.taxCollectedCents, 82);

const settlement = buildAppSettlement({ developer: { id: 'dev_1' }, invoices: [{ total_cents: 1000 }], periodStart: '2026-04-01', periodEnd: '2026-04-30', platformFeeBps: 3000 });
assert.equal(settlement.developerPayoutCents, 700);

const paypal = await verifyPaypalWebhookSignature({ PAYPAL_CLIENT_ID: 'client', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_WEBHOOK_ID: 'wh_123', PAYPAL_ENDPOINT_BASE: 'https://api-m.paypal.com' }, JSON.stringify({ id: 'WH-1' }), new Headers({
  'paypal-transmission-id': 'tx_123',
  'paypal-transmission-time': '2026-04-20T00:00:00Z',
  'paypal-cert-url': 'https://api-m.paypal.com/cert.pem',
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-transmission-sig': 'sig_123'
}), { fetcher: async (url) => String(url).includes('/oauth2/token') ? new Response(JSON.stringify({ access_token: 'token' }), { status: 200 }) : new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 }) });
assert.equal(paypal.ok, true);

console.log(JSON.stringify({ ok: true, checks: ['public_checkout_urls', 'routex_route_plan', 'stripe_terminal_payment', 'pos_endofday_reconciliation', 'tax_filing_payload', 'app_settlement', 'paypal_webhook_verification'] }, null, 2));
