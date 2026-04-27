const { createConfig, collectProductionReadiness, createServer } = require('../server/create-server');
const { fail, ok } = require('./lib');

try {
  const badConfig = createConfig({ SKYE_RUNTIME_MODE:'production', SKYE_OPERATOR_PASSPHRASE:'sovereign-build-passphrase', SKYE_PAYMENT_PROVIDER:'stripe' });
  const readiness = collectProductionReadiness(badConfig);
  if (readiness.ok) fail('[production-config] FAIL :: bad readiness should fail');
  let threw = false;
  try { createServer({ SKYE_RUNTIME_MODE:'production', SKYE_OPERATOR_PASSPHRASE:'sovereign-build-passphrase', SKYE_PAYMENT_PROVIDER:'stripe' }); } catch { threw = true; }
  if (!threw) fail('[production-config] FAIL :: production server should reject invalid config');

  const goodReadiness = collectProductionReadiness(createConfig({
    SKYE_RUNTIME_MODE:'production',
    SKYE_OPERATOR_PASSPHRASE:'sovereign-build-passphrase',
    SKYE_AUTH_SECRET:'prod-secret',
    SKYE_PORTAL_AUTOMATION_ENABLE:'true',
    SKYE_PAYMENT_PROVIDER:'stripe',
    STRIPE_SECRET_KEY:'sk_live_example',
    STRIPE_WEBHOOK_SECRET:'whsec_live_example',
    SKYE_SUBMIT_APPLE_URL:'https://submit.example.com/apple',
    SKYE_SUBMIT_APPLE_MODE:'portal',
    SKYE_SUBMIT_APPLE_TOKEN:'apple-token',
    SKYE_SUBMIT_APPLE_PARTNER_ID:'partner-001',
    SKYE_SUBMIT_KOBO_URL:'https://submit.example.com/kobo',
    SKYE_SUBMIT_KOBO_MODE:'portal',
    SKYE_SUBMIT_KOBO_KEY:'kobo-key',
    SKYE_SUBMIT_KOBO_SECRET:'kobo-secret',
    SKYE_SUBMIT_KDP_EBOOK_URL:'https://submit.example.com/kdp-ebook',
    SKYE_SUBMIT_KDP_EBOOK_MODE:'portal',
    SKYE_SUBMIT_KDP_PRINT_URL:'https://submit.example.com/kdp-print',
    SKYE_SUBMIT_KDP_PRINT_MODE:'portal',
    SKYE_SUBMIT_KDP_KEY:'kdp-key',
    SKYE_SUBMIT_KDP_SECRET:'kdp-secret'
  }));
  if (!goodReadiness.ok) fail('[production-config] FAIL :: good readiness should pass');
  ok('[production-config] PASS');
} catch (error) {
  fail(error.stack || error.message);
}
