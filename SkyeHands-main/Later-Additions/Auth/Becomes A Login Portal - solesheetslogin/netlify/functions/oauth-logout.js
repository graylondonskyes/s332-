const {
  jsonResponse,
  redirectResponse,
  withCors,
  optionsResponse,
  clearSessionCookieValues,
  getDb,
  authenticateRequest,
  revokeSessionByTokenId
} = require("./_helpers");
const { getOauthClient, isAllowedPostLogoutUri } = require("./oauth_ext");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  const query = event.queryStringParameters || {};
  const sql = await getDb().catch(() => null);
  const client = sql ? await getOauthClient(sql, query.client_id || "").catch(() => null) : null;

  if (method === "OPTIONS") return optionsResponse(event, { client, allowMethods: ["GET", "POST", "OPTIONS"] });
  if (!["GET", "POST"].includes(method)) return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }), { client, allowMethods: ["GET", "POST", "OPTIONS"] });

  try {
    const liveSql = sql || await getDb();
    const auth = await authenticateRequest(event, liveSql).catch(() => ({ ok: false }));
    if (auth.ok && auth.session?.session_token_id) {
      await revokeSessionByTokenId(liveSql, auth.session.session_token_id, "oauth-logout");
    }

    const baseResponse = {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      },
      multiValueHeaders: {
        "Set-Cookie": clearSessionCookieValues()
      },
      body: JSON.stringify({ ok: true })
    };

    const postLogoutRedirectUri = String(query.post_logout_redirect_uri || "").trim();
    if (method === "GET" && client && postLogoutRedirectUri && isAllowedPostLogoutUri(client, postLogoutRedirectUri)) {
      return {
        ...redirectResponse(postLogoutRedirectUri, 302),
        multiValueHeaders: {
          "Set-Cookie": clearSessionCookieValues()
        }
      };
    }

    return withCors(event, baseResponse, { client, allowMethods: ["GET", "POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { client, allowMethods: ["GET", "POST", "OPTIONS"] });
  }
};
