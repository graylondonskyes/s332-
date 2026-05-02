const axios = require('axios');

const MCP_TOKEN = process.env.MCP_API_TOKEN || 'changeme_mcp_token';
const SKYEGATE_INTROSPECT = process.env.SKYEGATE_INTROSPECT_URL || process.env.SKYEGATE_INTROSPECT;
const SKYEGATE_AUD = process.env.SKYEGATE_AUD || 'mcp';

async function verifySkyegateToken(token) {
  if (!SKYEGATE_INTROSPECT) return null;
  try {
    const resp = await axios.post(SKYEGATE_INTROSPECT, { token }, { timeout: 3000 });
    // Expecting { active: true, sub, scopes, roles, aud }
    if (!resp || !resp.data) return null;
    const d = resp.data;
    if (!d.active) return null;
    if (SKYEGATE_AUD && d.aud && Array.isArray(d.aud) && !d.aud.includes(SKYEGATE_AUD)) return null;
    return d;
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  // Fast path: explicit MCP API token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && token === MCP_TOKEN) return next();
    // else try Skyegate introspection with this token
    const info = await verifySkyegateToken(token);
    if (info) {
      req.skye = info;
      return next();
    }
    return res.status(403).json({ error: 'invalid token' });
  }

  // Alternative header: x-skye-token
  const skToken = req.headers['x-skye-token'] || req.headers['skygate-token'];
  if (skToken) {
    const info = await verifySkyegateToken(skToken);
    if (info) {
      req.skye = info;
      return next();
    }
    return res.status(403).json({ error: 'invalid skygate token' });
  }

  return res.status(401).json({ error: 'missing auth' });
}

module.exports = { requireAuth, verifySkyegateToken };
