const { canonicalize } = require('./export-import');

function getTruthBoundaryStatus(env = process.env) {
  const authConfigured = !!env.SKYE_AUTH_SECRET;
  const paymentsConfigured = !!env.STRIPE_SECRET_KEY;
  const submissionsConfigured = !!(env.SKYE_SUBMIT_APPLE_URL || env.SKYE_SUBMIT_KOBO_URL || env.SKYE_SUBMIT_KDP_EBOOK_URL || env.SKYE_SUBMIT_KDP_PRINT_URL);
  return canonicalize({
    schema: 'skye.truth.boundaries',
    version: '3.2.0',
    auth: { mode: 'server-token-capable', live_ready: authConfigured, reason: authConfigured ? 'Server auth secret configured. Token issuance and verification are enabled.' : 'Server auth code is present, but SKYE_AUTH_SECRET is not configured.' },
    payments: { mode: 'stripe-gateway-capable', live_ready: paymentsConfigured, reason: paymentsConfigured ? 'Stripe gateway code is configured with a secret key.' : 'Stripe gateway code is present, but STRIPE_SECRET_KEY is not configured.' },
    submissions: { mode: 'vendor-portal-workflow-capable', live_ready: submissionsConfigured, reason: submissionsConfigured ? 'Vendor portal workflow adapters are configured with channel endpoints.' : 'Vendor portal workflow code is present, but channel endpoints are not configured.' }
  });
}

function assertCapability(kind, env = process.env) {
  const boundaries = getTruthBoundaryStatus(env);
  const target = boundaries[kind];
  return canonicalize({ schema: 'skye.truth.boundary.assertion', version: '3.2.0', kind, ok: !!target && target.live_ready === true, mode: target?.mode || null, reason: target?.reason || 'unsupported-boundary' });
}

module.exports = { getTruthBoundaryStatus, assertCapability };
