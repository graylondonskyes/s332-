import crypto from "crypto";
import { q } from "./db.js";
import { hashOpaqueToken, randomOpaqueToken, verifyPassword } from "./passwords.js";
import { issueSignedJwt, issuerUrl, verifySignedJwt } from "./jwks.js";

function uuid() {
  return crypto.randomUUID();
}

export function normalizeScope(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return [...new Set(scope.map(String).map((value) => value.trim()).filter(Boolean))];
  return [...new Set(String(scope).split(/\s+/).map((value) => value.trim()).filter(Boolean))];
}

export function scopeString(scope) {
  return normalizeScope(scope).join(" ");
}

export function buildClientId() {
  return `sgfs13_client_${crypto.randomBytes(12).toString("hex")}`;
}

export function buildClientSecret() {
  return `sgfs13_secret_${randomOpaqueToken(32)}`;
}

export async function listOauthClients() {
  const res = await q(
    `select id, client_id, client_name, redirect_uris, grant_types, response_types, scope,
            token_endpoint_auth_method, app_type, owner_user_id, customer_id, is_first_party,
            is_active, metadata, created_at, updated_at
     from oauth_clients
     order by created_at desc`
  );
  return res.rows;
}

export async function getOauthClient(clientId) {
  const res = await q(`select * from oauth_clients where client_id=$1 limit 1`, [clientId]);
  return res.rowCount ? res.rows[0] : null;
}

export async function ensureSystemClient() {
  const existing = await getOauthClient("skygatefs13-firstparty");
  if (existing) return existing;
  const created = await q(
    `insert into oauth_clients(
      id, client_id, client_name, redirect_uris, grant_types, response_types, scope,
      token_endpoint_auth_method, app_type, is_first_party, metadata
     )
     values (
      $1,'skygatefs13-firstparty','SkyeGateFS13 First-Party',
      '{}'::text[],
      '{authorization_code,refresh_token,client_credentials}'::text[],
      '{code}'::text[],
      '{openid,profile,email,offline_access,gateway.invoke,gateway.read,keys.read,keys.write,admin.read,admin.write,billing.read,billing.write}'::text[],
      'none',
      'service',
      true,
      '{}'::jsonb
     )
     on conflict (client_id) do nothing`,
    [uuid()]
  );
  return await getOauthClient("skygatefs13-firstparty");
}

export async function createOauthClient({
  clientName,
  redirectUris = [],
  scope = ["openid", "profile", "email"],
  grantTypes = ["authorization_code", "refresh_token"],
  responseTypes = ["code"],
  tokenEndpointAuthMethod = "client_secret_post",
  appType = "web",
  ownerUserId = null,
  customerId = null,
  isFirstParty = false,
  metadata = {}
}) {
  const clientId = buildClientId();
  const clientSecret = tokenEndpointAuthMethod === "none" ? null : buildClientSecret();
  const hash = clientSecret ? await hashOpaqueToken(clientSecret) : null;
  const row = await q(
    `insert into oauth_clients(
       id, client_id, client_secret_hash, client_name, redirect_uris, grant_types, response_types, scope,
       token_endpoint_auth_method, app_type, owner_user_id, customer_id, is_first_party, metadata
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     returning *`,
    [
      uuid(),
      clientId,
      hash,
      (clientName || "SkyeGateFS13 Client").toString().slice(0, 120),
      redirectUris,
      grantTypes,
      responseTypes,
      normalizeScope(scope),
      tokenEndpointAuthMethod,
      appType,
      ownerUserId,
      customerId,
      !!isFirstParty,
      JSON.stringify(metadata || {})
    ]
  );
  return { client: row.rows[0], client_secret: clientSecret };
}

