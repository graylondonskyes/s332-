const { jsonResponse, withCors, optionsResponse, parseBody, getIssuer } = require("./_helpers");
const { requireAdmin, listSigningKeys, rotateSigningKeys } = require("./oauth_ext");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowCredentials: true, allowMethods: ["GET", "POST", "OPTIONS"] });

  try {
    const admin = await requireAdmin(event);
    if (!admin.ok) return withCors(event, jsonResponse(admin.statusCode, { ok: false, error: admin.error }), { allowCredentials: true, allowMethods: ["GET", "POST", "OPTIONS"] });

    if (method === "GET") {
      const keys = await listSigningKeys(admin.sql);
      return withCors(event, jsonResponse(200, {
        ok: true,
        issuer: getIssuer(event),
        jwks_uri: `${getIssuer(event)}/.well-known/jwks.json`,
        keys
      }), { allowCredentials: true, allowMethods: ["GET", "POST", "OPTIONS"] });
    }

    if (method === "POST") {
      const body = parseBody(event);
      const rotated = await rotateSigningKeys(admin.sql, String(body.note || "manual rotation").trim());
      const keys = await listSigningKeys(admin.sql);
      return withCors(event, jsonResponse(200, {
        ok: true,
        rotated,
        keys,
        jwks_uri: `${getIssuer(event)}/.well-known/jwks.json`
      }), { allowCredentials: true, allowMethods: ["GET", "POST", "OPTIONS"] });
    }

    return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }), { allowCredentials: true, allowMethods: ["GET", "POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowCredentials: true, allowMethods: ["GET", "POST", "OPTIONS"] });
  }
};
