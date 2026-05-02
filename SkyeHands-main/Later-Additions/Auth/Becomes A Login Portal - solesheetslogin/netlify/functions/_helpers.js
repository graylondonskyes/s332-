const { TextEncoder } = require("util");
const crypto = require("crypto");
const cookie = require("cookie");
const { nanoid } = require("nanoid");
const { neon } = require("@neondatabase/serverless");
const { SignJWT, jwtVerify } = require("jose");

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "kxp_session";
const SESSION_AGE_SECONDS = Math.max(60, Number(process.env.AUTH_SESSION_AGE_SECONDS || (60 * 60 * 24 * 7)));
const PASSWORD_MIN_LENGTH = Math.max(10, Number(process.env.AUTH_PASSWORD_MIN_LENGTH || 10));
const LOGIN_FAIL_LIMIT = Math.max(3, Number(process.env.AUTH_LOGIN_FAIL_LIMIT || 5));
const LOGIN_LOCK_MINUTES = Math.max(1, Number(process.env.AUTH_LOGIN_LOCK_MINUTES || 15));
const PASSWORD_RESET_TTL_MINUTES = Math.max(5, Number(process.env.AUTH_PASSWORD_RESET_TTL_MINUTES || 60));
const EMAIL_VERIFY_TTL_HOURS = Math.max(1, Number(process.env.AUTH_EMAIL_VERIFY_TTL_HOURS || 48));
const ACTION_COOLDOWN_SECONDS = Math.max(15, Number(process.env.AUTH_EMAIL_ACTION_COOLDOWN_SECONDS || 60));
const OAUTH_CODE_TTL_SECONDS = Math.max(60, Number(process.env.AUTH_OAUTH_CODE_TTL_SECONDS || 300));
const ACCESS_TOKEN_TTL_SECONDS = Math.max(60, Number(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS || 3600));
const ID_TOKEN_TTL_SECONDS = Math.max(60, Number(process.env.AUTH_ID_TOKEN_TTL_SECONDS || 3600));
const COOKIE_DOMAIN = String(process.env.AUTH_COOKIE_DOMAIN || "").trim() || undefined;
const COOKIE_SAMESITE_RAW = String(process.env.AUTH_COOKIE_SAMESITE || "lax").trim().toLowerCase();

function envTrue(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

const REQUIRE_EMAIL_VERIFICATION = envTrue("AUTH_REQUIRE_EMAIL_VERIFICATION", false);
const AUTO_SEND_VERIFICATION = envTrue("AUTH_AUTO_SEND_VERIFICATION", true);


function normalizeSameSite(value) {
  const v = String(value || "lax").trim().toLowerCase();
  if (["strict", "lax", "none"].includes(v)) return v;
  return "lax";
}

function getCookieSameSite(secure) {
  const sameSite = normalizeSameSite(COOKIE_SAMESITE_RAW);
  if (sameSite === "none" && !secure) return "lax";
  return sameSite;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sha256Base64Url(value) {
  return base64UrlEncode(crypto.createHash("sha256").update(String(value)).digest());
}

function parseJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return fallback;
  }
}

function getIssuer(event) {
  const explicit = String(process.env.AUTH_ISSUER || process.env.AUTH_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = String(getHeader(event, "x-forwarded-host") || getHeader(event, "host") || "").trim();
  if (!host) return "";
  const proto = isHttps(event) ? "https" : "http";
  return `${proto}://${host}`;
}

function parseAllowedOriginsCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toOrigin(value) {
  try {
    return new URL(String(value)).origin;
  } catch (_err) {
    return "";
  }
}

function parseOauthClients() {
  const raw = String(process.env.AUTH_OAUTH_CLIENTS_JSON || "").trim();
  const parsed = raw ? parseJsonSafe(raw, null) : null;
  const out = {};

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const clientId = String(item.client_id || item.clientId || "").trim();
      if (!clientId) continue;
      out[clientId] = item;
    }
  } else if (parsed && typeof parsed === "object") {
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      out[String(key)] = { client_id: String(key), ...value };
    }
  }

  return out;
}

function normalizeClientConfig(clientId, raw) {
  if (!clientId || !raw || typeof raw !== "object") return null;
  const redirectUris = Array.from(new Set([...(raw.redirect_uris || raw.redirectUris || [])].map((u) => String(u).trim()).filter(Boolean)));
  const allowedOrigins = Array.from(new Set([
    ...(raw.allowed_origins || raw.allowedOrigins || []),
    ...redirectUris.map((u) => toOrigin(u)).filter(Boolean)
  ].map((u) => String(u).trim()).filter(Boolean)));
  const postLogoutRedirectUris = Array.from(new Set([...(raw.post_logout_redirect_uris || raw.postLogoutRedirectUris || redirectUris || [])].map((u) => String(u).trim()).filter(Boolean)));
  return {
    client_id: String(clientId),
    name: String(raw.name || clientId),
    redirect_uris: redirectUris,
    allowed_origins: allowedOrigins,
    post_logout_redirect_uris: postLogoutRedirectUris,
    default_scope: String(raw.default_scope || raw.defaultScope || "openid profile email"),
    public_client: raw.public_client !== false,
    pkce_required: raw.pkce_required !== false
  };
}

