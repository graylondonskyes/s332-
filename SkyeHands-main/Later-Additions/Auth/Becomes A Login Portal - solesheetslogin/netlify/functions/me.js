const {
  jsonResponse,
  authenticateRequest,
  REQUIRE_EMAIL_VERIFICATION,
  hasResendConfig,
  withCors,
  optionsResponse
} = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowCredentials: true, allowMethods: ["GET", "OPTIONS"] });
  if (method !== "GET") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: "GET" }), { allowCredentials: true, allowMethods: ["GET", "OPTIONS"] });

  try {
    const auth = await authenticateRequest(event);
    if (!auth.ok) return withCors(event, jsonResponse(401, { ok: false, error: auth.error }), { allowCredentials: true, allowMethods: ["GET", "OPTIONS"] });

    return withCors(event, jsonResponse(200, {
      ok: true,
      user: {
        user_id: auth.user.id,
        email: auth.user.email,
        role: auth.user.role,
        session_version: auth.user.session_version,
        email_verified_at: auth.user.email_verified_at || null,
        verification_sent_at: auth.user.verification_sent_at || null,
        created_at: auth.user.created_at,
        last_login_at: auth.user.last_login_at,
        password_changed_at: auth.user.password_changed_at
      },
      session: {
        expires_at: auth.session.expires_at,
        session_token_id: auth.session.session_token_id
      },
      auth_config: {
        require_email_verification: REQUIRE_EMAIL_VERIFICATION,
        resend_configured: hasResendConfig()
      },
      exp: auth.payload.exp
    }), { allowCredentials: true, allowMethods: ["GET", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowCredentials: true, allowMethods: ["GET", "OPTIONS"] });
  }
};
