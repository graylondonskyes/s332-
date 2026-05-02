const {
  jsonResponse,
  getDb,
  authenticateRequest,
  revokeSessionByTokenId,
  clearSessionCookieValues,
  withCors,
  optionsResponse
} = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  if (method !== "POST") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: "POST" }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

  try {
    const sql = await getDb();
    const auth = await authenticateRequest(event, sql);
    if (auth.ok && auth.session?.session_token_id) {
      await revokeSessionByTokenId(sql, auth.session.session_token_id, "logout");
    }

    return withCors(event, {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      multiValueHeaders: {
        "Set-Cookie": clearSessionCookieValues()
      },
      body: JSON.stringify({ ok: true })
    }, { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  }
};
