import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { sha256Hex, signToken } from '../src/lib/utils.js';

const SESSION_SECRET = 'runtime-lifecycle-secret';

async function merchantCookie() {
  const token = await signToken(SESSION_SECRET, { sid: 'sess_runtime_lifecycle', role: 'merchant_owner', merchantId: 'm1', email: 'owner@example.com', exp: Date.now() + 60_000 });
  return { token, hash: await sha256Hex(token), cookie: `skye_session=${encodeURIComponent(token)}` };
}

function makeD1(state = {}) {
  state.sessions ||= [];
  state.rateLimits ||= [];
  state.routePlans ||= [];
  state.routePlanEvents ||= [];
  state.returnPickups ||= [];
  state.developers ||= [];
  state.taxFilings ||= [];
  state.fraudJobs ||= [];
  state.auditEvents ||= [];
  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => {
              if (/FROM api_rate_limits/.test(sql)) return { results: state.rateLimits };
              if (/FROM route_plan_events WHERE merchant_id = \? AND route_plan_id = \? ORDER BY created_at DESC/.test(sql)) {
                return { results: state.routePlanEvents.filter((row) => row.merchant_id === bindings[0] && row.route_plan_id === bindings[1]) };
              }
              if (/FROM tax_filing_jobs WHERE merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: state.taxFilings.filter((row) => row.merchant_id === bindings[0]) };
              if (/FROM fraud_screening_jobs WHERE merchant_id = \? ORDER BY created_at DESC/.test(sql)) return { results: state.fraudJobs.filter((row) => row.merchant_id === bindings[0]) };
              return { results: [] };
            },
            first: async () => {
              if (/FROM sessions/.test(sql)) return state.sessions.find((row) => row.token_hash === bindings[0]) || null;
              if (/FROM api_rate_limits/.test(sql)) return state.rateLimits.find((row) => row.bucket_key === bindings[0]) || null;
              if (/FROM route_plans WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.routePlans.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/FROM route_plans WHERE id = \? LIMIT 1/.test(sql)) return state.routePlans.find((row) => row.id === bindings[0]) || null;
              if (/FROM route_plan_events WHERE id = \? LIMIT 1/.test(sql)) return state.routePlanEvents.find((row) => row.id === bindings[0]) || null;
              if (/FROM app_developer_accounts WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.developers.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/FROM app_developer_accounts WHERE id = \? LIMIT 1/.test(sql)) return state.developers.find((row) => row.id === bindings[0]) || null;
              if (/FROM tax_filing_jobs WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.taxFilings.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              if (/FROM fraud_screening_jobs WHERE id = \? AND merchant_id = \? LIMIT 1/.test(sql)) return state.fraudJobs.find((row) => row.id === bindings[0] && row.merchant_id === bindings[1]) || null;
              return null;
            },
            run: async () => {
              if (/INSERT INTO api_rate_limits/.test(sql)) {
                state.rateLimits.push({ bucket_key: bindings[0], request_count: bindings[7] });
                return { success: true };
              }
              if (/UPDATE api_rate_limits SET request_count/.test(sql)) {
                const row = state.rateLimits.find((item) => item.bucket_key === bindings[1]);
                if (row) row.request_count = bindings[0];
                return { success: true };
              }
              if (/UPDATE route_plans SET status = \?, stops_json = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.routePlans.find((item) => item.id === bindings[2] && item.merchant_id === bindings[3]);
                if (row) {
                  row.status = bindings[0];
                  row.stops_json = bindings[1];
                }
                return { success: true };
              }
              if (/INSERT INTO route_plan_events /.test(sql)) {
                state.routePlanEvents.push({ id: bindings[0], merchant_id: bindings[1], route_plan_id: bindings[2], stop_id: bindings[3], order_id: bindings[4], return_pickup_id: bindings[5], event_type: bindings[6], status: bindings[7], proof_json: bindings[8], actor: bindings[9], created_at: '2026-04-24T00:00:00.000Z' });
                return { success: true };
              }
              if (/UPDATE return_pickups SET status = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.returnPickups.find((item) => item.id === bindings[1] && item.merchant_id === bindings[2]);
                if (row) row.status = bindings[0];
                return { success: true };
              }
              if (/UPDATE app_developer_accounts SET name = \?, email = \?, status = \?, payout_share_bps = \?, updated_at = CURRENT_TIMESTAMP WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.developers.find((item) => item.id === bindings[4] && item.merchant_id === bindings[5]);
                if (row) {
                  row.name = bindings[0];
                  row.email = bindings[1];
                  row.status = bindings[2];
                  row.payout_share_bps = bindings[3];
                  row.updated_at = '2026-04-24T00:00:00.000Z';
                }
                return { success: true };
              }
              if (/UPDATE tax_filing_jobs SET status = \?, provider_result_json = \? WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.taxFilings.find((item) => item.id === bindings[2] && item.merchant_id === bindings[3]);
                if (row) {
                  row.status = bindings[0];
                  row.provider_result_json = bindings[1];
                }
                return { success: true };
              }
              if (/UPDATE fraud_screening_jobs SET status = \?, provider_result_json = \? WHERE id = \? AND merchant_id = \?/.test(sql)) {
                const row = state.fraudJobs.find((item) => item.id === bindings[2] && item.merchant_id === bindings[3]);
                if (row) {
                  row.status = bindings[0];
                  row.provider_result_json = bindings[1];
                }
                return { success: true };
              }
              if (/INSERT INTO audit_events/.test(sql) || /INSERT INTO order_events/.test(sql)) {
                state.auditEvents.push({ sql, bindings });
                return { success: true };
              }
              return { success: true };
            }
          };
        }
      };
    }
  };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

