import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { getUserById } from "./_lib/identity.js";
import {
  authenticateOauthClient,
  consumeAuthorizationCode,
  ensureSystemClient,
  getOauthClient,
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  verifyPkce
} from "./_lib/oauth.js";
import { getSessionById } from "./_lib/sessions.js";

async function readInput(req) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text));
  }
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function basicClientCredentials(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return {};
  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return {};
    return { client_id: decoded.slice(0, idx), client_secret: decoded.slice(idx + 1) };
  } catch {
    return {};
  }
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  const issuer = new URL(req.url).origin;
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const body = await readInput(req);
  const auth = basicClientCredentials(req);
  const clientId = body.client_id || auth.client_id || "";
  const clientSecret = body.client_secret || auth.client_secret || "";
  const grantType = (body.grant_type || "").toString();

  let client = clientId ? await authenticateOauthClient({ clientId, clientSecret }) : null;
  if (!client && grantType === "refresh_token") client = await ensureSystemClient();
  if (!client && grantType !== "authorization_code") client = await getOauthClient(clientId);
  if (!client || !client.is_active) return json(401, { error: "invalid_client" }, cors);

  if (grantType === "authorization_code") {
    const codeRow = await consumeAuthorizationCode(body.code || "");
    if (!codeRow) return json(400, { error: "invalid_grant" }, cors);
    if (codeRow.client_id !== client.client_id) return json(400, { error: "invalid_grant" }, cors);
    if ((body.redirect_uri || "") !== codeRow.redirect_uri) return json(400, { error: "invalid_grant" }, cors);
    if (!verifyPkce({ verifier: body.code_verifier, codeChallenge: codeRow.code_challenge, method: codeRow.code_challenge_method })) {
      return json(400, { error: "invalid_grant", error_description: "PKCE verification failed" }, cors);
    }

    const user = await getUserById(codeRow.user_id);
    const session = codeRow.metadata?.session_id ? await getSessionById(codeRow.metadata.session_id) : null;
    const access = await issueAccessToken({
      user,
      client,
      session,
      scope: codeRow.scope || [],
      audience: codeRow.audience || "skygatefs13",
      issuer
    });
    const refresh = (codeRow.scope || []).includes("offline_access")
      ? await issueRefreshToken({
          userId: user.id,
          clientId: client.client_id,
          sessionId: session?.id || null,
          scope: codeRow.scope || [],
          audience: codeRow.audience || "skygatefs13",
          metadata: { flow: "oauth_code" }
        })
      : null;

    await audit("auth", "OAUTH_TOKEN_CODE", `client:${client.client_id}`, { user_id: user.id });
    return json(200, {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: Math.max(0, access.claims.exp - access.claims.iat),
      scope: (codeRow.scope || []).join(" "),
      refresh_token: refresh?.token
    }, cors);
  }

  if (grantType === "refresh_token") {
    const rotated = await rotateRefreshToken(body.refresh_token || "");
    if (!rotated) return json(400, { error: "invalid_grant" }, cors);
    if (rotated.previous.client_id !== client.client_id) return json(400, { error: "invalid_grant" }, cors);
    const user = rotated.previous.user_id ? await getUserById(rotated.previous.user_id) : null;
    const session = rotated.previous.session_id ? await getSessionById(rotated.previous.session_id) : null;
    const access = await issueAccessToken({
      user,
      client,
      session,
      scope: rotated.previous.scope || [],
      audience: rotated.previous.audience || "skygatefs13",
      issuer
    });
    return json(200, {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: Math.max(0, access.claims.exp - access.claims.iat),
      scope: (rotated.previous.scope || []).join(" "),
      refresh_token: rotated.next.token
    }, cors);
  }

  if (grantType === "client_credentials") {
    const access = await issueAccessToken({
      user: null,
      client,
      scope: body.scope || client.scope || [],
      audience: body.audience || "skygatefs13",
      issuer,
      subjectType: "app",
      tokenType: "app_token",
      extraClaims: { customer_id: client.customer_id || null }
    });
    return json(200, {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: Math.max(0, access.claims.exp - access.claims.iat),
      scope: Array.isArray(access.claims.scope) ? access.claims.scope.join(" ") : ""
    }, cors);
  }

  return badRequest("Unsupported grant_type", cors);
});
