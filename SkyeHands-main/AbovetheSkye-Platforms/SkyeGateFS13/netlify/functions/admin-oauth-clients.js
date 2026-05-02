import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { resolveAdminAuthority } from "./_lib/admin.js";
import { audit } from "./_lib/audit.js";
import { createOauthClient, deleteOauthClient, listOauthClients, rotateOauthClientSecret, updateOauthClient } from "./_lib/oauth.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = await resolveAdminAuthority(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);

  if (req.method === "GET") {
    return json(200, { clients: await listOauthClients() }, cors);
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
    const created = await createOauthClient({
      clientName: body.client_name,
      redirectUris: body.redirect_uris || [],
      scope: body.scope || ["openid", "profile", "email"],
      grantTypes: body.grant_types || ["authorization_code", "refresh_token"],
      responseTypes: body.response_types || ["code"],
      tokenEndpointAuthMethod: body.token_endpoint_auth_method || "client_secret_post",
      appType: body.app_type || "web",
      ownerUserId: body.owner_user_id || null,
      customerId: body.customer_id || null,
      isFirstParty: !!body.is_first_party,
      metadata: body.metadata || {}
    });
    await audit("admin", "OAUTH_CLIENT_CREATE", `client:${created.client.client_id}`);
    return json(200, created, cors);
  }

  if (req.method === "PATCH") {
    let body;
    try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
    const clientId = body.client_id || "";
    if (!clientId) return badRequest("Missing client_id", cors);
    const updated = await updateOauthClient(clientId, body);
    await audit("admin", "OAUTH_CLIENT_UPDATE", `client:${clientId}`);
    return json(200, { client: updated }, cors);
  }

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
    const clientId = body.client_id || "";
    if (!clientId) return badRequest("Missing client_id", cors);
    const clientSecret = await rotateOauthClientSecret(clientId);
    await audit("admin", "OAUTH_CLIENT_ROTATE_SECRET", `client:${clientId}`);
    return json(200, { client_id: clientId, client_secret: clientSecret }, cors);
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("client_id") || "";
    if (!clientId) return badRequest("Missing client_id", cors);
    await deleteOauthClient(clientId);
    await audit("admin", "OAUTH_CLIENT_DELETE", `client:${clientId}`);
    return json(200, { ok: true }, cors);
  }

  return json(405, { error: "Method not allowed" }, cors);
});
