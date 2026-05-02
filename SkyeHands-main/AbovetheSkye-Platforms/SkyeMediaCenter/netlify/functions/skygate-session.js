'use strict';

const crypto = require('node:crypto');
const { issueTestSkyGateToken } = require('./_lib/skygate-auth');

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  const raw = clean(event && event.body);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function enabled() {
  return ['1', 'true', 'yes', 'on'].includes(clean(process.env.SKYGATE_ENABLE_LOCAL_SESSION_BOOTSTRAP).toLowerCase());
}

function operatorConfig() {
  const email = clean(
    process.env.SKYGATE_LOCAL_OPERATOR_EMAIL ||
    process.env.SKYE_LOCAL_OPERATOR_EMAIL
  ).toLowerCase();
  const password = clean(
    process.env.SKYGATE_LOCAL_OPERATOR_PASSWORD ||
    process.env.SKYE_LOCAL_OPERATOR_PASSWORD
  );
  const role = clean(
    process.env.SKYGATE_LOCAL_OPERATOR_ROLE ||
    process.env.SKYE_LOCAL_OPERATOR_ROLE ||
    'platform-operator'
  );
  return {
    email,
    password,
    role,
    available: Boolean(email && password),
  };
}

function privateKey() {
  const pem = clean(
    process.env.SKYGATE_LOCAL_SESSION_PRIVATE_KEY_PEM ||
    process.env.SKYGATE_PRIVATE_KEY_PEM ||
    process.env.SKYGATE_TEST_PRIVATE_KEY_PEM
  );
  if (!pem) return null;
  return crypto.createPrivateKey(pem.replace(/\\n/g, '\n'));
}

module.exports.handler = async (event) => {
  const method = (event && event.httpMethod ? event.httpMethod : 'GET').toUpperCase();
  if (method === 'OPTIONS') return json(204, {});

  const on = enabled();
  const key = on ? privateKey() : null;
  const operator = operatorConfig();

  if (method === 'GET') {
    return json(200, {
      ok: true,
      localProofBootstrap: on && Boolean(key),
      localOperatorLogin: operator.available && Boolean(key),
      enabled: on,
      available: Boolean(key),
      operatorEmail: operator.available ? operator.email : '',
      issuer: 'https://skygatefs13.local',
      audience: clean(process.env.SKYGATE_EXPECTED_AUDIENCE || 'skygatefs13'),
    });
  }

  if (method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!on) {
    return json(503, {
      ok: false,
      error: 'Local SkyGate bootstrap is disabled. Set SKYGATE_ENABLE_LOCAL_SESSION_BOOTSTRAP=1 to enable it.',
    });
  }

  if (!key) {
    return json(503, {
      ok: false,
      error: 'Local SkyGate bootstrap is missing a private key. Set SKYGATE_LOCAL_SESSION_PRIVATE_KEY_PEM.',
    });
  }

  const payload = parseBody(event);
  if (payload == null) {
    return json(400, { ok: false, error: 'Request body must be valid JSON.' });
  }

  const wantsPasswordGrant = clean(payload.grantType).toLowerCase() === 'password' || clean(payload.email || payload.username);
  if (wantsPasswordGrant) {
    if (!key) {
      return json(503, {
        ok: false,
        error: 'Local operator login is missing a private key. Set SKYGATE_LOCAL_SESSION_PRIVATE_KEY_PEM.',
      });
    }
    if (!operator.available) {
      return json(503, {
        ok: false,
        error: 'Local operator login is not configured. Set SKYGATE_LOCAL_OPERATOR_EMAIL and SKYGATE_LOCAL_OPERATOR_PASSWORD.',
      });
    }
    const email = clean(payload.email || payload.username).toLowerCase();
    const password = clean(payload.password);
    if (email !== operator.email || password !== operator.password) {
      return json(401, { ok: false, error: 'Invalid local operator credentials.' });
    }
    const subject = clean(payload.subject || email);
    const role = clean(payload.role || operator.role);
    const token = issueTestSkyGateToken({ sub: subject, role }, key);
    return json(200, {
      ok: true,
      source: 'local-operator-login',
      token,
      subject,
      role,
      operatorEmail: operator.email,
      audience: clean(process.env.SKYGATE_EXPECTED_AUDIENCE || 'skygatefs13'),
      expiresInSeconds: 3600,
    });
  }

  const subject = clean(payload.subject || payload.sub || 'browser-proof-operator');
  const role = clean(payload.role || 'platform-operator');
  const token = issueTestSkyGateToken({ sub: subject, role }, key);

  return json(200, {
    ok: true,
    source: 'local-proof-bootstrap',
    token,
    subject,
    role,
    audience: clean(process.env.SKYGATE_EXPECTED_AUDIENCE || 'skygatefs13'),
    expiresInSeconds: 3600,
  });
};