function getOauthClient(clientId) {
  const clients = parseOauthClients();
  return normalizeClientConfig(clientId, clients[String(clientId)]);
}

function isAllowedRedirectUri(client, redirectUri) {
  if (!client || !redirectUri) return false;
  return client.redirect_uris.includes(String(redirectUri));
}

function isAllowedPostLogoutUri(client, redirectUri) {
  if (!client || !redirectUri) return false;
  return client.post_logout_redirect_uris.includes(String(redirectUri));
}

function isAllowedCorsOrigin(origin, client) {
  const normalizedOrigin = toOrigin(origin);
  if (!normalizedOrigin) return false;
  const globalAllowed = parseAllowedOriginsCsv(process.env.AUTH_ALLOWED_ORIGINS);
  if (globalAllowed.includes(normalizedOrigin)) return true;
  if (client && Array.isArray(client.allowed_origins) && client.allowed_origins.includes(normalizedOrigin)) return true;
  if (envTrue("AUTH_ALLOW_LOCALHOST_CORS", true) && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) return true;
  return false;
}

function buildCorsHeaders(event, opts = {}) {
  const origin = String(getHeader(event, "origin") || "").trim();
  const allowAny = !!opts.allowAny;
  const allowCredentials = !!opts.allowCredentials;
  const client = opts.client || null;
  const allowOrigin = allowAny ? (origin || "*") : (isAllowedCorsOrigin(origin, client) ? origin : "");
  if (!allowOrigin) return {};
  const headers = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": (opts.allowMethods || ["GET", "POST", "OPTIONS"]).join(", "),
    "Access-Control-Allow-Headers": (opts.allowHeaders || ["Content-Type", "Authorization"]).join(", "),
    "Access-Control-Max-Age": String(opts.maxAge || 86400),
    Vary: allowAny ? "Origin" : "Origin"
  };
  if (allowCredentials && allowOrigin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  if (opts.exposeHeaders && opts.exposeHeaders.length) headers["Access-Control-Expose-Headers"] = opts.exposeHeaders.join(", ");
  return headers;
}

function withCors(event, response, opts = {}) {
  const cors = buildCorsHeaders(event, opts);
  return {
    ...response,
    headers: {
      ...(response.headers || {}),
      ...cors
    }
  };
}

function optionsResponse(event, opts = {}) {
  return withCors(event, {
    statusCode: 204,
    headers: { "Cache-Control": "no-store" },
    body: ""
  }, opts);
}

function parseAuthorizationBearer(event) {
  const value = String(getHeader(event, "authorization") || "").trim();
  if (!value || !/^Bearer\s+/i.test(value)) return "";
  return value.replace(/^Bearer\s+/i, "").trim();
}

async function signPurposeToken(payload, { issuer, audience, subject, purpose, ttlSeconds }) {
  return new SignJWT({ ...payload, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setExpirationTime(`${Math.max(60, Number(ttlSeconds || 3600))}s`)
    .sign(getJwtSecret());
}

async function verifyPurposeToken(token, { issuer, purpose }) {
  const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"], issuer });
  if (purpose && payload.purpose !== purpose) throw new Error("Token purpose mismatch");
  return payload;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    user_id: user.id,
    email: user.email,
    role: user.role,
    email_verified_at: user.email_verified_at || null,
    session_version: user.session_version,
    created_at: user.created_at || null,
    last_login_at: user.last_login_at || null,
    password_changed_at: user.password_changed_at || null
  };
}

function jsonResponse(statusCode, body, extraHeaders, extra = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(extraHeaders || {})
    },
    body: JSON.stringify(body),
    ...(extra || {})
  };
}

function redirectResponse(location, statusCode = 302) {
  return {
    statusCode,
    headers: {
      Location: location,
      "Cache-Control": "no-store"
    },
    body: ""
  };
}

function htmlResponse(statusCode, html, extraHeaders) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...(extraHeaders || {})
    },
    body: html
  };
}

function badRequest(msg, extra = {}) {
  return jsonResponse(400, { ok: false, error: msg || "Bad request", ...extra });
}

function unauthorized(msg, extra = {}) {
  return jsonResponse(401, { ok: false, error: msg || "Unauthorized", ...extra });
}

function methodNotAllowed(allowed) {
  return jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: Array.isArray(allowed) ? allowed.join(", ") : String(allowed || "") });
}

function tooManyRequests(msg, retryAfterSeconds, extra = {}) {
  const headers = {};
  if (retryAfterSeconds && retryAfterSeconds > 0) headers["Retry-After"] = String(retryAfterSeconds);
  return jsonResponse(429, { ok: false, error: msg || "Too many requests", ...extra }, headers);
}

function getHeader(event, name) {
  if (!event || !event.headers) return "";
  return event.headers[name] || event.headers[name.toLowerCase()] || event.headers[name.toUpperCase()] || "";
}

