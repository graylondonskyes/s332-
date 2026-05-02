const axios = require('axios');

function getRoles(skye = {}) {
  const values = [
    skye.roles,
    skye.role,
    skye.scope,
    skye.scopes
  ].filter(Boolean);

  return values.flatMap(value => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(/[,\s]+/).filter(Boolean);
    return [];
  });
}

function requireWriteAccess(req, res) {
  if (!req.skye) return true;
  const roles = getRoles(req.skye);
  if (roles.includes('repo.write') || roles.includes('write')) return true;
  res.status(403).json({ error: 'skyegate token lacks repo.write role' });
  return false;
}

async function meterWrite(req, action) {
  const url = process.env.SKYE_BILLING_METER_URL || process.env.SKYEGATE_BILLING_URL;
  if (!url || !req.skye) return null;

  const payload = {
    action,
    sub: req.skye.sub || req.skye.user || null,
    org: req.skye.org || req.skye.organization || null,
    aud: req.skye.aud || null,
    units: 1,
    metadata: {
      path: req.body.path,
      branch: req.body.branch || null,
      title: req.body.title || null
    }
  };

  const resp = await axios.post(url, payload, {
    timeout: Number(process.env.SKYE_BILLING_TIMEOUT_MS || 3000),
    headers: process.env.SKYE_BILLING_API_KEY
      ? { Authorization: `Bearer ${process.env.SKYE_BILLING_API_KEY}` }
      : undefined
  });

  const data = resp.data || {};
  if (data.allowed === false || data.active === false || data.quota_exhausted === true) {
    const err = new Error(data.reason || 'Skyegate write quota exhausted');
    err.status = 402;
    err.details = data;
    throw err;
  }
  return data;
}

function skyegatePrAnnotation(skye, metering) {
  if (!skye) return '';
  const requester = skye.sub || skye.user || 'unknown';
  const org = skye.org ? ` (org: ${skye.org})` : '';
  const sections = [
    '',
    '---',
    `Requested via Skyegate user: ${requester}${org}`,
    '',
    'Skyegate introspection:',
    '',
    '```json',
    JSON.stringify(skye, null, 2),
    '```'
  ];

  if (metering) {
    sections.push('', 'Skyegate metering:', '', '```json', JSON.stringify(metering, null, 2), '```');
  }

  return sections.join('\n');
}

module.exports = {
  requireWriteAccess,
  meterWrite,
  skyegatePrAnnotation
};