export async function updateOauthClient(clientId, patch = {}) {
  const updates = [];
  const params = [];
  let index = 1;
  const assign = (column, value) => {
    updates.push(`${column}=$${index++}`);
    params.push(value);
  };
  if (Object.prototype.hasOwnProperty.call(patch, "client_name")) assign("client_name", (patch.client_name || "").toString().slice(0, 120));
  if (Object.prototype.hasOwnProperty.call(patch, "redirect_uris")) assign("redirect_uris", patch.redirect_uris || []);
  if (Object.prototype.hasOwnProperty.call(patch, "grant_types")) assign("grant_types", patch.grant_types || []);
  if (Object.prototype.hasOwnProperty.call(patch, "response_types")) assign("response_types", patch.response_types || []);
  if (Object.prototype.hasOwnProperty.call(patch, "scope")) assign("scope", normalizeScope(patch.scope));
  if (Object.prototype.hasOwnProperty.call(patch, "token_endpoint_auth_method")) assign("token_endpoint_auth_method", patch.token_endpoint_auth_method || "client_secret_post");
  if (Object.prototype.hasOwnProperty.call(patch, "app_type")) assign("app_type", patch.app_type || "web");
  if (Object.prototype.hasOwnProperty.call(patch, "is_active")) assign("is_active", !!patch.is_active);
  if (Object.prototype.hasOwnProperty.call(patch, "metadata")) assign("metadata", JSON.stringify(patch.metadata || {}));
  if (!updates.length) return await getOauthClient(clientId);
  params.push(clientId);
  await q(
    `update oauth_clients
     set ${updates.join(", ")}, updated_at=now()
     where client_id=$${index}`,
    params
  );
  return await getOauthClient(clientId);
}

export async function deleteOauthClient(clientId) {
  await q(`delete from oauth_clients where client_id=$1`, [clientId]);
}

export async function rotateOauthClientSecret(clientId) {
  const clientSecret = buildClientSecret();
  await q(
    `update oauth_clients
     set client_secret_hash=$1, updated_at=now()
     where client_id=$2`,
    [hashOpaqueToken(clientSecret), clientId]
  );
  return clientSecret;
}

export async function authenticateOauthClient({ clientId, clientSecret }) {
  const client = await getOauthClient(clientId);
  if (!client || !client.is_active) return null;
  if (client.token_endpoint_auth_method === "none") return client;
  if (!clientSecret || !client.client_secret_hash) return null;
  const matches = client.client_secret_hash === hashOpaqueToken(clientSecret);
  return matches ? client : null;
}

export function assertRedirectUri(client, redirectUri) {
  if (!redirectUri || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
    const err = new Error("Invalid redirect_uri");
    err.status = 400;
    err.code = "INVALID_REDIRECT_URI";
    throw err;
  }
}

export async function upsertConsent({ userId, clientId, scope, metadata = {} }) {
  const scopes = normalizeScope(scope);
  const id = uuid();
  await q(
    `insert into oauth_consents(id, user_id, client_id, scope, metadata, granted_at, revoked_at)
     values ($1,$2,$3,$4,$5::jsonb,now(),null)
     on conflict (user_id, client_id)
     do update set
       scope = excluded.scope,
       metadata = excluded.metadata,
       granted_at = now(),
       revoked_at = null`,
    [id, userId, clientId, scopes, JSON.stringify(metadata || {})]
  );
}