function parseBody(event) {
  if (!event || !event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    return JSON.parse(raw || "{}");
  } catch (_err) {
    return {};
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function getJwtSecret() {
  const s = process.env.CUSTOMER_JWT_SECRET || process.env.AUTH_SECRET || process.env.KAIXU_SERVICE_SECRET || "";
  if (!s || s.length < 24) throw new Error("Missing CUSTOMER_JWT_SECRET (or AUTH_SECRET) env var.");
  return new TextEncoder().encode(s);
}

async function signSession(payload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

async function verifySession(token) {
  const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ["HS256"] });
  return payload;
}

function isHttps(event) {
  const proto = getHeader(event, "x-forwarded-proto");
  return String(proto || "").toLowerCase() === "https";
}

function sessionCookie(token, secure) {
  const cookieSecure = !!secure || normalizeSameSite(COOKIE_SAMESITE_RAW) === "none";
  return cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: getCookieSameSite(cookieSecure),
    path: "/",
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    maxAge: SESSION_AGE_SECONDS
  });
}

function clearSessionCookie(secure) {
  const cookieSecure = !!secure || normalizeSameSite(COOKIE_SAMESITE_RAW) === "none";
  return cookie.serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: getCookieSameSite(cookieSecure),
    path: "/",
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    maxAge: 0,
    expires: new Date(0)
  });
}

function clearSessionCookieValues() {
  return [clearSessionCookie(false), clearSessionCookie(true)];
}

function getClientIp(event) {
  const direct = getHeader(event, "x-nf-client-connection-ip") || getHeader(event, "client-ip");
  if (direct) return String(direct).trim();
  const forwarded = getHeader(event, "x-forwarded-for");
  if (!forwarded) return "unknown";
  return String(forwarded).split(",")[0].trim() || "unknown";
}

function getUserAgent(event) {
  return String(getHeader(event, "user-agent") || "").slice(0, 500);
}

async function getDb() {
  const dsn = process.env.NEON_DATABASE_URL;
  if (!dsn) throw new Error("Missing NEON_DATABASE_URL env var.");
  return neon(dsn);
}

