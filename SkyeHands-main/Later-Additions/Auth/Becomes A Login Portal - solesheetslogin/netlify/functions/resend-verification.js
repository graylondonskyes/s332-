const {
  jsonResponse,
  badRequest,
  parseBody,
  normalizeEmail,
  isValidEmail,
  getDb,
  findUserByEmail,
  authenticateRequest,
  sendVerificationEmail,
  hasResendConfig,
  withCors,
  optionsResponse
} = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowMethods: ["POST", "OPTIONS"] });
  if (method !== "POST") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: "POST" }), { allowMethods: ["POST", "OPTIONS"] });

  try {
    const sql = await getDb();
    if (!hasResendConfig()) {
      return withCors(event, jsonResponse(200, { ok: true, resend_configured: false, message: "Verification email flow is not configured yet." }), { allowMethods: ["POST", "OPTIONS"] });
    }

    let user = null;
    const auth = await authenticateRequest(event, sql).catch(() => ({ ok: false }));
    if (auth.ok) {
      user = auth.user;
    } else {
      const body = parseBody(event);
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return withCors(event, badRequest("Valid email required"), { allowMethods: ["POST", "OPTIONS"] });
      user = await findUserByEmail(sql, email);
    }

    if (user && !user.email_verified_at) {
      await sendVerificationEmail(event, sql, user).catch(() => null);
    }

    return withCors(event, jsonResponse(200, {
      ok: true,
      resend_configured: true,
      message: "If the account exists and still needs verification, a verification email has been sent."
    }), { allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowMethods: ["POST", "OPTIONS"] });
  }
};
