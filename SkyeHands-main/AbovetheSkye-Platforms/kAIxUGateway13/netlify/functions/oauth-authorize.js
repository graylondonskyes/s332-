import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { getOauthClient, getConsent, issueAuthorizationCode, assertRedirectUri, upsertConsent, normalizeScope } from "./_lib/oauth.js";
import { verifySessionToken } from "./_lib/sessions.js";

function readRequest(req, body = {}) {
  const url = new URL(req.url);
  return {
    response_type: body.response_type || url.searchParams.get("response_type") || "code",
    client_id: body.client_id || url.searchParams.get("client_id") || "",
    redirect_uri: body.redirect_uri || url.searchParams.get("redirect_uri") || "",
    scope: normalizeScope(body.scope || url.searchParams.get("scope") || "openid profile email"),
    state: body.state || url.searchParams.get("state") || null,
    code_challenge: body.code_challenge || url.searchParams.get("code_challenge") || null,
    code_challenge_method: body.code_challenge_method || url.searchParams.get("code_challenge_method") || "S256",
    nonce: body.nonce || url.searchParams.get("nonce") || null,
    audience: body.audience || url.searchParams.get("audience") || null,
    approve: body.approve
  };
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  let body = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
  }
  const input = readRequest(req, body);
  if (input.response_type !== "code") return badRequest("Only response_type=code is supported", cors);
  if (!input.client_id || !input.redirect_uri) return badRequest("Missing client_id or redirect_uri", cors);

  const client = await getOauthClient(input.client_id);
  if (!client || !client.is_active) return json(404, { error: "Unknown client" }, cors);
  assertRedirectUri(client, input.redirect_uri);

  const session = await verifySessionToken(getBearer(req));
  if (!session?.user) {
    return json(401, {
      error: "login_required",
      authorize_context: {
        client_id: input.client_id,
        client_name: client.client_name,
        redirect_uri: input.redirect_uri,
        scope: input.scope
      }
    }, cors);
  }

  const existingConsent = await getConsent(session.user.id, client.client_id);
  const consentRequired = !client.is_first_party && (!existingConsent || input.scope.some((scope) => !(existingConsent.scope || []).includes(scope)));

  if (req.method === "GET" || input.approve === undefined) {
    return json(200, {
      ok: true,
      authorize_context: {
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uri: input.redirect_uri,
        scope: input.scope,
        state: input.state,
        nonce: input.nonce
      },
      consent_required: consentRequired
    }, cors);
  }

  if (!input.approve) {
    return json(403, { error: "access_denied" }, cors);
  }

  await upsertConsent({ userId: session.user.id, clientId: client.client_id, scope: input.scope, metadata: { via: "oauth-authorize" } });
  const code = await issueAuthorizationCode({
    userId: session.user.id,
    clientId: client.client_id,
    redirectUri: input.redirect_uri,
    scope: input.scope,
    codeChallenge: input.code_challenge,
    codeChallengeMethod: input.code_challenge_method,
    nonce: input.nonce,
    audience: input.audience,
    metadata: { session_id: session.session.id }
  });
  await audit("auth", "OAUTH_AUTHORIZE_OK", `client:${client.client_id}`, { user_id: session.user.id, scope: input.scope });

  const redirect = new URL(input.redirect_uri);
  redirect.searchParams.set("code", code);
  if (input.state) redirect.searchParams.set("state", input.state);

  return json(200, {
    code,
    state: input.state,
    redirect_to: redirect.toString()
  }, cors);
});