async function ensureAuthTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      email_normalized TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      session_version INTEGER NOT NULL DEFAULT 1,
      email_verified_at TIMESTAMPTZ,
      verification_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ,
      password_changed_at TIMESTAMPTZ
    )
  `;

  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_normalized TEXT`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`;
  await sql`UPDATE auth_users SET email_normalized = LOWER(BTRIM(email)), updated_at = NOW() WHERE email IS NOT NULL AND (email_normalized IS NULL OR email_normalized = '')`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_users_email_normalized ON auth_users (email_normalized)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users (role)`;

  const dupes = await sql`
    SELECT email_normalized
    FROM auth_users
    WHERE email_normalized IS NOT NULL AND email_normalized <> ''
    GROUP BY email_normalized
    HAVING COUNT(*) > 1
    LIMIT 1
  `;
  if (!dupes[0]) {
    try {
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_email_normalized_unique ON auth_users (email_normalized)`;
    } catch (_err) {
      // keep auth online even if a legacy dataset has duplicates
    }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      session_token_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      logout_reason TEXT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_id ON auth_sessions (session_token_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions (user_id, revoked_at, expires_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      subject TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      first_failed_at TIMESTAMPTZ,
      last_failed_at TIMESTAMPTZ,
      locked_until TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      email_sent_at TIMESTAMPTZ,
      resend_email_id TEXT,
      requested_ip TEXT,
      requested_user_agent TEXT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_email_verification_tokens_hash ON auth_email_verification_tokens (token_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_email_verification_tokens_user_id ON auth_email_verification_tokens (user_id, consumed_at, expires_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      email_sent_at TIMESTAMPTZ,
      resend_email_id TEXT,
      requested_ip TEXT,
      requested_user_agent TEXT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_hash ON auth_password_reset_tokens (token_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_password_reset_tokens_user_id ON auth_password_reset_tokens (user_id, consumed_at, expires_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_oauth_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT,
      nonce TEXT,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL DEFAULT 'S256',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      requested_ip TEXT,
      requested_user_agent TEXT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_oauth_codes_hash ON auth_oauth_codes (code_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_oauth_codes_lookup ON auth_oauth_codes (client_id, user_id, consumed_at, expires_at)`;

  try { await sql`DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '7 days'`; } catch (_err) {}
  try { await sql`DELETE FROM auth_login_attempts WHERE locked_until IS NOT NULL AND locked_until < NOW() - INTERVAL '7 days'`; } catch (_err) {}
  try { await sql`DELETE FROM auth_email_verification_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`; } catch (_err) {}
  try { await sql`DELETE FROM auth_password_reset_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`; } catch (_err) {}
  try { await sql`DELETE FROM auth_oauth_codes WHERE expires_at < NOW() - INTERVAL '7 days'`; } catch (_err) {}
}

async function findUserByEmail(sql, email) {
  await ensureAuthTables(sql);
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const rows = await sql`
    SELECT id, email, email_normalized, password_hash, role, session_version, email_verified_at, verification_sent_at, created_at, updated_at, last_login_at, password_changed_at
    FROM auth_users
    WHERE email_normalized = ${normalized}
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return rows[0] || null;
}

async function findUserById(sql, userId) {
  await ensureAuthTables(sql);
  const rows = await sql`
    SELECT id, email, email_normalized, password_hash, role, session_version, email_verified_at, verification_sent_at, created_at, updated_at, last_login_at, password_changed_at
    FROM auth_users
    WHERE id = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function createUser(sql, email, passwordHash, role) {
  await ensureAuthTables(sql);
  const normalized = normalizeEmail(email);
  const existing = await findUserByEmail(sql, normalized);
  if (existing) throw new Error("Account already exists for this email");

  const id = "u_" + nanoid(18);
  const rows = await sql`
    INSERT INTO auth_users (id, email, email_normalized, password_hash, role)
    VALUES (${id}, ${normalized}, ${normalized}, ${passwordHash}, ${role})
    RETURNING id, email, role, created_at, session_version, email_verified_at, verification_sent_at
  `;
  return rows[0];
}

async function updateUserPassword(sql, userId, passwordHash) {
  await ensureAuthTables(sql);
  const rows = await sql`
    UPDATE auth_users
    SET password_hash = ${passwordHash},
        session_version = session_version + 1,
        password_changed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, email, role, session_version, email_verified_at, password_changed_at
  `;
  return rows[0] || null;
}

async function markUserVerified(sql, userId) {
  await ensureAuthTables(sql);
  const rows = await sql`
    UPDATE auth_users
    SET email_verified_at = COALESCE(email_verified_at, NOW()),
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, email, role, session_version, email_verified_at, verification_sent_at
  `;
  return rows[0] || null;
}

async function touchVerificationSent(sql, userId) {
  try {
    await sql`UPDATE auth_users SET verification_sent_at = NOW(), updated_at = NOW() WHERE id = ${userId}`;
  } catch (_err) {
    // best effort
  }
}

async function touchLogin(sql, userId) {
  try {
    await sql`UPDATE auth_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ${userId}`;
  } catch (_err) {
    // best effort
  }
}

async function createSessionRecord(sql, user, event) {
  await ensureAuthTables(sql);
  const sessionId = "s_" + nanoid(24);
  const dbId = "ssn_" + nanoid(18);
  const expirySeconds = SESSION_AGE_SECONDS;
  const rows = await sql`
    INSERT INTO auth_sessions (id, user_id, session_token_id, ip_address, user_agent, expires_at)
    VALUES (
      ${dbId},
      ${user.id},
      ${sessionId},
      ${getClientIp(event)},
      ${getUserAgent(event)},
      NOW() + (${String(expirySeconds)} || ' seconds')::interval
    )
    RETURNING id, session_token_id, expires_at
  `;
  return rows[0];
}

async function touchSession(sql, sessionTokenId) {
  try {
    await sql`UPDATE auth_sessions SET last_seen_at = NOW() WHERE session_token_id = ${sessionTokenId} AND revoked_at IS NULL`;
  } catch (_err) {
    // best effort
  }
}

async function revokeSessionByTokenId(sql, sessionTokenId, reason = "logout") {
  await ensureAuthTables(sql);
  await sql`
    UPDATE auth_sessions
    SET revoked_at = NOW(), logout_reason = ${reason}
    WHERE session_token_id = ${sessionTokenId} AND revoked_at IS NULL
  `;
}

async function revokeAllSessionsForUser(sql, userId, reason = "session-reset") {
  await ensureAuthTables(sql);
  await sql`
    UPDATE auth_sessions
    SET revoked_at = NOW(), logout_reason = ${reason}
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
}

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => normalizeEmail(s))
    .filter(Boolean);
  return list.includes(normalizeEmail(email));
}

function getLoginAttemptSubjects(email, ip) {
  const subjects = [];
  const normalized = normalizeEmail(email);
  if (normalized) subjects.push(`email:${normalized}`);
  if (ip && ip !== "unknown") subjects.push(`ip:${String(ip).trim()}`);
  return Array.from(new Set(subjects));
}

async function getLoginLockState(sql, subjects) {
  await ensureAuthTables(sql);
  if (!subjects || !subjects.length) return null;
  const rows = await sql`
    SELECT subject, locked_until
    FROM auth_login_attempts
    WHERE subject = ANY(${subjects})
      AND locked_until IS NOT NULL
      AND locked_until > NOW()
    ORDER BY locked_until DESC
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(rows[0].locked_until).getTime() - Date.now()) / 1000));
  return {
    subject: rows[0].subject,
    lockedUntil: rows[0].locked_until,
    retryAfterSeconds
  };
}

async function recordLoginFailure(sql, subjects) {
  await ensureAuthTables(sql);
  for (const subject of subjects || []) {
    await sql`
      INSERT INTO auth_login_attempts (subject, fail_count, first_failed_at, last_failed_at, locked_until)
      VALUES (
        ${subject},
        1,
        NOW(),
        NOW(),
        CASE
          WHEN ${LOGIN_FAIL_LIMIT} <= 1 THEN NOW() + (${String(LOGIN_LOCK_MINUTES)} || ' minutes')::interval
          ELSE NULL
        END
      )
      ON CONFLICT (subject) DO UPDATE
      SET fail_count = auth_login_attempts.fail_count + 1,
          first_failed_at = COALESCE(auth_login_attempts.first_failed_at, NOW()),
          last_failed_at = NOW(),
          locked_until = CASE
            WHEN auth_login_attempts.fail_count + 1 >= ${LOGIN_FAIL_LIMIT}
              THEN NOW() + (${String(LOGIN_LOCK_MINUTES)} || ' minutes')::interval
            ELSE auth_login_attempts.locked_until
          END
    `;
  }
}

