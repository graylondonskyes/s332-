const crypto = require("crypto");
const { nanoid } = require("nanoid");
const {
  SignJWT,
  jwtVerify,
  generateKeyPair,
  exportJWK,
  exportPKCS8,
  exportSPKI,
  importSPKI,
  importPKCS8,
  decodeProtectedHeader
} = require("jose");
const helpers = require("./_helpers");

const REFRESH_TOKEN_TTL_DAYS = Math.max(1, Number(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS || 30));
const CONSENT_TTL_DAYS = Math.max(1, Number(process.env.AUTH_CONSENT_TTL_DAYS || 365));
const KEY_VERIFY_GRACE_DAYS = Math.max(1, Number(process.env.AUTH_JWKS_ROTATION_GRACE_DAYS || 30));
const KEY_SIZE = Math.max(2048, Number(process.env.AUTH_JWKS_RSA_BITS || 2048));

function parseJsonSafe(raw, fallback) {
  try { return JSON.parse(raw); } catch (_err) { return fallback; }
}

function randomToken(size = 32) {
  return crypto.randomBytes(size).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function scopeArray(scope) {
  return String(scope || "")
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function scopeString(scope) {
  return Array.from(new Set(scopeArray(scope))).join(" ");
}

function scopeIncludes(existingScope, requestedScope) {
  const have = new Set(scopeArray(existingScope));
  const need = scopeArray(requestedScope);
  return need.every((item) => have.has(item));
}

function normalizeArrayInput(value) {
  if (Array.isArray(value)) return Array.from(new Set(value.map((v) => String(v || "").trim()).filter(Boolean)));
  return Array.from(new Set(String(value || "")
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean)));
}

function normalizeBool(value, fallback) {
  if (value === undefined || value === null || value === "") return !!fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function toOrigin(value) {
  try {
    return new URL(String(value)).origin;
  } catch (_err) {
    return "";
  }
}

function normalizeClientObject(input = {}) {
  const redirectUris = normalizeArrayInput(input.redirect_uris || input.redirectUris);
  const derivedOrigins = redirectUris.map((u) => toOrigin(u)).filter(Boolean);
  const allowedOrigins = Array.from(new Set([
    ...normalizeArrayInput(input.allowed_origins || input.allowedOrigins),
    ...derivedOrigins
  ]));
  const postLogoutRedirectUris = Array.from(new Set([
    ...normalizeArrayInput(input.post_logout_redirect_uris || input.postLogoutRedirectUris),
    ...redirectUris
  ]));

  return {
    client_id: String(input.client_id || input.clientId || "").trim(),
    name: String(input.name || input.client_id || input.clientId || "").trim() || "OAuth Client",
    redirect_uris: redirectUris,
    allowed_origins: allowedOrigins,
    post_logout_redirect_uris: postLogoutRedirectUris,
    default_scope: scopeString(input.default_scope || input.defaultScope || "openid profile email offline_access") || "openid profile email offline_access",
    public_client: normalizeBool(input.public_client ?? input.publicClient, true),
    pkce_required: normalizeBool(input.pkce_required ?? input.pkceRequired, true),
    allow_refresh_tokens: normalizeBool(input.allow_refresh_tokens ?? input.allowRefreshTokens, true),
    consent_required: normalizeBool(input.consent_required ?? input.consentRequired, true),
    is_active: normalizeBool(input.is_active ?? input.isActive, true),
    created_by: String(input.created_by || input.createdBy || "system").trim() || "system"
  };
}

function rowToClient(row) {
  if (!row) return null;
  return normalizeClientObject({
    client_id: row.client_id,
    name: row.name,
    redirect_uris: parseJsonSafe(row.redirect_uris_json, []),
    allowed_origins: parseJsonSafe(row.allowed_origins_json, []),
    post_logout_redirect_uris: parseJsonSafe(row.post_logout_redirect_uris_json, []),
    default_scope: row.default_scope,
    public_client: row.public_client,
    pkce_required: row.pkce_required,
    allow_refresh_tokens: row.allow_refresh_tokens,
    consent_required: row.consent_required,
    is_active: row.is_active,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  });
}

async function ensureOauthInfra(sql) {
  await helpers.ensureAuthTables(sql);

  await sql`
    CREATE TABLE IF NOT EXISTS auth_oauth_clients (
      client_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      redirect_uris_json TEXT NOT NULL,
      allowed_origins_json TEXT NOT NULL,
      post_logout_redirect_uris_json TEXT NOT NULL,
      default_scope TEXT NOT NULL DEFAULT 'openid profile email offline_access',
      public_client BOOLEAN NOT NULL DEFAULT TRUE,
      pkce_required BOOLEAN NOT NULL DEFAULT TRUE,
      allow_refresh_tokens BOOLEAN NOT NULL DEFAULT TRUE,
      consent_required BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE auth_oauth_clients ADD COLUMN IF NOT EXISTS allow_refresh_tokens BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE auth_oauth_clients ADD COLUMN IF NOT EXISTS consent_required BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE auth_oauth_clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE auth_oauth_clients ADD COLUMN IF NOT EXISTS created_by TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_oauth_clients_active ON auth_oauth_clients (is_active)`;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_oauth_consents (
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      PRIMARY KEY (user_id, client_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_oauth_refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      scope TEXT,
      nonce TEXT,
      session_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      replaced_by_id TEXT,
      requested_ip TEXT,
      requested_user_agent TEXT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_oauth_refresh_tokens_hash ON auth_oauth_refresh_tokens (token_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_oauth_refresh_tokens_user ON auth_oauth_refresh_tokens (user_id, client_id, revoked_at, expires_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_signing_keys (
      id TEXT PRIMARY KEY,
      kid TEXT NOT NULL,
      alg TEXT NOT NULL DEFAULT 'RS256',
      public_jwk_json TEXT NOT NULL,
      public_pem TEXT NOT NULL,
      private_pem TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      retired_at TIMESTAMPTZ,
      verify_until TIMESTAMPTZ NOT NULL,
      rotation_note TEXT
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_signing_keys_kid ON auth_signing_keys (kid)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_auth_signing_keys_status ON auth_signing_keys (status, verify_until)`;

  await syncEnvClientsToDb(sql);
  await ensureActiveSigningKey(sql);

  try { await sql`DELETE FROM auth_oauth_refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`; } catch (_err) {}
  try { await sql`DELETE FROM auth_signing_keys WHERE status = 'retired' AND verify_until < NOW() - INTERVAL '1 day'`; } catch (_err) {}
}

async function syncEnvClientsToDb(sql) {
  const envClients = helpers.parseOauthClients();
  for (const [clientId, raw] of Object.entries(envClients || {})) {
    const client = normalizeClientObject({ client_id: clientId, ...raw, created_by: "env" });
    if (!client.client_id || !client.redirect_uris.length) continue;
    await sql`
      INSERT INTO auth_oauth_clients (
        client_id, name, redirect_uris_json, allowed_origins_json, post_logout_redirect_uris_json,
        default_scope, public_client, pkce_required, allow_refresh_tokens, consent_required, is_active, created_by, updated_at
      ) VALUES (
        ${client.client_id},
        ${client.name},
        ${JSON.stringify(client.redirect_uris)},
        ${JSON.stringify(client.allowed_origins)},
        ${JSON.stringify(client.post_logout_redirect_uris)},
        ${client.default_scope},
        ${client.public_client},
        ${client.pkce_required},
        ${client.allow_refresh_tokens},
        ${client.consent_required},
        ${client.is_active},
        ${client.created_by},
        NOW()
      )
      ON CONFLICT (client_id) DO UPDATE SET
        name = EXCLUDED.name,
        redirect_uris_json = EXCLUDED.redirect_uris_json,
        allowed_origins_json = EXCLUDED.allowed_origins_json,
        post_logout_redirect_uris_json = EXCLUDED.post_logout_redirect_uris_json,
        default_scope = EXCLUDED.default_scope,
        public_client = EXCLUDED.public_client,
        pkce_required = EXCLUDED.pkce_required,
        allow_refresh_tokens = EXCLUDED.allow_refresh_tokens,
        consent_required = EXCLUDED.consent_required,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
    `;
  }
}

async function listOauthClients(sql) {
  await ensureOauthInfra(sql);
  const rows = await sql`
    SELECT client_id, name, redirect_uris_json, allowed_origins_json, post_logout_redirect_uris_json,
           default_scope, public_client, pkce_required, allow_refresh_tokens, consent_required, is_active,
           created_by, created_at, updated_at
    FROM auth_oauth_clients
    ORDER BY created_at ASC, client_id ASC
  `;
  return rows.map(rowToClient);
}

async function getOauthClient(sql, clientId) {
  await ensureOauthInfra(sql);
  const id = String(clientId || "").trim();
  if (!id) return null;
  const rows = await sql`
    SELECT client_id, name, redirect_uris_json, allowed_origins_json, post_logout_redirect_uris_json,
           default_scope, public_client, pkce_required, allow_refresh_tokens, consent_required, is_active,
           created_by, created_at, updated_at
    FROM auth_oauth_clients
    WHERE client_id = ${id}
    LIMIT 1
  `;
  const client = rowToClient(rows[0]);
  if (!client || !client.is_active) return null;
  return client;
}

async function saveOauthClient(sql, input, actor) {
  await ensureOauthInfra(sql);
  const normalized = normalizeClientObject(input);
  if (!normalized.client_id) normalized.client_id = "client_" + nanoid(12);
  if (!normalized.name) throw new Error("Client name is required");
  if (!normalized.redirect_uris.length) throw new Error("At least one redirect URI is required");
  normalized.created_by = String(actor?.email || normalized.created_by || "admin");

  const rows = await sql`
    INSERT INTO auth_oauth_clients (
      client_id, name, redirect_uris_json, allowed_origins_json, post_logout_redirect_uris_json,
      default_scope, public_client, pkce_required, allow_refresh_tokens, consent_required,
      is_active, created_by, updated_at
    ) VALUES (
      ${normalized.client_id},
      ${normalized.name},
      ${JSON.stringify(normalized.redirect_uris)},
      ${JSON.stringify(normalized.allowed_origins)},
      ${JSON.stringify(normalized.post_logout_redirect_uris)},
      ${normalized.default_scope},
      ${normalized.public_client},
      ${normalized.pkce_required},
      ${normalized.allow_refresh_tokens},
      ${normalized.consent_required},
      ${normalized.is_active},
      ${normalized.created_by},
      NOW()
    )
    ON CONFLICT (client_id) DO UPDATE SET
      name = EXCLUDED.name,
      redirect_uris_json = EXCLUDED.redirect_uris_json,
      allowed_origins_json = EXCLUDED.allowed_origins_json,
      post_logout_redirect_uris_json = EXCLUDED.post_logout_redirect_uris_json,
      default_scope = EXCLUDED.default_scope,
      public_client = EXCLUDED.public_client,
      pkce_required = EXCLUDED.pkce_required,
      allow_refresh_tokens = EXCLUDED.allow_refresh_tokens,
      consent_required = EXCLUDED.consent_required,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING client_id, name, redirect_uris_json, allowed_origins_json, post_logout_redirect_uris_json,
      default_scope, public_client, pkce_required, allow_refresh_tokens, consent_required, is_active,
      created_by, created_at, updated_at
  `;

  return rowToClient(rows[0]);
}

async function deleteOauthClient(sql, clientId) {
  await ensureOauthInfra(sql);
  const id = String(clientId || "").trim();
  if (!id) throw new Error("client_id is required");
  await sql`DELETE FROM auth_oauth_consents WHERE client_id = ${id}`;
  await sql`UPDATE auth_oauth_refresh_tokens SET revoked_at = NOW() WHERE client_id = ${id} AND revoked_at IS NULL`;
  await sql`DELETE FROM auth_oauth_clients WHERE client_id = ${id}`;
  return { ok: true, client_id: id };
}

function isAllowedRedirectUri(client, redirectUri) {
  if (!client || !redirectUri) return false;
  return (client.redirect_uris || []).includes(String(redirectUri));
}

function isAllowedPostLogoutUri(client, redirectUri) {
  if (!client || !redirectUri) return false;
  return (client.post_logout_redirect_uris || []).includes(String(redirectUri));
}

async function getConsent(sql, userId, clientId) {
  await ensureOauthInfra(sql);
  const rows = await sql`
    SELECT user_id, client_id, scope, created_at, updated_at, revoked_at
    FROM auth_oauth_consents
    WHERE user_id = ${userId}
      AND client_id = ${clientId}
      AND updated_at > NOW() - (${String(CONSENT_TTL_DAYS)} || ' days')::interval
    LIMIT 1
  `;
  const row = rows[0] || null;
  if (!row || row.revoked_at) return null;
  return row;
}

async function saveConsent(sql, { userId, clientId, scope }) {
  await ensureOauthInfra(sql);
  const safeScope = scopeString(scope) || "openid profile email";
  const rows = await sql`
    INSERT INTO auth_oauth_consents (user_id, client_id, scope, created_at, updated_at, revoked_at)
    VALUES (${userId}, ${clientId}, ${safeScope}, NOW(), NOW(), NULL)
    ON CONFLICT (user_id, client_id) DO UPDATE SET
      scope = EXCLUDED.scope,
      updated_at = NOW(),
      revoked_at = NULL
    RETURNING user_id, client_id, scope, created_at, updated_at, revoked_at
  `;
  return rows[0] || null;
}

function isConsentRequired(client, consent, requestedScope, prompt) {
  const promptList = String(prompt || "").split(/\s+/).filter(Boolean);
  if (promptList.includes("consent")) return true;
  if (!client?.consent_required) return false;
  if (!consent) return true;
  if (!scopeIncludes(consent.scope, requestedScope)) return true;
  return false;
}

async function createRefreshToken(sql, { user, client, scope, nonce, event }) {
  await ensureOauthInfra(sql);
  const rawToken = randomToken(40);
  const tokenHash = helpers.sha256Hex(rawToken);
  const id = "ort_" + nanoid(18);
  const rows = await sql`
    INSERT INTO auth_oauth_refresh_tokens (
      id, user_id, client_id, token_hash, scope, nonce, session_version,
      expires_at, requested_ip, requested_user_agent
    ) VALUES (
      ${id},
      ${user.id},
      ${client.client_id},
      ${tokenHash},
      ${scopeString(scope) || client.default_scope || 'openid profile email offline_access'},
      ${nonce || null},
      ${Number(user.session_version || 1)},
      NOW() + (${String(REFRESH_TOKEN_TTL_DAYS)} || ' days')::interval,
      ${helpers.getClientIp(event)},
      ${helpers.getUserAgent(event)}
    )
    RETURNING id, expires_at
  `;
  return { rawToken, record: rows[0] || null };
}

async function consumeRefreshToken(sql, { refreshToken, clientId }) {
  await ensureOauthInfra(sql);
  const tokenHash = helpers.sha256Hex(refreshToken);
  const rows = await sql`
    SELECT rt.id, rt.user_id, rt.client_id, rt.scope, rt.nonce, rt.session_version, rt.created_at,
           rt.last_used_at, rt.expires_at, rt.consumed_at, rt.revoked_at, rt.replaced_by_id,
           u.id AS account_id, u.email, u.role, u.session_version AS live_session_version,
           u.email_verified_at, u.created_at AS user_created_at, u.last_login_at, u.password_changed_at
    FROM auth_oauth_refresh_tokens rt
    INNER JOIN auth_users u ON u.id = rt.user_id
    WHERE rt.token_hash = ${tokenHash}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Invalid refresh token" };
  if (String(row.client_id) !== String(clientId)) return { ok: false, error: "Refresh token client mismatch" };
  if (row.revoked_at) return { ok: false, error: "Refresh token revoked" };
  if (row.consumed_at) return { ok: false, error: "Refresh token already rotated" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, error: "Refresh token expired" };
  if (Number(row.live_session_version || 0) !== Number(row.session_version || 0)) return { ok: false, error: "Refresh token no longer valid for this account" };
  return {
    ok: true,
    token: row,
    user: {
      id: row.account_id,
      email: row.email,
      role: row.role,
      session_version: row.live_session_version,
      email_verified_at: row.email_verified_at || null,
      created_at: row.user_created_at || null,
      last_login_at: row.last_login_at || null,
      password_changed_at: row.password_changed_at || null
    }
  };
}

async function markRefreshTokenRotated(sql, currentId, nextId) {
  await sql`
    UPDATE auth_oauth_refresh_tokens
    SET consumed_at = NOW(), replaced_by_id = ${nextId || null}, last_used_at = NOW()
    WHERE id = ${currentId} AND consumed_at IS NULL AND revoked_at IS NULL
  `;
}

async function revokeClientRefreshTokens(sql, userId, clientId, reason = 'client-logout') {
  await ensureOauthInfra(sql);
  await sql`
    UPDATE auth_oauth_refresh_tokens
    SET revoked_at = NOW(), replaced_by_id = COALESCE(replaced_by_id, ${reason})
    WHERE user_id = ${userId} AND client_id = ${clientId} AND revoked_at IS NULL
  `;
}

async function generateSigningKeyRecord(note) {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { modulusLength: KEY_SIZE });
  const publicJwk = await exportJWK(publicKey);
  const publicPem = await exportSPKI(publicKey);
  const privatePem = await exportPKCS8(privateKey);
  const kid = "kid_" + nanoid(16);
  return {
    id: "key_" + nanoid(18),
    kid,
    alg: "RS256",
    public_jwk_json: JSON.stringify({ ...publicJwk, use: "sig", kid, alg: "RS256" }),
    public_pem: publicPem,
    private_pem: privatePem,
    rotation_note: note || null
  };
}

async function ensureActiveSigningKey(sql) {
  const rows = await sql`
    SELECT id, kid, alg, public_jwk_json, public_pem, private_pem, status, created_at, activated_at, retired_at, verify_until, rotation_note
    FROM auth_signing_keys
    WHERE status = 'active'
    ORDER BY activated_at DESC, created_at DESC
    LIMIT 1
  `;
  if (rows[0]) return rows[0];

  const created = await generateSigningKeyRecord("initial");
  const inserted = await sql`
    INSERT INTO auth_signing_keys (
      id, kid, alg, public_jwk_json, public_pem, private_pem,
      status, activated_at, verify_until, rotation_note
    ) VALUES (
      ${created.id}, ${created.kid}, ${created.alg}, ${created.public_jwk_json}, ${created.public_pem}, ${created.private_pem},
      'active', NOW(), NOW() + INTERVAL '3650 days', ${created.rotation_note}
    )
    RETURNING id, kid, alg, public_jwk_json, public_pem, private_pem, status, created_at, activated_at, retired_at, verify_until, rotation_note
  `;
  return inserted[0];
}

async function rotateSigningKeys(sql, note) {
  await ensureOauthInfra(sql);
  const current = await ensureActiveSigningKey(sql);
  const next = await generateSigningKeyRecord(note || "manual rotation");
  await sql`UPDATE auth_signing_keys SET status = 'retired', retired_at = NOW(), verify_until = NOW() + (${String(KEY_VERIFY_GRACE_DAYS)} || ' days')::interval WHERE id = ${current.id}`;
  const inserted = await sql`
    INSERT INTO auth_signing_keys (
      id, kid, alg, public_jwk_json, public_pem, private_pem,
      status, activated_at, verify_until, rotation_note
    ) VALUES (
      ${next.id}, ${next.kid}, ${next.alg}, ${next.public_jwk_json}, ${next.public_pem}, ${next.private_pem},
      'active', NOW(), NOW() + INTERVAL '3650 days', ${next.rotation_note}
    )
    RETURNING id, kid, alg, public_jwk_json, public_pem, private_pem, status, created_at, activated_at, retired_at, verify_until, rotation_note
  `;
  return { previous: current, current: inserted[0] };
}

async function listSigningKeys(sql) {
  await ensureOauthInfra(sql);
  const rows = await sql`
    SELECT id, kid, alg, public_jwk_json, public_pem, status, created_at, activated_at, retired_at, verify_until, rotation_note
    FROM auth_signing_keys
    WHERE status = 'active' OR verify_until > NOW()
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, activated_at DESC, created_at DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    kid: row.kid,
    alg: row.alg,
    status: row.status,
    created_at: row.created_at,
    activated_at: row.activated_at,
    retired_at: row.retired_at,
    verify_until: row.verify_until,
    rotation_note: row.rotation_note,
    public_jwk: parseJsonSafe(row.public_jwk_json, null)
  }));
}

async function getPublishedSigningKeys(sql) {
  await ensureOauthInfra(sql);
  const rows = await sql`
    SELECT id, kid, alg, public_jwk_json, public_pem, private_pem, status, created_at, activated_at, retired_at, verify_until, rotation_note
    FROM auth_signing_keys
    WHERE status = 'active' OR verify_until > NOW()
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, activated_at DESC, created_at DESC
  `;
  return rows;
}

async function getSigningKeyByKid(sql, kid) {
  await ensureOauthInfra(sql);
  const rows = await sql`
    SELECT id, kid, alg, public_jwk_json, public_pem, private_pem, status, created_at, activated_at, retired_at, verify_until, rotation_note
    FROM auth_signing_keys
    WHERE kid = ${kid}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.status !== 'active' && new Date(row.verify_until).getTime() <= Date.now()) return null;
  return row;
}

async function getJwks(sql) {
  const rows = await getPublishedSigningKeys(sql);
  return {
    keys: rows.map((row) => parseJsonSafe(row.public_jwk_json, null)).filter(Boolean)
  };
}

async function signPublicJwt(sql, payload, { issuer, audience, subject, purpose, ttlSeconds, extraHeaders = {} }) {
  const key = await ensureActiveSigningKey(sql);
  const privateKey = await importPKCS8(key.private_pem, key.alg || "RS256");
  return new SignJWT({ ...payload, purpose })
    .setProtectedHeader({ alg: key.alg || "RS256", kid: key.kid, typ: "JWT", ...extraHeaders })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setExpirationTime(`${Math.max(60, Number(ttlSeconds || 3600))}s`)
    .sign(privateKey);
}

async function verifyPublicJwt(sql, token, { issuer, audience, purpose }) {
  const header = decodeProtectedHeader(token);
  const kid = String(header.kid || "").trim();
  if (!kid) throw new Error("JWT missing kid header");
  const key = await getSigningKeyByKid(sql, kid);
  if (!key) throw new Error("Signing key not found");
  const publicKey = await importSPKI(key.public_pem, key.alg || "RS256");
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [key.alg || "RS256"],
    issuer,
    ...(audience ? { audience } : {})
  });
  if (purpose && payload.purpose !== purpose) throw new Error("Token purpose mismatch");
  return { payload, header, key };
}

async function issueOauthTokens(event, sql, client, user, { scope, nonce, includeRefreshToken = true } = {}) {
  await ensureOauthInfra(sql);
  const issuer = helpers.getIssuer(event);
  if (!issuer) throw new Error("Missing auth issuer/base URL.");
  const audience = client.client_id;
  const safeScope = scopeString(scope || client.default_scope || "openid profile email offline_access") || "openid profile email offline_access";
  const accessPayload = {
    uid: user.id,
    email: user.email,
    role: user.role,
    email_verified: !!user.email_verified_at,
    scope: safeScope
  };
  const accessToken = await signPublicJwt(sql, accessPayload, {
    issuer,
    audience,
    subject: user.id,
    purpose: "access_token",
    ttlSeconds: helpers.ACCESS_TOKEN_TTL_SECONDS
  });

  const idPayload = {
    email: user.email,
    email_verified: !!user.email_verified_at,
    role: user.role,
    ...(nonce ? { nonce } : {})
  };
  const idToken = await signPublicJwt(sql, idPayload, {
    issuer,
    audience,
    subject: user.id,
    purpose: "id_token",
    ttlSeconds: helpers.ID_TOKEN_TTL_SECONDS
  });

  const out = {
    token_type: "Bearer",
    access_token: accessToken,
    id_token: idToken,
    expires_in: helpers.ACCESS_TOKEN_TTL_SECONDS,
    scope: safeScope,
    user: helpers.sanitizeUser(user)
  };

  if (includeRefreshToken && client.allow_refresh_tokens) {
    const refresh = await createRefreshToken(sql, { user, client, scope: safeScope, nonce, event });
    out.refresh_token = refresh.rawToken;
    out.refresh_token_expires_in = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
    out.refresh_token_expires_at = refresh.record?.expires_at || null;
    out.refresh_token_rotation = "one-time-use";
  }

  return out;
}

async function rotateRefreshGrant(event, sql, client, consumed) {
  const fresh = await issueOauthTokens(event, sql, client, consumed.user, {
    scope: consumed.token.scope,
    nonce: consumed.token.nonce,
    includeRefreshToken: true
  });
  const newHash = helpers.sha256Hex(fresh.refresh_token);
  const rows = await sql`SELECT id FROM auth_oauth_refresh_tokens WHERE token_hash = ${newHash} LIMIT 1`;
  await markRefreshTokenRotated(sql, consumed.token.id, rows[0]?.id || null);
  return fresh;
}

async function authenticateAccessToken(event, sqlMaybe, opts = {}) {
  const token = helpers.parseAuthorizationBearer(event);
  if (!token) return { ok: false, error: "Missing bearer token" };
  const sql = sqlMaybe || await helpers.getDb();
  await ensureOauthInfra(sql);
  const issuer = helpers.getIssuer(event);

  let verified;
  try {
    verified = await verifyPublicJwt(sql, token, { issuer, audience: opts.audience, purpose: "access_token" });
  } catch (err) {
    return { ok: false, error: err.message || "Invalid access token" };
  }

  const payload = verified.payload;
  const user = await helpers.findUserById(sql, payload.uid || payload.sub);
  if (!user) return { ok: false, error: "Account not found" };
  return { ok: true, token, payload, user, sql };
}

async function requireAdmin(event, sqlMaybe) {
  const sql = sqlMaybe || await helpers.getDb();
  await ensureOauthInfra(sql);
  const auth = await helpers.authenticateRequest(event, sql);
  if (!auth.ok) return { ok: false, statusCode: 401, error: auth.error, sql };
  if (String(auth.user.role || "").toLowerCase() !== "admin") return { ok: false, statusCode: 403, error: "Admin access required", sql, auth };
  return { ok: true, sql, auth };
}

module.exports = {
  scopeArray,
  scopeString,
  scopeIncludes,
  normalizeClientObject,
  ensureOauthInfra,
  listOauthClients,
  getOauthClient,
  saveOauthClient,
  deleteOauthClient,
  isAllowedRedirectUri,
  isAllowedPostLogoutUri,
  getConsent,
  saveConsent,
  isConsentRequired,
  createRefreshToken,
  consumeRefreshToken,
  revokeClientRefreshTokens,
  listSigningKeys,
  getJwks,
  rotateSigningKeys,
  issueOauthTokens,
  rotateRefreshGrant,
  authenticateAccessToken,
  requireAdmin,
  ensureActiveSigningKey
};
