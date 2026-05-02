const {
  jsonResponse,
  badRequest,
  parseBody,
  normalizeEmail,
  isValidEmail,
  getDb,
  findUserByEmail,
  sendPasswordResetEmail,
  hasResendConfig,
  withCors,
  optionsResponse
} = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowMethods: ["POST", "OPTIONS"] });
  if (method !== "POST") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: "POST" }), { allowMethods: ["POST", "OPTIONS"] });

  try {
    const body = parseBody(event);
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return withCors(event, badRequest("Valid email required"), { allowMethods: ["POST", "OPTIONS"] });

    const sql = await getDb();
    const user = await findUserByEmail(sql, email);

    if (!hasResendConfig()) {
      return withCors(event, jsonResponse(200, {
        ok: true,
        message: "Password reset email flow is not configured yet.",
        resend_configured: false
      }), { allowMethods: ["POST", "OPTIONS"] });
    }

    if (user) {
      await sendPasswordResetEmail(event, sql, user).catch(() => null);
    }

    return withCors(event, jsonResponse(200, {
      ok: true,
      message: "If that account exists, a password reset email has been sent.",
      resend_configured: true
    }), { allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowMethods: ["POST", "OPTIONS"] });
  }
};