export async function getConsent(userId, clientId) {
  const res = await q(
    `select * from oauth_consents
     where user_id=$1 and client_id=$2 and revoked_at is null
     limit 1`,
    [userId, clientId]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function listConsents() {
  const res = await q(
    `select c.*, u.email, oc.client_name
     from oauth_consents c
     join users u on u.id = c.user_id
     join oauth_clients oc on oc.client_id = c.client_id
     order by c.granted_at desc`
  );
  return res.rows;
}

export async function revokeConsent(id) {
  await q(`update oauth_consents set revoked_at=coalesce(revoked_at, now()) where id=$1`, [id]);
}

export async function issueAuthorizationCode({
  userId,
  clientId,
  redirectUri,
  scope,
  codeChallenge = null,
  codeChallengeMethod = "S256",
  nonce = null,
  audience = null,
  metadata = {}
}) {
  const code = randomOpaqueToken(32);
  await q(
    `insert into oauth_authorization_codes(
      id, code_hash, user_id, client_id, redirect_uri, code_challenge, code_challenge_method,
      scope, nonce, audience, metadata, expires_at
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb, now() + interval '10 minutes')`,
    [uuid(), hashOpaqueToken(code), userId, clientId, redirectUri, codeChallenge, codeChallengeMethod, normalizeScope(scope), nonce, audience, JSON.stringify(metadata || {})]
  );
  return code;
}

export function verifyPkce({ verifier, codeChallenge, method }) {
  if (!codeChallenge) return true;
  const normalizedMethod = (method || "S256").toUpperCase();
  const input = (verifier || "").toString();
  if (!input) return false;
  if (normalizedMethod === "PLAIN") return input === codeChallenge;
  const digest = crypto.createHash("sha256").update(input).digest("base64url");
  return digest === codeChallenge;
}

export async function consumeAuthorizationCode(code) {
  const hash = hashOpaqueToken(code);
  const res = await q(
    `update oauth_authorization_codes
     set consumed_at = coalesce(consumed_at, now())
     where code_hash=$1
       and consumed_at is null
       and expires_at > now()
     returning *`,
    [hash]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function issueAccessToken({
  user,
  client,
  session = null,
  scope,
  audience = null,
  ttlSeconds = 3600,
  subjectType = "user",
  tokenType = "access_token",
  extraClaims = {},
  issuer = null
}) {
  const scopes = normalizeScope(scope);
  const { token, claims } = await issueSignedJwt({
    type: tokenType,
    sub_type: subjectType,
    client_id: client?.client_id || null,
    sid: session?.id || null,
    scope: scopes,
    customer_id: session?.customer_id ?? user?.primary_customer_id ?? client?.customer_id ?? null,
    api_key_id: session?.api_key_id ?? null,
    email: user?.email || null,
    role: user?.role || "app",
    ...extraClaims
  }, {
    ttlSeconds,
    subject: user?.id || client?.client_id,
    audience: audience || "skygatefs13",
    issuer
  });
  return { token, claims };
}

export async function issueRefreshToken({
  userId,
  clientId,
  sessionId = null,
  scope,
  audience = null,
  parentTokenId = null,
  rotationCounter = 0,
  metadata = {}
}) {
  const token = randomOpaqueToken(32);
  const family = parentTokenId ? `${parentTokenId}` : uuid();
  const id = uuid();
  await q(
    `insert into oauth_refresh_tokens(
      id, token_hash, token_family, user_id, client_id, session_id, scope, audience,
      rotation_counter, parent_token_id, metadata, expires_at
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb, now() + interval '30 days')`,
    [id, hashOpaqueToken(token), family, userId, clientId, sessionId, normalizeScope(scope), audience, rotationCounter, parentTokenId, JSON.stringify(metadata || {})]
  );
  return { id, token, token_family: family };
}

export async function rotateRefreshToken(rawToken) {
  const hashed = hashOpaqueToken(rawToken);
  const res = await q(
    `update oauth_refresh_tokens
     set consumed_at = coalesce(consumed_at, now())
     where token_hash=$1
       and revoked_at is null
       and consumed_at is null
       and expires_at > now()
     returning *`,
    [hashed]
  );
  if (!res.rowCount) return null;
  const current = res.rows[0];
  const next = await issueRefreshToken({
    userId: current.user_id,
    clientId: current.client_id,
    sessionId: current.session_id,
    scope: current.scope || [],
    audience: current.audience || null,
    parentTokenId: current.token_family,
    rotationCounter: (current.rotation_counter || 0) + 1,
    metadata: current.metadata || {}
  });
  await q(
    `update oauth_refresh_tokens
     set replaces_token_id=$1
     where id=$2`,
    [next.id, current.id]
  );
  return { previous: current, next };
}

export async function revokeRefreshToken(rawToken) {
  await q(
    `update oauth_refresh_tokens
     set revoked_at = coalesce(revoked_at, now())
     where token_hash=$1`,
    [hashOpaqueToken(rawToken)]
  );
}

export async function verifyAccessToken(token) {
  const verified = await verifySignedJwt(token, { expectedAudience: "skygatefs13" });
  if (!verified) return null;
  if (verified.payload.type !== "access_token" && verified.payload.type !== "app_token") return null;
  return verified;
}

export function buildOAuthMetadata(req) {
  const issuer = issuerUrl(req);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    revocation_endpoint: `${issuer}/oauth/logout`,
    scopes_supported: ["openid", "profile", "email", "offline_access", "gateway.invoke", "gateway.read", "keys.read", "keys.write", "admin.read", "admin.write", "billing.read", "billing.write"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    code_challenge_methods_supported: ["S256", "plain"]
  };
}