async function clearLoginFailures(sql, subjects) {
  await ensureAuthTables(sql);
  if (!subjects || !subjects.length) return;
  await sql`DELETE FROM auth_login_attempts WHERE subject = ANY(${subjects})`;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function generateRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function createEmailVerificationToken(sql, userId, event) {
  await ensureAuthTables(sql);
  const rawToken = generateRawToken();
  const tokenHash = sha256Hex(rawToken);
  const id = "evt_" + nanoid(18);
  const rows = await sql`
    INSERT INTO auth_email_verification_tokens (id, user_id, token_hash, expires_at, requested_ip, requested_user_agent)
    VALUES (
      ${id},
      ${userId},
      ${tokenHash},
      NOW() + (${String(EMAIL_VERIFY_TTL_HOURS)} || ' hours')::interval,
      ${getClientIp(event)},
      ${getUserAgent(event)}
    )
    RETURNING id, expires_at
  `;
  return { rawToken, record: rows[0] };
}

async function createPasswordResetToken(sql, userId, event) {
  await ensureAuthTables(sql);
  const rawToken = generateRawToken();
  const tokenHash = sha256Hex(rawToken);
  const id = "prt_" + nanoid(18);
  const rows = await sql`
    INSERT INTO auth_password_reset_tokens (id, user_id, token_hash, expires_at, requested_ip, requested_user_agent)
    VALUES (
      ${id},
      ${userId},
      ${tokenHash},
      NOW() + (${String(PASSWORD_RESET_TTL_MINUTES)} || ' minutes')::interval,
      ${getClientIp(event)},
      ${getUserAgent(event)}
    )
    RETURNING id, expires_at
  `;
  return { rawToken, record: rows[0] };
}

async function touchVerificationEmailSent(sql, tokenHash, emailId) {
  await ensureAuthTables(sql);
  await sql`
    UPDATE auth_email_verification_tokens
    SET email_sent_at = NOW(), resend_email_id = ${emailId || null}
    WHERE token_hash = ${tokenHash}
  `;
}

async function touchPasswordResetEmailSent(sql, tokenHash, emailId) {
  await ensureAuthTables(sql);
  await sql`
    UPDATE auth_password_reset_tokens
    SET email_sent_at = NOW(), resend_email_id = ${emailId || null}
    WHERE token_hash = ${tokenHash}
  `;
}

async function consumeEmailVerificationToken(sql, rawToken) {
  await ensureAuthTables(sql);
  const tokenHash = sha256Hex(rawToken);
  const rows = await sql`
    SELECT t.id, t.user_id, t.expires_at, t.consumed_at, u.email, u.role, u.session_version, u.email_verified_at
    FROM auth_email_verification_tokens t
    INNER JOIN auth_users u ON u.id = t.user_id
    WHERE t.token_hash = ${tokenHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Invalid verification token" };
  if (row.consumed_at) return { ok: false, error: "Verification token already used" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, error: "Verification token expired" };

  await sql`UPDATE auth_email_verification_tokens SET consumed_at = NOW() WHERE id = ${row.id} AND consumed_at IS NULL`;
  const user = await markUserVerified(sql, row.user_id);
  return { ok: true, user };
}

async function consumePasswordResetToken(sql, rawToken) {
  await ensureAuthTables(sql);
  const tokenHash = sha256Hex(rawToken);
  const rows = await sql`
    SELECT t.id, t.user_id, t.expires_at, t.consumed_at, u.email, u.role, u.session_version, u.email_verified_at
    FROM auth_password_reset_tokens t
    INNER JOIN auth_users u ON u.id = t.user_id
    WHERE t.token_hash = ${tokenHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Invalid reset token" };
  if (row.consumed_at) return { ok: false, error: "Reset token already used" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, error: "Reset token expired" };

  await sql`UPDATE auth_password_reset_tokens SET consumed_at = NOW() WHERE id = ${row.id} AND consumed_at IS NULL`;
  return { ok: true, user: row };
}

async function getRecentVerificationSend(sql, userId) {
  await ensureAuthTables(sql);
  const rows = await sql`
    SELECT created_at, expires_at
    FROM auth_email_verification_tokens
    WHERE user_id = ${userId}
      AND consumed_at IS NULL
      AND email_sent_at IS NOT NULL
      AND created_at > NOW() - (${String(ACTION_COOLDOWN_SECONDS)} || ' seconds')::interval
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

async function getRecentPasswordResetSend(sql, userId) {
  await ensureAuthTables(sql);
  const rows = await sql`
    SELECT created_at, expires_at
    FROM auth_password_reset_tokens
    WHERE user_id = ${userId}
      AND consumed_at IS NULL
      AND email_sent_at IS NOT NULL
      AND created_at > NOW() - (${String(ACTION_COOLDOWN_SECONDS)} || ' seconds')::interval
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}


async function createOauthAuthorizationCode(sql, { userId, clientId, redirectUri, scope, nonce, codeChallenge, codeChallengeMethod, event }) {
  await ensureAuthTables(sql);
  const rawCode = generateRawToken();
  const codeHash = sha256Hex(rawCode);
  const id = "oac_" + nanoid(18);
  const rows = await sql`
    INSERT INTO auth_oauth_codes (
      id,
      user_id,
      code_hash,
      client_id,
      redirect_uri,
      scope,
      nonce,
      code_challenge,
      code_challenge_method,
      expires_at,
      requested_ip,
      requested_user_agent
    )
    VALUES (
      ${id},
      ${userId},
      ${codeHash},
      ${clientId},
      ${redirectUri},
      ${scope || "openid profile email"},
      ${nonce || null},
      ${codeChallenge},
      ${String(codeChallengeMethod || "S256").toUpperCase()},
      NOW() + (${String(OAUTH_CODE_TTL_SECONDS)} || ' seconds')::interval,
      ${getClientIp(event)},
      ${getUserAgent(event)}
    )
    RETURNING id, expires_at
  `;
  return { rawCode, record: rows[0] || null };
}

async function consumeOauthAuthorizationCode(sql, { code, clientId, redirectUri }) {
  await ensureAuthTables(sql);
  const codeHash = sha256Hex(code);
  const rows = await sql`
    SELECT c.id, c.user_id, c.client_id, c.redirect_uri, c.scope, c.nonce, c.code_challenge, c.code_challenge_method, c.expires_at, c.consumed_at,
           u.id AS account_id, u.email, u.role, u.session_version, u.email_verified_at, u.created_at, u.last_login_at, u.password_changed_at
    FROM auth_oauth_codes c
    INNER JOIN auth_users u ON u.id = c.user_id
    WHERE c.code_hash = ${codeHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Invalid authorization code" };
  if (row.consumed_at) return { ok: false, error: "Authorization code already used" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, error: "Authorization code expired" };
  if (String(row.client_id) !== String(clientId)) return { ok: false, error: "Authorization code client mismatch" };
  if (String(row.redirect_uri) !== String(redirectUri)) return { ok: false, error: "Authorization code redirect mismatch" };

  await sql`UPDATE auth_oauth_codes SET consumed_at = NOW() WHERE id = ${row.id} AND consumed_at IS NULL`;
  return {
    ok: true,
    code: row,
    user: {
      id: row.account_id,
      email: row.email,
      role: row.role,
      session_version: row.session_version,
      email_verified_at: row.email_verified_at || null,
      created_at: row.created_at || null,
      last_login_at: row.last_login_at || null,
      password_changed_at: row.password_changed_at || null
    }
  };
}

function verifyPkce(codeVerifier, codeChallenge, method) {
  const normalizedMethod = String(method || "S256").toUpperCase();
  if (!codeVerifier || !codeChallenge) return false;
  if (normalizedMethod !== "S256") return false;
  return sha256Base64Url(codeVerifier) === String(codeChallenge);
}

async function issueOauthTokens(event, client, user, { scope, nonce } = {}) {
  const issuer = getIssuer(event);
  if (!issuer) throw new Error("Missing auth issuer/base URL.");
  const audience = client.client_id;
  const safeScope = String(scope || client.default_scope || "openid profile email").trim() || "openid profile email";
  const now = Math.floor(Date.now() / 1000);

  const accessPayload = {
    uid: user.id,
    email: user.email,
    role: user.role,
    email_verified: !!user.email_verified_at,
    scope: safeScope
  };

  const accessToken = await signPurposeToken(accessPayload, {
    issuer,
    audience,
    subject: user.id,
    purpose: "access_token",
    ttlSeconds: ACCESS_TOKEN_TTL_SECONDS
  });

  const idPayload = {
    email: user.email,
    email_verified: !!user.email_verified_at,
    role: user.role,
    ...(nonce ? { nonce } : {})
  };

  const idToken = await signPurposeToken(idPayload, {
    issuer,
    audience,
    subject: user.id,
    purpose: "id_token",
    ttlSeconds: ID_TOKEN_TTL_SECONDS
  });

  return {
    token_type: "Bearer",
    access_token: accessToken,
    id_token: idToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: safeScope,
    issued_at: now,
    user: sanitizeUser(user)
  };
}

async function authenticateAccessToken(event, sqlMaybe, opts = {}) {
  const token = parseAuthorizationBearer(event);
  if (!token) return { ok: false, error: "Missing bearer token" };
  const issuer = getIssuer(event);
  const sql = sqlMaybe || await getDb();
  await ensureAuthTables(sql);

  let payload;
  try {
    payload = await verifyPurposeToken(token, { issuer, purpose: "access_token" });
  } catch (err) {
    return { ok: false, error: err.message || "Invalid access token" };
  }

  const user = await findUserById(sql, payload.uid || payload.sub);
  if (!user) return { ok: false, error: "Account not found" };
  if (opts.audience && String(payload.aud || "") !== String(opts.audience)) {
    return { ok: false, error: "Access token audience mismatch" };
  }

  return { ok: true, token, payload, user, sql };
}

function buildAuthorizeRedirect(baseUrl, params = {}) {
  const u = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    u.searchParams.set(key, String(value));
  }
  return u.toString();
}

function appendQueryToUrl(baseUrl, params = {}) {
  const u = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    u.searchParams.set(key, String(value));
  }
  return u.toString();
}

function getAuthBaseUrl(event) {
  const explicit = String(process.env.AUTH_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const host = String(getHeader(event, "x-forwarded-host") || getHeader(event, "host") || "").trim();
  if (!host) return "";
  const proto = isHttps(event) ? "https" : "http";
  return `${proto}://${host}`;
}

function hasResendConfig() {
  return !!(process.env.RESEND_API_KEY && getResendFromEmail(false));
}

function getResendFromEmail(throwIfMissing = true) {
  const from = String(process.env.AUTH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "").trim();
  if (!from && throwIfMissing) throw new Error("Missing AUTH_FROM_EMAIL (or RESEND_FROM_EMAIL) env var.");
  return from;
}

function renderEmailShell({ title, intro, buttonText, buttonUrl, expiresText, footerNote }) {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro).replace(/\n/g, "<br/>");
  const safeButtonText = escapeHtml(buttonText);
  const safeButtonUrl = escapeHtml(buttonUrl);
  const safeExpiresText = expiresText ? `<p style="margin:18px 0 0;color:#d7d7de;line-height:1.7">${escapeHtml(expiresText)}</p>` : "";
  const safeFooter = footerNote ? `<p style="margin:18px 0 0;color:#a9acba;line-height:1.7">${escapeHtml(footerNote)}</p>` : "";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#060712;font-family:Arial,Helvetica,sans-serif;color:#f4f5f8;">
    <div style="max-width:640px;margin:0 auto;background:linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.16);border-radius:22px;padding:28px 24px;box-shadow:0 30px 70px rgba(0,0,0,.45);">
      <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#ffcf5a;margin-bottom:14px;">Skyes Over London Auth</div>
      <h1 style="margin:0 0 14px;font-size:28px;line-height:1.2;color:#ffffff;">${safeTitle}</h1>
      <p style="margin:0;color:#d7d7de;line-height:1.8;">${safeIntro}</p>
      <div style="margin-top:26px;">
        <a href="${safeButtonUrl}" style="display:inline-block;padding:13px 18px;border-radius:14px;background:linear-gradient(135deg, rgba(255,207,90,.95), rgba(124,58,237,.92));color:#08080d;text-decoration:none;font-weight:700;">${safeButtonText}</a>
      </div>
      ${safeExpiresText}
      <p style="margin:18px 0 0;color:#a9acba;line-height:1.7;word-break:break-all;">If the button does not open, use this link:<br>${safeButtonUrl}</p>
      ${safeFooter}
    </div>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendResendEmail({ to, subject, html, text, tags, idempotencyKey }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("Missing RESEND_API_KEY env var.");
  const from = getResendFromEmail(true);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "skyes-auth-portal/1.2",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(Array.isArray(tags) && tags.length ? { tags } : {})
    })
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_err) {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload && (payload.message || payload.error || JSON.stringify(payload));
    throw new Error(detail || `Resend request failed (${response.status})`);
  }

  return payload || {};
}

