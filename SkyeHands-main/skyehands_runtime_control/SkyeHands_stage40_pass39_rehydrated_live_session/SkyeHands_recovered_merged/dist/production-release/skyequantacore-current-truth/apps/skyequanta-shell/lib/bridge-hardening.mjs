import crypto from 'node:crypto';

const rateLimitBuckets = new Map();
const authFailureBuckets = new Map();

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

function readCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function nowMs() {
  return Date.now();
}

function normalizeOrigin(origin) {
  const raw = String(origin || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeRequestIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',').map(item => item.trim()).filter(Boolean)[0];
  const raw = forwarded || request.socket?.remoteAddress || 'unknown';
  return String(raw).replace(/^::ffff:/, '');
}

export function getBridgeHardeningPolicy(env = process.env, config = null) {
  const bridgeHost = config?.bridge?.host || '127.0.0.1';
  const bridgePort = config?.bridge?.port || 3020;
  const defaults = [
    `http://${bridgeHost}:${bridgePort}`,
    `http://127.0.0.1:${bridgePort}`,
    `http://localhost:${bridgePort}`,
    'http://127.0.0.1',
    'http://localhost'
  ];
  const configuredOrigins = readCsv(env.SKYEQUANTA_ALLOWED_CONTROL_ORIGINS || env.SKYEQUANTA_ALLOWED_ORIGINS);
  return {
    maxJsonBodyBytes: readInteger(env.SKYEQUANTA_MAX_JSON_BODY_BYTES, 256 * 1024),
    bodyReadTimeoutMs: readInteger(env.SKYEQUANTA_BODY_READ_TIMEOUT_MS, 5000),
    rateLimitWindowMs: readInteger(env.SKYEQUANTA_RATE_LIMIT_WINDOW_MS, 60 * 1000),
    maxRequestsPerWindow: readInteger(env.SKYEQUANTA_MAX_REQUESTS_PER_WINDOW, 600),
    maxMutationsPerWindow: readInteger(env.SKYEQUANTA_MAX_MUTATIONS_PER_WINDOW, 120),
    authFailureWindowMs: readInteger(env.SKYEQUANTA_AUTH_FAILURE_WINDOW_MS, 15 * 60 * 1000),
    authFailureThreshold: readInteger(env.SKYEQUANTA_AUTH_FAILURE_THRESHOLD, 8),
    authFailureLockoutMs: readInteger(env.SKYEQUANTA_AUTH_FAILURE_LOCKOUT_MS, 15 * 60 * 1000),
    allowedControlOrigins: [...new Set((configuredOrigins.length ? configuredOrigins : defaults).map(normalizeOrigin).filter(Boolean))]
  };
}

export function isMutationMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function cleanupRateLimitBucket(bucket, windowMs) {
  const cutoff = nowMs() - windowMs;
  bucket.hits = (bucket.hits || []).filter(item => item.at >= cutoff);
  return bucket;
}

function cleanupAuthFailures(bucket, windowMs) {
  const cutoff = nowMs() - windowMs;
  bucket.failures = (bucket.failures || []).filter(item => item >= cutoff);
  if ((bucket.lockedUntilMs || 0) <= nowMs()) {
    bucket.lockedUntilMs = 0;
  }
  return bucket;
}

function routeKey(requestUrl) {
  return `${requestUrl.pathname}:${isMutationMethod(requestUrl.method) ? 'mutation' : 'read'}`;
}

