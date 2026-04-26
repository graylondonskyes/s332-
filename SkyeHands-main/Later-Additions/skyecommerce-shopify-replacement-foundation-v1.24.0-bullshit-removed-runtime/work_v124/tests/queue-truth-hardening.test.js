import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';
import { signToken, sha256Hex } from '../src/lib/utils.js';
import { nextQueueFailureState, notificationProviderMissingMessage } from '../src/lib/queue-hardening.js';

const SESSION_SECRET = 'queue-truth-secret';

async function merchantCookie() {
  const token = await signToken(SESSION_SECRET, {
    sid: 'sessraw_queue',
    role: 'merchant_owner',
    merchantId: 'm1',
    email: 'owner@queue.test',
    exp: Date.now() + 60_000
  });
  return { cookie: `skye_session=${encodeURIComponent(token)}`, tokenHash: await sha256Hex(token) };
}

function makeD1(state) {
  state.notifications ||= [];
  state.webhookEndpoints ||= [];
  return {
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            all: async () => {
              if (/FROM notification_messages\b/.test(sql)) {
                return { results: state.notifications.filter((row) => row.merchant_id === bindings[0] && ['queued', 'failed'].includes(row.status) && !row.next_attempt_at) };
              }
              if (/FROM provider_connections\b/.test(sql)) return { results: [] };
              if (/FROM merchants\b/.test(sql)) return { results: [{ id: 'm1' }] };
              if (/FROM webhook_deliveries\b/.test(sql)) return { results: [] };
              if (/FROM webhook_endpoints\b/.test(sql)) return { results: state.webhookEndpoints };
              return { results: [] };
            },
            first: async () => {
              if (/FROM sessions\b/.test(sql)) {
                const row = state.sessions.find((item) => item.token_hash === bindings[0]);
                return row ? { ...row, slug: 'queue-store', brand_name: 'Queue Store' } : null;
              }
              if (/FROM provider_connections\b/.test(sql)) return null;
              if (/FROM webhook_endpoints\b/.test(sql)) {
                return state.webhookEndpoints.find((row) => row.id === bindings[0]) || null;
              }
              return null;
            },
            run: async () => {
              if (/UPDATE notification_messages\s+SET status = 'sent'/.test(sql)) {
                const row = state.notifications.find((item) => item.id === bindings[1]);
                if (row) Object.assign(row, { status: 'sent', provider_ref: bindings[0], attempt_count: Number(row.attempt_count || 0) + 1, last_error: '', next_attempt_at: null });
              } else if (/UPDATE notification_messages\s+SET status = \?/.test(sql)) {
                const row = state.notifications.find((item) => item.id === bindings[6] && item.merchant_id === bindings[7]);
                if (row) Object.assign(row, { status: bindings[0], attempt_count: bindings[1], last_error: bindings[2], provider_ref: bindings[3], next_attempt_at: bindings[4] ? 'future' : null });
              } else if (/INSERT INTO webhook_endpoints\b/.test(sql)) {
                state.webhookEndpoints.push({
                  id: bindings[0],
                  merchant_id: bindings[1],
                  name: bindings[2],
                  url: bindings[3],
                  events_json: bindings[4],
                  secret_hash: bindings[5],
                  secret_preview: bindings[6],
                  secret_cipher_json: bindings[7],
                  headers_json: bindings[8],
                  active: bindings[9],
                  created_at: 'now',
                  updated_at: 'now'
                });
              }
              return { success: true };
            }
          };
        }
      };
    }
  };
}

async function runQueue(env, cookie) {
  const response = await app.fetch(new Request('https://commerce.test/api/system/queues/run', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{}'
  }), env);
  return { response, data: await response.json().catch(() => ({})) };
}

test('queue hardening helpers fail closed without a live provider', () => {
  assert.match(notificationProviderMissingMessage(), /No live notification provider configured/);
  const state = nextQueueFailureState({ attempt_count: 1 }, 'boom', { QUEUE_MAX_ATTEMPTS: '2' });
  assert.equal(state.status, 'dead_letter');
  assert.equal(state.deadLetter, true);
});

test('system queue route dead-letters notification instead of fake-sending without provider or local override', async () => {
  const { cookie, tokenHash } = await merchantCookie();
  const state = {
    sessions: [{ token_hash: tokenHash, id: 'sess_1', merchant_id: 'm1', email: 'owner@queue.test', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z' }],
    notifications: [{ id: 'ntf_1', merchant_id: 'm1', channel: 'email', template_key: 'order_created', recipient: 'buyer@test.invalid', subject: 'Order', body_text: 'Body', status: 'failed', attempt_count: 1, last_error: '', next_attempt_at: null, meta_json: '{}', created_at: 'now' }]
  };
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false', QUEUE_MAX_ATTEMPTS: '2' };
  const { response, data } = await runQueue(env, cookie);
  assert.equal(response.status, 200);
  assert.equal(data.runs[0].notifications.deadLettered, 1);
  assert.equal(state.notifications[0].status, 'dead_letter');
  assert.match(state.notifications[0].last_error, /No live notification provider configured/);
});

test('system queue route fails closed when no live notification provider is configured', async () => {
  const { cookie, tokenHash } = await merchantCookie();
  const state = {
    sessions: [{ token_hash: tokenHash, id: 'sess_1', merchant_id: 'm1', email: 'owner@queue.test', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z' }],
    notifications: [{ id: 'ntf_2', merchant_id: 'm1', channel: 'email', template_key: 'order_created', recipient: 'buyer@test.invalid', subject: 'Order', body_text: 'Body', status: 'queued', attempt_count: 0, last_error: '', next_attempt_at: null, meta_json: '{}', created_at: 'now' }]
  };
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false', QUEUE_MAX_ATTEMPTS: '1' };
  const { response, data } = await runQueue(env, cookie);
  assert.equal(response.status, 200);
  assert.equal(data.runs[0].notifications.succeeded, 0);
  assert.equal(data.runs[0].notifications.deadLettered, 1);
  assert.equal(state.notifications[0].status, 'dead_letter');
  assert.equal(state.notifications[0].provider_ref || '', 'No live notification provider configured. Notification dispatch is fail-closed until a live provider connection and credentials are configured.'.slice(0, 180));
});

test('webhook endpoint route stores encrypted signing secret instead of unrecoverable preview-only secret', async () => {
  const { cookie, tokenHash } = await merchantCookie();
  const state = {
    sessions: [{ token_hash: tokenHash, id: 'sess_1', merchant_id: 'm1', email: 'owner@queue.test', role: 'merchant_owner', expires_at: '2999-01-01T00:00:00.000Z' }],
    notifications: [],
    webhookEndpoints: []
  };
  const env = { DB: makeD1(state), SESSION_SECRET, CSRF_ENFORCEMENT: 'false' };
  const response = await app.fetch(new Request('https://commerce.test/api/webhooks/endpoints', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'ERP Live Hook', url: 'https://erp.example.test/webhook', events: ['order.created'], secret: 'whsec_real_secret_123456' })
  }), env);
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.equal(data.endpoint.secret, undefined);
  assert.equal(state.webhookEndpoints.length, 1);
  assert.equal(state.webhookEndpoints[0].secret_preview, '123456');
  assert.match(state.webhookEndpoints[0].secret_cipher_json, /AES-256-GCM/);
  assert.doesNotMatch(state.webhookEndpoints[0].secret_cipher_json, /whsec_real_secret_123456/);
});
