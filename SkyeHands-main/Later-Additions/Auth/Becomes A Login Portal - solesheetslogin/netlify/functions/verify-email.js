const { getDb, consumeEmailVerificationToken, jsonResponse, methodNotAllowed, redirectResponse } = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (!["GET", "POST"].includes(method)) {
    return methodNotAllowed(["GET", "POST"]);
  }

  try {
    const token = String((event.queryStringParameters && event.queryStringParameters.token) || (method === "POST" ? (JSON.parse(event.body || "{}").token || "") : "")).trim();
    if (!token) {
      if (method === "GET") return redirectResponse("/index.html?verified=0&reason=missing_token");
      return jsonResponse(400, { ok: false, error: "Verification token required" });
    }

    const sql = await getDb();
    const result = await consumeEmailVerificationToken(sql, token);
    if (!result.ok) {
      if (method === "GET") return redirectResponse(`/index.html?verified=0&reason=${encodeURIComponent(result.error)}`);
      return jsonResponse(400, { ok: false, error: result.error });
    }

    if (method === "GET") {
      return redirectResponse("/index.html?verified=1");
    }

    return jsonResponse(200, {
      ok: true,
      user: {
        user_id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        session_version: result.user.session_version,
        email_verified_at: result.user.email_verified_at || null
      }
    });
  } catch (err) {
    if (method === "GET") return redirectResponse(`/index.html?verified=0&reason=${encodeURIComponent(err.message || 'Verification failed')}`);
    return jsonResponse(500, { ok: false, error: err.message || "Server error" });
  }
};
