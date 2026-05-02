const fs = require('fs');
const path = require('path');
const PRINTFUL_API_BASE_V1 = 'https://api.printful.com';
const PRINTFUL_API_BASE_V2 = 'https://api.printful.com/v2';
const MOCK_STATE_FILE = path.resolve(__dirname, '..', '..', '.printful-mock-state.json');

function isMockMode() {
  const raw = String(process.env.PRINTFUL_PROVIDER_MODE || '').trim().toLowerCase();
  return raw === 'mock' || raw === 'local-mock' || raw === 'true' || raw === '1';
}

function readMockState() {
  if (!fs.existsSync(MOCK_STATE_FILE)) {
    const initial = { nextOrder: 1, nextTask: 1, orders: {}, tasks: {} };
    fs.mkdirSync(path.dirname(MOCK_STATE_FILE), { recursive: true });
    fs.writeFileSync(MOCK_STATE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(MOCK_STATE_FILE, 'utf8'));
    return Object.assign({ nextOrder: 1, nextTask: 1, orders: {}, tasks: {} }, parsed || {});
  } catch {
    return { nextOrder: 1, nextTask: 1, orders: {}, tasks: {} };
  }
}

function writeMockState(state) {
  fs.mkdirSync(path.dirname(MOCK_STATE_FILE), { recursive: true });
  fs.writeFileSync(MOCK_STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}


function getAllowedOrigin(event) {
  const configured = process.env.PRINTFUL_ALLOWED_ORIGIN || '*';
  const requestOrigin = event?.headers?.origin || event?.headers?.Origin || '';

  if (configured === '*') return '*';
  if (!requestOrigin) return configured;
  return requestOrigin === configured ? configured : configured;
}

function corsHeaders(event) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };
}

function json(event, statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders(event),
    body: JSON.stringify(payload),
  };
}

function noContent(event) {
  return {
    statusCode: 204,
    headers: corsHeaders(event),
    body: '',
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (value) return value;
  if (isMockMode() && ['PRINTFUL_API_TOKEN', 'PRINTFUL_STORE_ID', 'PRINTFUL_ALLOWED_ORIGIN'].includes(String(name))) {
    return `mock-${String(name).toLowerCase()}`;
  }
  throw new Error(`Missing required environment variable: ${name}`);
}

async function readJsonBody(event) {
  if (!event?.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error('Request body must be valid JSON.');
  }
}

function requestIp(event) {
  const forwarded = event?.headers?.['x-forwarded-for'] || event?.headers?.['client-ip'] || '';
  return forwarded.split(',')[0].trim() || null;
}

function requestUserAgent(event) {
  return event?.headers?.['user-agent'] || null;
}

async function callPrintful({ path, method = 'GET', body, headers = {}, version = 'v1' }) {
  if (isMockMode()) {
    const state = readMockState();
    if (String(path).startsWith('/orders') && method === 'POST') {
      const orderId = Number(state.nextOrder || 1);
      state.nextOrder = orderId + 1;
      const order = {
        id: orderId,
        external_id: body && body.external_id ? body.external_id : `mock-order-${orderId}`,
        status: String(path).includes('confirm=true') ? 'pending' : 'draft',
        recipient: body && body.recipient ? body.recipient : {},
        items: body && body.items ? body.items : [],
        retail_costs: body && body.retail_costs ? body.retail_costs : {},
        created: new Date().toISOString(),
        tracking_number: '',
        tracking_url: '',
      };
      state.orders[String(orderId)] = order;
      writeMockState(state);
      return { code: 200, result: order, mockMode: true };
    }
    if (String(path).startsWith('/orders/') && method === 'GET') {
      const orderId = String(path).split('/').pop().split('?')[0];
      const order = state.orders[orderId] || { id: Number(orderId) || 0, status: 'draft', recipient: {}, items: [], retail_costs: {}, tracking_number: '', tracking_url: '' };
      return { code: 200, result: order, mockMode: true };
    }
    if ((String(path).startsWith('/mockup-generator/tasks') || String(path).startsWith('/mockup-generator/create-task/')) && method === 'POST') {
      const taskId = `mock-task-${Number(state.nextTask || 1)}`;
      state.nextTask = Number(state.nextTask || 1) + 1;
      const task = {
        task_key: taskId,
        status: 'completed',
        mockup_url: `mock://printful/tasks/${taskId}.png`,
        preview_url: `mock://printful/tasks/${taskId}.png`,
        payload: body || {},
      };
      state.tasks[taskId] = task;
      writeMockState(state);
      return { code: 200, result: task, mockMode: true };
    }
    if ((String(path).startsWith('/mockup-generator/tasks/') || String(path).startsWith('/mockup-generator/task?')) && method === 'GET') {
      const queryTask = String(path).includes('task_key=') ? String(path).split('task_key=').pop().split('&')[0] : '';
      const taskId = queryTask || String(path).split('/').pop();
      const task = state.tasks[taskId] || { task_key: taskId, status: 'completed', mockup_url: `mock://printful/tasks/${taskId}.png`, preview_url: `mock://printful/tasks/${taskId}.png` };
      return { code: 200, result: task, mockMode: true };
    }
    return { code: 200, result: { mockMode: true, path, method, body }, mockMode: true };
  }
  const token = requireEnv('PRINTFUL_API_TOKEN');
  const baseUrl = version === 'v2' ? PRINTFUL_API_BASE_V2 : PRINTFUL_API_BASE_V1;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const detail = data?.result || data?.error || data?.message || data?.raw || 'Unknown Printful error';
    const error = new Error(
      typeof detail === 'string' ? detail : JSON.stringify(detail)
    );
    error.statusCode = response.status;
    error.printful = data;
    throw error;
  }

  return data;
}

function assertMethod(event, allowedMethod) {
  if (event.httpMethod === 'OPTIONS') return 'OPTIONS';
  if (event.httpMethod !== allowedMethod) {
    const error = new Error(`Method ${event.httpMethod} not allowed. Use ${allowedMethod}.`);
    error.statusCode = 405;
    throw error;
  }
  return allowedMethod;
}

function parseQuery(event) {
  const raw = event?.queryStringParameters || {};
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value != null));
}

module.exports = {
  assertMethod,
  callPrintful,
  corsHeaders,
  json,
  noContent,
  parseQuery,
  readJsonBody,
  requestIp,
  requestUserAgent,
  requireEnv,
  isMockMode,
  readMockState,
};
