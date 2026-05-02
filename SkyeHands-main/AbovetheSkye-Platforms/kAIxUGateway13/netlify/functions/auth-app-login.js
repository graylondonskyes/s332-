import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { authenticateOauthClient, issueAccessToken } from "./_lib/oauth.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  const issuer = new URL(req.url).origin;
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
  const client = await authenticateOauthClient({ clientId: body.client_id || "", clientSecret: body.client_secret || "" });
  if (!client) return json(401, { error: "Invalid client credentials" }, cors);
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
});
