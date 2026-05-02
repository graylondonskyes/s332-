const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createSecurity({ env = process.env, nowMs = () => Date.now() } = {}) {
  const isProduction = env.NODE_ENV === 'production';
  const requireCsrf = env.SKYE_REQUIRE_CSRF === '1' || isProduction;
  const maxBodyBytes = Number(env.MAX_BODY_BYTES || 1024 * 1024);
  const rateLimitWindowMs = Number(env.RATE_LIMIT_WINDOW_MS || 60_000);
  const rateLimitMax = Number(env.RATE_LIMIT_MAX || 240);
  const hits = new Map();

  function productionChecks() {
    const localProofDriversAllowed = env.SKYE_ALLOW_LOCAL_PROOF_SERVICES === '1';
    const proofDrivers = {
      payment: ['ledger-only'],
      notification: ['in-app-ledger'],
      route: ['route-structure-only'],
      compliance: ['local-attestation-ledger', 'none'],
      runtime: ['standalone-local-events', 'standalone']
    };
    const checks = [
      { name: 'admin_bootstrap_configured', ok: !!String(env.SKYE_ADMIN_EMAIL || '').trim() && !!String(env.SKYE_ADMIN_PASSWORD || '').trim(), required: isProduction, detail: 'SKYE_ADMIN_EMAIL and SKYE_ADMIN_PASSWORD must be configured in production.' },
      { name: 'csrf_required', ok: requireCsrf, required: isProduction, detail: 'SKYE_REQUIRE_CSRF=1 is required in production.' },
      { name: 'body_limit_configured', ok: maxBodyBytes > 0 && maxBodyBytes <= 2 * 1024 * 1024, required: isProduction, detail: 'MAX_BODY_BYTES must be configured at or below 2MB.' },
      { name: 'rate_limit_configured', ok: rateLimitMax > 0 && rateLimitWindowMs > 0, required: isProduction, detail: 'RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS must be positive.' },
      { name: 'secure_cookie_flag', ok: env.COOKIE_SECURE === '1' || !isProduction, required: isProduction, detail: 'COOKIE_SECURE=1 is required in production.' },
      { name: 'proof_services_explicitly_disabled', ok: !localProofDriversAllowed, required: isProduction, detail: 'SKYE_ALLOW_LOCAL_PROOF_SERVICES must remain unset in production.' },
      { name: 'payment_provider_not_local_proof', ok: !proofDrivers.payment.includes(env.PAYMENT_PROVIDER || ''), required: isProduction, detail: 'PAYMENT_PROVIDER must not use a local proof driver in production.' },
      { name: 'notification_provider_not_local_proof', ok: !proofDrivers.notification.includes(env.NOTIFICATION_PROVIDER || ''), required: isProduction, detail: 'NOTIFICATION_PROVIDER must not use a local proof driver in production.' },
      { name: 'route_provider_not_local_proof', ok: !proofDrivers.route.includes(env.ROUTE_INTELLIGENCE_PROVIDER || ''), required: isProduction, detail: 'ROUTE_INTELLIGENCE_PROVIDER must not use a local proof driver in production.' },
      { name: 'compliance_provider_not_local_proof', ok: !proofDrivers.compliance.includes(env.IDENTITY_COMPLIANCE_PROVIDER || ''), required: isProduction, detail: 'IDENTITY_COMPLIANCE_PROVIDER must not use a local proof driver in production.' },
      { name: 'runtime_provider_not_local_proof', ok: !proofDrivers.runtime.includes(env.SKYEHANDS_RUNTIME_PROVIDER || ''), required: isProduction, detail: 'SKYEHANDS_RUNTIME_PROVIDER must not use a local proof driver in production.' }
    ];
    return checks;
  }

  function assertProductionReady() {
    const failed = productionChecks().filter(check => check.required && !check.ok);
    if (failed.length) {
      throw new Error(`Production safety gate failed: ${failed.map(x => `${x.name} (${x.detail})`).join('; ')}`);
    }
  }

  function securityHeaders(type = 'application/json') {
    const headers = {
      'content-type': type,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      'cache-control': 'no-store'
    };
    if (type === 'text/html') headers['content-security-policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'";
    return headers;
  }

  function clientIp(req) {
    return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  }

  function rateLimit(req) {
    const key = `${clientIp(req)}:${req.headers['x-skye-session'] || ''}`;
    const t = nowMs();
    const entry = hits.get(key) || { reset_at: t + rateLimitWindowMs, count: 0 };
    if (t > entry.reset_at) {
      entry.reset_at = t + rateLimitWindowMs;
      entry.count = 0;
    }
    entry.count += 1;
    hits.set(key, entry);
    return { ok: entry.count <= rateLimitMax, retry_after_seconds: Math.max(1, Math.ceil((entry.reset_at - t) / 1000)), count: entry.count, limit: rateLimitMax };
  }

  function csrfAllowed(req) {
    if (!requireCsrf || !stateChangingMethods.has(req.method)) return true;
    if (req.headers['x-skye-session']) return true;
    if (!String(req.headers.cookie || '').includes('skye_session=')) return true;
    return req.headers['x-skye-csrf'] === '1';
  }

  function sessionCookie(id) {
    const secure = env.COOKIE_SECURE === '1' ? '; Secure' : '';
    return `skye_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1209600${secure}`;
  }

  return {
    isProduction,
    requireCsrf,
    maxBodyBytes,
    rateLimitMax,
    rateLimitWindowMs,
    productionChecks,
    assertProductionReady,
    securityHeaders,
    rateLimit,
    csrfAllowed,
    sessionCookie
  };
}
