import { json, noContent } from './_lib/kaixu-platform.js';
import { configuredGatewayLanes } from './_lib/kaixu-openai.js';

function envStatus() {
  const gateway = configuredGatewayLanes();
  const databaseConfigured = Boolean(process.env.NEON_DATABASE_URL || process.env.NETLIFY_DATABASE_URL);
  const missing = [];
  if (!databaseConfigured) missing.push('NEON_DATABASE_URL');
  if (!gateway.openai && !gateway.failover) missing.push('OPENAI_API_KEY or KAIXU_FAILOVER_GATEWAY_URL');
  return {
    ok: missing.length === 0,
    missing,
    gateway,
    database_configured: databaseConfigured,
    identity_expected: true
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const env = envStatus();
  return json(200, {
    ok: env.ok,
    provider: 'SKYES OVER LONDON',
    ai_name: 'kAIxU',
    openai_configured: env.gateway.openai,
    database_configured: env.database_configured,
    identity_expected: env.identity_expected,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    fallback_model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
    fallback_gateway_configured: env.gateway.failover,
    fallback_gateway_authenticated: env.gateway.failover_authenticated,
    missing_env: env.missing,
    support: {
      phone: '(480) 469-5416',
      email_primary: 'SkyesOverLondonLC@SOLEnterprises.org',
      email_secondary: 'SkyesOverLondon@gmail.com'
    }
  });
};
