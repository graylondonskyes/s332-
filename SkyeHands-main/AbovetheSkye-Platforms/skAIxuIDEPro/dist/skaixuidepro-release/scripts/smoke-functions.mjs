import { handler as adminOverview } from '../netlify/functions/admin-overview.js';
import { handler as authMe } from '../netlify/functions/auth-me.js';
import { handler as gatewayChat } from '../netlify/functions/gateway-chat.js';
import { handler as gatewayStream } from '../netlify/functions/gateway-stream.js';
import { handler as logs } from '../netlify/functions/logs.js';
import { handler as runtimeStatus } from '../netlify/functions/runtime-status.js';
import { handler as siteConfig } from '../netlify/functions/site-config.js';

const emptyContext = {};

function event(method, body = null) {
  return {
    httpMethod: method,
    headers: {},
    queryStringParameters: {},
    body: body ? JSON.stringify(body) : ''
  };
}

function parse(response) {
  try {
    return JSON.parse(response.body || '{}');
  } catch {
    return {};
  }
}

const checks = [];

async function check(name, run) {
  try {
    const result = await run();
    checks.push({ name, ok: Boolean(result.ok), ...result });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

await check('runtime-status-open', async () => {
  const response = await runtimeStatus(event('GET'), emptyContext);
  const body = parse(response);
  return {
    ok: response.statusCode === 200 && body.ai_name === 'kAIxU' && Array.isArray(body.missing_env),
    status: response.statusCode,
    configured: body.ok,
    missing_env: body.missing_env
  };
});

await check('site-config-open', async () => {
  const response = await siteConfig(event('GET'), emptyContext);
  const body = parse(response);
  return {
    ok: response.statusCode === 200 && body.ok === true && Boolean(body.config?.support_email),
    status: response.statusCode
  };
});

await check('auth-me-requires-auth', async () => {
  const response = await authMe(event('GET'), emptyContext);
  return {
    ok: response.statusCode === 401,
    status: response.statusCode,
    error: parse(response).error
  };
});

await check('gateway-chat-requires-auth-before-db', async () => {
  const response = await gatewayChat(event('POST', { contents: [{ parts: [{ text: 'ping' }] }] }), emptyContext);
  return {
    ok: response.statusCode === 401,
    status: response.statusCode,
    error: parse(response).error
  };
});

await check('gateway-stream-requires-auth-before-db', async () => {
  const response = await gatewayStream(event('POST', { contents: [{ parts: [{ text: 'ping' }] }] }), emptyContext);
  return {
    ok: response.statusCode === 401,
    status: response.statusCode,
    error: parse(response).error
  };
});

await check('admin-overview-requires-auth-before-db', async () => {
  const response = await adminOverview(event('GET'), emptyContext);
  return {
    ok: response.statusCode === 401,
    status: response.statusCode,
    error: parse(response).error
  };
});

await check('logs-read-requires-auth-before-db', async () => {
  const response = await logs(event('GET'), emptyContext);
  return {
    ok: response.statusCode === 401,
    status: response.statusCode,
    error: parse(response).error
  };
});

await check('logs-write-requires-auth-before-db', async () => {
  const response = await logs(event('POST', { source: 'smoke', message: 'ping' }), emptyContext);
  return {
    ok: response.statusCode === 401,
    status: response.statusCode,
    error: parse(response).error
  };
});

const failures = checks.filter((item) => !item.ok);

console.log(JSON.stringify({
  ok: failures.length === 0,
  checks
}, null, 2));

if (failures.length) process.exit(1);
