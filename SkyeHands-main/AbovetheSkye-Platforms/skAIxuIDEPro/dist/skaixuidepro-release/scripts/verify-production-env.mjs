const REQUIRED_GROUPS = [
  {
    name: 'ai_gateway',
    anyOf: ['OPENAI_API_KEY', 'KAIXU_FAILOVER_GATEWAY_URL'],
    detail: 'Set OPENAI_API_KEY for the primary kAIxU lane, or KAIXU_FAILOVER_GATEWAY_URL for the failover lane.'
  },
  {
    name: 'database',
    anyOf: ['NEON_DATABASE_URL', 'NETLIFY_DATABASE_URL'],
    detail: 'Set the Neon database URL used by identity, usage, admin, workspace, and logs functions.'
  }
];

const RECOMMENDED = [
  'ADMIN_EMAILS',
  'OPENAI_MODEL',
  'OPENAI_FALLBACK_MODEL',
  'DEFAULT_MONTHLY_REQUEST_CAP',
  'DEFAULT_MONTHLY_TOKEN_CAP'
];

function present(name) {
  return Boolean(String(process.env[name] || '').trim());
}

const missingRequired = REQUIRED_GROUPS
  .filter((group) => !group.anyOf.some(present))
  .map((group) => ({
    name: group.name,
    any_of: group.anyOf,
    detail: group.detail
  }));

const missingRecommended = RECOMMENDED.filter((name) => !present(name));

const result = {
  ok: missingRequired.length === 0,
  missing_required: missingRequired,
  missing_recommended: missingRecommended,
  configured: {
    primary_ai: present('OPENAI_API_KEY'),
    failover_ai: present('KAIXU_FAILOVER_GATEWAY_URL'),
    failover_token: present('KAIXU_FAILOVER_GATEWAY_TOKEN'),
    database: present('NEON_DATABASE_URL') || present('NETLIFY_DATABASE_URL'),
    admin_emails: present('ADMIN_EMAILS')
  }
};

console.log(JSON.stringify(result, null, 2));

if (missingRequired.length) process.exit(1);
