'use strict';

const crypto = require('node:crypto');
const { issueLocalOperatorToken, verifyOperatorBearer } = require('./_lib/skygate-auth');
const { json, nowISO, parseBody } = require('./_lib/store');

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function passwordMatches(password, configured) {
  const raw = clean(configured);
  if (!raw) return false;
  if (raw.startsWith('scrypt:')) {
    const [, salt, digest] = raw.split(':');
    return Boolean(salt && digest) && hashPassword(password, salt) === digest;
  }
  return password === raw;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod === 'GET') {
    const auth = verifyOperatorBearer(event);
    if (!auth.ok) return json(200, { ok: true, authenticated: false, mode: 'local-operator' });
    return json(200, { ok: true, authenticated: true, mode: auth.local ? 'local-operator' : 'skygate', claims: auth.claims });
  }
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const body = parseBody(event);
  const email = clean(body.email).toLowerCase();
  const password = clean(body.password);
  const expectedEmail = clean(process.env.VALLEYVERIFIED_LOCAL_OPERATOR_EMAIL).toLowerCase();
  const expectedPassword = clean(process.env.VALLEYVERIFIED_LOCAL_OPERATOR_PASSWORD || process.env.VALLEYVERIFIED_LOCAL_OPERATOR_PASSWORD_HASH);

  if (!expectedEmail || !expectedPassword) {
    return json(503, { ok: false, error: 'Local operator credentials are not configured.' });
  }
  if (!email || !password) return json(400, { ok: false, error: 'email and password are required' });
  if (email !== expectedEmail || !passwordMatches(password, expectedPassword)) {
    return json(401, { ok: false, error: 'Invalid operator credentials.' });
  }

  const token = issueLocalOperatorToken({ email, sub: `operator:${email}` });
  return json(200, { ok: true, token, operator: { email, role: 'operator', issuedAt: nowISO(), mode: 'local-operator' } });
};