test('route stop event route records proof, completes pickup, and updates plan state', async () => {
  const state = {};
  const cookie = await merchantCookie();
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  state.sessions.push({ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@example.com', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'merchant-store', brand_name: 'Merchant Store' });
  state.returnPickups.push({ id: 'rpick_1', merchant_id: 'm1', status: 'assigned' });
  state.routePlans.push({
    id: 'rplan_1',
    merchant_id: 'm1',
    driver_id: 'drv_1',
    vehicle_id: 'veh_1',
    status: 'dispatched',
    route_date: '2026-04-24',
    stops_json: JSON.stringify([{ id: 'stop_1', label: 'Return pickup', returnPickupId: 'rpick_1', status: 'queued' }]),
    created_at: '2026-04-24T00:00:00.000Z',
    updated_at: '2026-04-24T00:00:00.000Z'
  });

  const response = await app.fetch(new Request('https://commerce.test/api/routex/plans/rplan_1/stops/stop_1/event', {
    method: 'POST',
    headers: { cookie: cookie.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ eventType: 'picked_up', status: 'picked_up', actor: 'Driver One', proofUrl: 'https://proof.example/pod.jpg', note: 'Customer handed over package.' })
  }), env);
  const data = await readJson(response);
  assert.equal(response.status, 201);
  assert.equal(data.plan.status, 'completed');
  assert.equal(data.plan.stops[0].status, 'picked_up');
  assert.equal(data.event.status, 'picked_up');
  assert.equal(state.returnPickups[0].status, 'completed');
  assert.equal(state.routePlanEvents.length, 1);
});

test('developer account patch route updates payout share and status', async () => {
  const state = {};
  const cookie = await merchantCookie();
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  state.sessions.push({ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@example.com', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'merchant-store', brand_name: 'Merchant Store' });
  state.developers.push({ id: 'dev_1', merchant_id: 'm1', name: 'Studio', email: 'studio@example.com', status: 'active', payout_share_bps: 7000, created_at: '2026-04-24T00:00:00.000Z' });

  const response = await app.fetch(new Request('https://commerce.test/api/app-developers/dev_1', {
    method: 'PATCH',
    headers: { cookie: cookie.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'inactive', payoutShareBps: 6500 })
  }), env);
  const data = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(data.developer.status, 'inactive');
  assert.equal(data.developer.payoutShareBps, 6500);
});

test('tax and fraud patch routes update runtime job status records', async () => {
  const state = {};
  const cookie = await merchantCookie();
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  state.sessions.push({ token_hash: cookie.hash, merchant_id: 'm1', email: 'owner@example.com', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z', slug: 'merchant-store', brand_name: 'Merchant Store' });
  state.taxFilings.push({ id: 'tax_1', merchant_id: 'm1', period_start: '2026-04-01', period_end: '2026-04-30', status: 'submitted', payload_json: '{}', provider_result_json: '{}' });
  state.fraudJobs.push({ id: 'fraud_1', merchant_id: 'm1', order_id: 'ord_1', status: 'submitted', payload_json: '{}', provider_result_json: '{}' });

  const taxResponse = await app.fetch(new Request('https://commerce.test/api/tax-filings/tax_1', {
    method: 'PATCH',
    headers: { cookie: cookie.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'filed', providerResult: { reference: 'tax_live_123' } })
  }), env);
  const taxData = await readJson(taxResponse);
  assert.equal(taxResponse.status, 200);
  assert.equal(taxData.filing.status, 'filed');
  assert.equal(taxData.filing.providerResult.reference, 'tax_live_123');

  const fraudResponse = await app.fetch(new Request('https://commerce.test/api/fraud-screenings/fraud_1', {
    method: 'PATCH',
    headers: { cookie: cookie.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'cleared', providerResult: { score: 12 } })
  }), env);
  const fraudData = await readJson(fraudResponse);
  assert.equal(fraudResponse.status, 200);
  assert.equal(fraudData.screening.status, 'cleared');
  assert.equal(fraudData.screening.providerResult.score, 12);
});
