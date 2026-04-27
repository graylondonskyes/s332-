const crypto = require('crypto');
const { canonicalize } = require('./export-import');

function hashPayload(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function createUnsignedLocalSession({ operator, org, sessionTtlMinutes = 15, gatewayMode = 'skye-gateway-only', nowMs = Date.now() }) {
  if (!operator || !org) throw new Error('operator and org are required');
  return canonicalize({
    schema: 'skye.local.session',
    version: '2.4.4',
    auth_mode: 'local-signed-receipt-only',
    operator,
    org,
    gateway_mode: gatewayMode,
    minted_at: nowMs,
    expires_at: nowMs + (sessionTtlMinutes * 60 * 1000)
  });
}

function signLocalSession(unsignedSession, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.trim().length < 12) throw new Error('Passphrase must be at least 12 characters.');
  return hashPayload({ passphrase, payload: unsignedSession });
}

function mintLocalSession(args, passphrase) {
  const unsignedSession = createUnsignedLocalSession(args);
  return canonicalize({ ...unsignedSession, signature: signLocalSession(unsignedSession, passphrase) });
}

function verifyLocalSession(session, passphrase, nowMs = Date.now()) {
  const issues = [];
  if (!session || session.schema !== 'skye.local.session') issues.push('schema');
  if (!session || typeof session.expires_at !== 'number') issues.push('expires_at');
  if (!session || typeof session.signature !== 'string') issues.push('signature');
  if (!issues.length && nowMs >= session.expires_at) issues.push('expired');
  let expectedSignature = null;
  if (!issues.includes('schema') && !issues.includes('signature')) {
    const unsignedSession = { ...session };
    delete unsignedSession.signature;
    expectedSignature = signLocalSession(unsignedSession, passphrase);
    if (expectedSignature !== session.signature) issues.push('tampered');
  }
  return canonicalize({
    schema: 'skye.local.session.verification',
    version: '2.4.4',
    ok: issues.length === 0,
    issues,
    expected_signature: expectedSignature,
    summary: summarizeLocalSession(session)
  });
}

function summarizeLocalSession(session) {
  return canonicalize({
    schema: 'skye.local.session.summary',
    version: '2.4.4',
    auth_mode: session?.auth_mode || null,
    operator: session?.operator || null,
    org: session?.org || null,
    gateway_mode: session?.gateway_mode || null,
    expires_at: typeof session?.expires_at === 'number' ? session.expires_at : null
  });
}

module.exports = { hashPayload, createUnsignedLocalSession, signLocalSession, mintLocalSession, verifyLocalSession, summarizeLocalSession };
