const { clean, compact, nowISO } = require('./housecircle-cloud-store');
const { isProductionMode } = require('./housecircle-auth');
const { readNeonConfig } = require('./housecircle-neon-store');
function boolEnv(name){ return ['1','true','yes','on'].includes(clean(process.env[name]).toLowerCase()); }
function productionReadiness(){
  const prod = isProductionMode() || boolEnv('PHC_PRODUCTION') || boolEnv('PHC_REQUIRE_PRODUCTION_READY');
  const secret = clean(process.env.PHC_SESSION_SECRET || process.env.SKYEROUTEX_SESSION_SECRET || '');
  const hasHashedCred = !!(clean(process.env.PHC_OPERATOR_PASSWORD_HASH) && clean(process.env.PHC_OPERATOR_PASSWORD_SALT));
  const hasPlainCred = !!clean(process.env.PHC_OPERATOR_PASSWORD);
  const hasBootstrap = !!clean(process.env.PHC_BOOTSTRAP_ADMIN_CODE);
  const bootstrapAllowed = boolEnv('PHC_ALLOW_BOOTSTRAP_LOGIN');
  const hasCred = !!(hasHashedCred || hasPlainCred || hasBootstrap);
  const neon = readNeonConfig();
  const requireNeon = boolEnv('PHC_REQUIRE_NEON_PRIMARY') || (prod && boolEnv('PHC_PRODUCTION_REQUIRES_NEON'));
  const allowUnsignedWebhook = boolEnv('PHC_ALLOW_UNSIGNED_WEBHOOKS');
  const checks = [
    { key:'sessionSecretConfigured', ok:!!secret, fatal:true, detail:'PHC_SESSION_SECRET must be set.' },
    { key:'sessionSecretLength', ok:!prod || secret.length >= 32, fatal:true, detail:'Production session secret must be at least 32 characters.' },
    { key:'operatorCredentialConfigured', ok:hasCred, fatal:true, detail:'Set PHC_OPERATOR_PASSWORD_HASH + PHC_OPERATOR_PASSWORD_SALT for production, or bootstrap only for first local setup.' },
    { key:'operatorCredentialHashInProduction', ok:!prod || hasHashedCred, fatal:prod, detail:'Production refuses plaintext PHC_OPERATOR_PASSWORD and bootstrap-only auth; set PHC_OPERATOR_PASSWORD_HASH + PHC_OPERATOR_PASSWORD_SALT.' },
    { key:'bootstrapNotOpenInProduction', ok:!(prod && hasBootstrap && bootstrapAllowed), fatal:prod, detail:'PHC_ALLOW_BOOTSTRAP_LOGIN cannot be enabled in production.' },
    { key:'neonConfiguredWhenRequired', ok:!requireNeon || neon.configured, fatal:requireNeon, detail:'PHC_REQUIRE_NEON_PRIMARY requires NEON_DATABASE_URL / DATABASE_URL.' },
    { key:'unsignedWebhooksDisabledInProduction', ok:!(prod && allowUnsignedWebhook), fatal:prod, detail:'PHC_ALLOW_UNSIGNED_WEBHOOKS cannot be enabled in production.' }
  ];
  const failing = checks.filter((c)=>!c.ok && c.fatal);
  return { ok:failing.length === 0, production:prod, requireNeonPrimary:requireNeon, generatedAt:nowISO(), checks, failing, neon:{ configured:neon.configured, mode: neon.mode, schema:neon.schema, branch:neon.branch || '' } };
}
function requireRuntimeReady(kind){
  const ready = productionReadiness();
  if(!ready.ok) return { ok:false, statusCode:503, error:'Runtime is not production-ready for '+compact(kind || 'this route')+'.', readiness:ready };
  return { ok:true, readiness:ready };
}
module.exports = { boolEnv, productionReadiness, requireRuntimeReady };