async function sendVerificationEmail(event, sql, user) {
  if (!hasResendConfig()) {
    return { ok: false, skipped: true, error: "Resend is not configured" };
  }
  if (user.email_verified_at) {
    return { ok: true, skipped: true, alreadyVerified: true };
  }
  const recent = await getRecentVerificationSend(sql, user.id);
  if (recent) {
    return { ok: true, skipped: true, recentlySent: true };
  }

  const baseUrl = getAuthBaseUrl(event);
  if (!baseUrl) throw new Error("Missing AUTH_BASE_URL or request host; cannot build verification link.");

  const { rawToken } = await createEmailVerificationToken(sql, user.id, event);
  const tokenHash = sha256Hex(rawToken);
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const subject = "Verify your email";
  const html = renderEmailShell({
    title: "Verify your email",
    intro: `Finish verifying ${user.email} so this login portal can trust the account before opening verified-only project surfaces.`,
    buttonText: "Verify email",
    buttonUrl: verifyUrl,
    expiresText: `This link expires in ${EMAIL_VERIFY_TTL_HOURS} hour(s).`,
    footerNote: "If you did not create this account, you can ignore this message."
  });
  const text = `Verify your email for ${user.email}\n\nOpen this link: ${verifyUrl}\n\nThis link expires in ${EMAIL_VERIFY_TTL_HOURS} hour(s).`;
  const payload = await sendResendEmail({
    to: user.email,
    subject,
    html,
    text,
    tags: [{ name: "type", value: "email_verification" }],
    idempotencyKey: `verify-${user.id}-${tokenHash.slice(0, 24)}`
  });
  await touchVerificationEmailSent(sql, tokenHash, payload.id || null);
  await touchVerificationSent(sql, user.id);
  return { ok: true, emailId: payload.id || null };
}