export function evaluateBridgeRequestPolicy(request, requestUrl, policy) {
  const ip = normalizeRequestIp(request);
  const origin = normalizeOrigin(request.headers.origin);
  const authBucket = cleanupAuthFailures(authFailureBuckets.get(ip) || { failures: [], lockedUntilMs: 0 }, policy.authFailureWindowMs);
  authFailureBuckets.set(ip, authBucket);
  if ((authBucket.lockedUntilMs || 0) > nowMs()) {
    return {
      ok: false,
      statusCode: 429,
      error: 'auth_lockout_active',
      detail: `Too many failed authentication attempts. Locked until ${new Date(authBucket.lockedUntilMs).toISOString()}.`,
      ip,
      origin
    };
  }

  if (isMutationMethod(request.method) && origin && !policy.allowedControlOrigins.includes(origin)) {
    return {
      ok: false,
      statusCode: 403,
      error: 'origin_forbidden',
      detail: `Origin '${origin}' is not allowed to perform control-plane mutations.`,
      ip,
      origin
    };
  }

  const contentLength = readInteger(request.headers['content-length'], 0);
  if (contentLength > policy.maxJsonBodyBytes && ['POST', 'PUT', 'PATCH'].includes(String(request.method || '').toUpperCase())) {
    return {
      ok: false,
      statusCode: 413,
      error: 'payload_too_large',
      detail: `JSON body exceeds max size of ${policy.maxJsonBodyBytes} bytes.`,
      ip,
      origin
    };
  }

  const key = `${ip}:${request.method}:${routeKey(requestUrl)}`;
  const bucket = cleanupRateLimitBucket(rateLimitBuckets.get(key) || { hits: [] }, policy.rateLimitWindowMs);
  bucket.hits.push({ at: nowMs() });
  rateLimitBuckets.set(key, bucket);
  const maxAllowed = isMutationMethod(request.method) ? policy.maxMutationsPerWindow : policy.maxRequestsPerWindow;
  if (bucket.hits.length > maxAllowed) {
    return {
      ok: false,
      statusCode: 429,
      error: 'rate_limit_exceeded',
      detail: `Rate limit exceeded for ${isMutationMethod(request.method) ? 'mutating' : 'read'} bridge requests.`,
      ip,
      origin
    };
  }

  return { ok: true, ip, origin };
}

export function readJsonBodyWithHardening(request, policy) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error(`JSON body read timeout after ${policy.bodyReadTimeoutMs}ms.`));
      request.destroy();
    }, policy.bodyReadTimeoutMs);

    request.on('data', chunk => {
      if (finished) return;
      const buffer = Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > policy.maxJsonBodyBytes) {
        finished = true;
        clearTimeout(timeout);
        reject(new Error(`JSON body exceeds max size of ${policy.maxJsonBodyBytes} bytes.`));
        request.destroy();
        return;
      }
      chunks.push(buffer);
    });

    request.on('error', error => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(error);
    });

    request.on('end', () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(payload && typeof payload === 'object' ? payload : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
  });
}

export function recordBridgeAuthOutcome(request, response, policy) {
  const authHeader = String(request.headers.authorization || request.headers['x-skyequanta-session-token'] || '').trim();
  if (!authHeader) {
    return;
  }
  const ip = normalizeRequestIp(request);
  const bucket = cleanupAuthFailures(authFailureBuckets.get(ip) || { failures: [], lockedUntilMs: 0 }, policy.authFailureWindowMs);
  if (response.statusCode === 401 || response.statusCode === 403) {
    bucket.failures.push(nowMs());
    if (bucket.failures.length >= policy.authFailureThreshold) {
      bucket.lockedUntilMs = nowMs() + policy.authFailureLockoutMs;
    }
    authFailureBuckets.set(ip, bucket);
    return;
  }
  if (response.statusCode >= 200 && response.statusCode < 400) {
    authFailureBuckets.delete(ip);
  }
}

export function shouldAuditBridgeRequest(request, requestUrl, response) {
  if (isMutationMethod(request.method)) {
    return true;
  }
  if (response.statusCode >= 400 && requestUrl.pathname.startsWith('/api/')) {
    return true;
  }
  return false;
}

export function buildBridgeRequestAuditDetail(request, requestUrl, response, extra = {}) {
  return {
    requestId: crypto.randomUUID(),
    method: String(request.method || 'GET').toUpperCase(),
    path: requestUrl.pathname,
    query: requestUrl.search || '',
    statusCode: response.statusCode || 0,
    ip: normalizeRequestIp(request),
    origin: normalizeOrigin(request.headers.origin),
    contentLength: readInteger(request.headers['content-length'], 0),
    userAgent: String(request.headers['user-agent'] || '').trim() || null,
    ...extra
  };
}
