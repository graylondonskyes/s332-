const { jsonResponse, withCors, optionsResponse, getDb, getIssuer, sanitizeUser } = require("./_helpers");
const { authenticateAccessToken } = require("./oauth_ext");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
  if (method !== "GET") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });

  try {
    const sql = await getDb();
    const auth = await authenticateAccessToken(event, sql);
    if (!auth.ok) return withCors(event, jsonResponse(401, { ok: false, error: auth.error }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });

    return withCors(event, jsonResponse(200, {
      ok: true,
      sub: auth.user.id,
      email: auth.user.email,
      email_verified: !!auth.user.email_verified_at,
      role: auth.user.role,
      scope: auth.payload.scope || "",
      client_id: String(auth.payload.aud || ""),
      issuer: getIssuer(event),
      user: sanitizeUser(auth.user)
    }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
  }
};