async function sendPasswordResetEmail(event, sql, user) {
  if (!hasResendConfig()) {
    return { ok: false, skipped: true, error: "Resend is not configured" };
  }
  const recent = await getRecentPasswordResetSend(sql, user.id);
  if (recent) {
    return { ok: true, skipped: true, recentlySent: true };
  }

  const baseUrl = getAuthBaseUrl(event);
  if (!baseUrl) throw new Error("Missing AUTH_BASE_URL or request host; cannot build reset link.");

  const { rawToken } = await createPasswordResetToken(sql, user.id, event);
  const tokenHash = sha256Hex(rawToken);
  const resetUrl = `${baseUrl}/index.html?mode=reset&token=${encodeURIComponent(rawToken)}`;
  const subject = "Reset your password";
  const html = renderEmailShell({
    title: "Reset your password",
    intro: `A password reset was requested for ${user.email}. Use the button below to create a new password.`,
    buttonText: "Reset password",
    buttonUrl: resetUrl,
    expiresText: `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minute(s).`,
    footerNote: "If you did not ask to reset your password, you can ignore this message."
  });
  const text = `Reset your password for ${user.email}\n\nOpen this link: ${resetUrl}\n\nThis link expires in ${PASSWORD_RESET_TTL_MINUTES} minute(s).`;
  const payload = await sendResendEmail({
    to: user.email,
    subject,
    html,
    text,
    tags: [{ name: "type", value: "password_reset" }],
    idempotencyKey: `reset-${user.id}-${tokenHash.slice(0, 24)}`
  });
  await touchPasswordResetEmailSent(sql, tokenHash, payload.id || null);
  return { ok: true, emailId: payload.id || null };
}

