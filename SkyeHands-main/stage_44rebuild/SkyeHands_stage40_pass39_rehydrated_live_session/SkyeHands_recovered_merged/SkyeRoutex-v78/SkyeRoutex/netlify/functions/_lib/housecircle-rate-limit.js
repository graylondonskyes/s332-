// SEC-03: In-memory rate limiter for auth endpoints.
// Best-effort — serverless instances don't share state. Prevents basic brute-force within a single instance.
// For cross-instance enforcement, set PHC_RATE_LIMIT_STORE=neon and ensure Neon is configured.
const store = new Map(); // key -> { count, windowStart }

const WINDOW_MS = 5 * 60 * 1000; // 5-minute sliding window
const MAX_ATTEMPTS = parseInt(process.env.PHC_RATE_LIMIT_MAX || '5', 10);

function getClientKey(event, orgId) {
  const headers = event && event.headers || {};
  const ip = (
    headers['x-nf-client-connection-ip'] ||
    headers['x-forwarded-for'] ||
    headers['client-ip'] ||
    'unknown'
  ).split(',')[0].trim();
  return `${ip}::${(orgId || 'anon').slice(0, 64)}`;
}

function check(event, orgId) {
  const key = getClientKey(event, orgId);
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return { limited: false };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { limited: true, retryAfterSec };
  }
  entry.count += 1;
  return { limited: false };
}

function reset(event, orgId) {
  store.delete(getClientKey(event, orgId));
}

// Prune stale entries to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of store.entries()) {
    if (entry.windowStart < cutoff) store.delete(key);
  }
}, WINDOW_MS).unref();

module.exports = { check, reset };
