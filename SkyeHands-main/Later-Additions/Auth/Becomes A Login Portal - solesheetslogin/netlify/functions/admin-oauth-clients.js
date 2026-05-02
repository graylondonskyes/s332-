const { jsonResponse, withCors, optionsResponse, parseBody } = require("./_helpers");
const { requireAdmin, listOauthClients, saveOauthClient, deleteOauthClient } = require("./oauth_ext");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowCredentials: true, allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] });

  try {
    const admin = await requireAdmin(event);
    if (!admin.ok) return withCors(event, jsonResponse(admin.statusCode, { ok: false, error: admin.error }), { allowCredentials: true, allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] });

    if (method === "GET") {
      const clients = await listOauthClients(admin.sql);
      return withCors(event, jsonResponse(200, {
        ok: true,
        admin: { email: admin.auth.user.email, role: admin.auth.user.role },
        clients
      }), { allowCredentials: true, allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] });
    }

    if (method === "POST") {
      const body = parseBody(event);
      const client = await saveOauthClient(admin.sql, body, admin.auth.user);
      return withCors(event, jsonResponse(200, { ok: true, client }), { allowCredentials: true, allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] });
    }

    if (method === "DELETE") {
      const body = parseBody(event);
      const result = await deleteOauthClient(admin.sql, body.client_id || body.clientId || "");
      return withCors(event, jsonResponse(200, result), { allowCredentials: true, allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] });
    }

    return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }), { allowCredentials: true, allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowCredentials: true, allowMethods: ["GET", "POST", "DELETE", "OPTIONS"] });
  }
};