async function authenticateRequest(event, sqlMaybe) {
  const sql = sqlMaybe || await getDb();
  await ensureAuthTables(sql);

  const cookies = cookie.parse(getHeader(event, "cookie") || "");
  const token = cookies[COOKIE_NAME];
  if (!token) return { ok: false, error: "Not authenticated", sql };

  let payload;
  try {
    payload = await verifySession(token);
  } catch (_err) {
    return { ok: false, error: "Invalid or expired session", sql };
  }

  const user = await findUserById(sql, payload.uid);
  if (!user) return { ok: false, error: "Account not found", sql };
  if (!payload.sid) return { ok: false, error: "Session missing token id", sql };
  if (Number(payload.sv || 0) !== Number(user.session_version || 0)) {
    return { ok: false, error: "Session is no longer valid", sql };
  }

  const rows = await sql`
    SELECT id, session_token_id, expires_at, revoked_at
    FROM auth_sessions
    WHERE session_token_id = ${String(payload.sid)}
      AND user_id = ${user.id}
    LIMIT 1
  `;
  const session = rows[0];
  if (!session) return { ok: false, error: "Session not found", sql };
  if (session.revoked_at) return { ok: false, error: "Session has been revoked", sql };
  if (new Date(session.expires_at).getTime() <= Date.now()) return { ok: false, error: "Session has expired", sql };

  await touchSession(sql, session.session_token_id);
  return { ok: true, sql, token, payload, user, session };
}

async function issueSessionResponse(event, sql, user) {
  const session = await createSessionRecord(sql, user, event);
  const token = await signSession({
    uid: user.id,
    email: user.email,
    role: user.role,
    sid: session.session_token_id,
    sv: user.session_version
  });

  return {
    token,
    session,
    secure: isHttps(event),
    setCookie: sessionCookie(token, isHttps(event))
  };
}

module.exports = {
  COOKIE_NAME,
  PASSWORD_MIN_LENGTH,
  SESSION_AGE_SECONDS,
  LOGIN_FAIL_LIMIT,
  LOGIN_LOCK_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  EMAIL_VERIFY_TTL_HOURS,
  ACTION_COOLDOWN_SECONDS,
  OAUTH_CODE_TTL_SECONDS,
  ACCESS_TOKEN_TTL_SECONDS,
  ID_TOKEN_TTL_SECONDS,
  REQUIRE_EMAIL_VERIFICATION,
  AUTO_SEND_VERIFICATION,
  jsonResponse,
  redirectResponse,
  htmlResponse,
  badRequest,
  unauthorized,
  methodNotAllowed,
  tooManyRequests,
  parseBody,
  normalizeEmail,
  isValidEmail,
  signSession,
  verifySession,
  signPurposeToken,
  verifyPurposeToken,
  sessionCookie,
  clearSessionCookie,
  clearSessionCookieValues,
  isHttps,
  getClientIp,
  getUserAgent,
  getDb,
  ensureAuthTables,
  findUserByEmail,
  findUserById,
  createUser,
  updateUserPassword,
  markUserVerified,
  touchVerificationSent,
  touchLogin,
  createSessionRecord,
  revokeSessionByTokenId,
  revokeAllSessionsForUser,
  isAdminEmail,
  getLoginAttemptSubjects,
  getLoginLockState,
  recordLoginFailure,
  clearLoginFailures,
  sha256Hex,
  sha256Base64Url,
  createEmailVerificationToken,
  createPasswordResetToken,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createOauthAuthorizationCode,
  consumeOauthAuthorizationCode,
  verifyPkce,
  issueOauthTokens,
  authenticateAccessToken,
  getAuthBaseUrl,
  getIssuer,
  parseOauthClients,
  getOauthClient,
  isAllowedRedirectUri,
  isAllowedPostLogoutUri,
  buildAuthorizeRedirect,
  appendQueryToUrl,
  buildCorsHeaders,
  withCors,
  optionsResponse,
  parseAuthorizationBearer,
  hasResendConfig,
  getResendFromEmail,
  sendResendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  authenticateRequest,
  issueSessionResponse,
  sanitizeUser,
  escapeHtml
};
