const {
  jsonResponse,
  badRequest,
  optionsResponse,
  withCors,
  getDb,
  getIssuer
} = require("./_helpers");
const {
  getOauthClient,
  isAllowedRedirectUri,
  issueOauthTokens,
  consumeRefreshToken,
  rotateRefreshGrant,
  ensureOauthInfra
} = require("./oauth_ext");
const { consumeOauthAuthorizationCode, verifyPkce } = require("./_helpers");

function parseIncoming(event) {
  const contentType = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(event.body || "").entries());
  }
  try {
    return JSON.parse(event.body || "{}");
  } catch (_err) {
    return {};
  }
}

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  const body = method === "POST" ? parseIncoming(event) : {};
  const hintClientId = String(body.client_id || "").trim();

  if (method === "OPTIONS") {
    const sql = await getDb().catch(() => null);
    const client = sql ? await getOauthClient(sql, hintClientId).catch(() => null) : null;
    return optionsResponse(event, { client, allowMethods: ["POST", "OPTIONS"] });
  }
  if (method !== "POST") {
    return withCors(event, badRequest("Method not allowed"), { allowMethods: ["POST", "OPTIONS"] });
  }

  try {
    const sql = await getDb();
    await ensureOauthInfra(sql);
    const grantType = String(body.grant_type || "authorization_code").trim();
    const clientId = String(body.client_id || "").trim();
    const redirectUri = String(body.redirect_uri || "").trim();
    const code = String(body.code || "").trim();
    const codeVerifier = String(body.code_verifier || "").trim();
    const refreshToken = String(body.refresh_token || "").trim();
    const client = await getOauthClient(sql, clientId);

    if (!client) return withCors(event, badRequest("Unknown OAuth client_id"), { allowMethods: ["POST", "OPTIONS"] });

    if (grantType === "authorization_code") {
      if (!redirectUri || !isAllowedRedirectUri(client, redirectUri)) return withCors(event, badRequest("redirect_uri is not allowed for this client"), { client, allowMethods: ["POST", "OPTIONS"] });
      if (!code) return withCors(event, badRequest("Authorization code is required"), { client, allowMethods: ["POST", "OPTIONS"] });
      if (client.pkce_required && !codeVerifier) return withCors(event, badRequest("code_verifier is required"), { client, allowMethods: ["POST", "OPTIONS"] });

      const consumed = await consumeOauthAuthorizationCode(sql, { code, clientId, redirectUri });
      if (!consumed.ok) return withCors(event, jsonResponse(400, { ok: false, error: consumed.error }), { client, allowMethods: ["POST", "OPTIONS"] });
      if (!verifyPkce(codeVerifier, consumed.code.code_challenge, consumed.code.code_challenge_method)) {
        return withCors(event, jsonResponse(400, { ok: false, error: "Invalid code_verifier" }), { client, allowMethods: ["POST", "OPTIONS"] });
      }

      const tokens = await issueOauthTokens(event, sql, client, consumed.user, {
        scope: consumed.code.scope,
        nonce: consumed.code.nonce,
        includeRefreshToken: true
      });

      return withCors(event, jsonResponse(200, {
        ok: true,
        issuer: getIssuer(event),
        client_id: client.client_id,
        grant_type: grantType,
        ...tokens
      }), { client, allowMethods: ["POST", "OPTIONS"] });
    }

    if (grantType === "refresh_token") {
      if (!client.allow_refresh_tokens) return withCors(event, badRequest("Refresh tokens are disabled for this client"), { client, allowMethods: ["POST", "OPTIONS"] });
      if (!refreshToken) return withCors(event, badRequest("refresh_token is required"), { client, allowMethods: ["POST", "OPTIONS"] });

      const consumed = await consumeRefreshToken(sql, { refreshToken, clientId });
      if (!consumed.ok) return withCors(event, jsonResponse(400, { ok: false, error: consumed.error }), { client, allowMethods: ["POST", "OPTIONS"] });

      const tokens = await rotateRefreshGrant(event, sql, client, consumed);
      return withCors(event, jsonResponse(200, {
        ok: true,
        issuer: getIssuer(event),
        client_id: client.client_id,
        grant_type: grantType,
        ...tokens
      }), { client, allowMethods: ["POST", "OPTIONS"] });
    }

    return withCors(event, badRequest("Supported grant types: authorization_code, refresh_token"), { client, allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowMethods: ["POST", "OPTIONS"] });
  }
};
