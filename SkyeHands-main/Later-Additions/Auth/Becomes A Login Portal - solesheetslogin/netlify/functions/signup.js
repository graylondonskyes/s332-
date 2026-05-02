const bcrypt = require("bcryptjs");
const {
  jsonResponse,
  badRequest,
  parseBody,
  normalizeEmail,
  isValidEmail,
  PASSWORD_MIN_LENGTH,
  getDb,
  findUserByEmail,
  createUser,
  isAdminEmail,
  AUTO_SEND_VERIFICATION,
  REQUIRE_EMAIL_VERIFICATION,
  hasResendConfig,
  sendVerificationEmail,
  withCors,
  optionsResponse
} = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  if (method !== "POST") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: "POST" }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

  try {
    const body = parseBody(event);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!isValidEmail(email)) return withCors(event, badRequest("Valid email required"), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
    if (password.length < PASSWORD_MIN_LENGTH) return withCors(event, badRequest(`Password must be ${PASSWORD_MIN_LENGTH}+ characters`), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

    const sql = await getDb();
    const existing = await findUserByEmail(sql, email);
    if (existing) return withCors(event, badRequest("Account already exists for this email"), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

    const hash = await bcrypt.hash(password, 12);
    const role = isAdminEmail(email) ? "admin" : "user";
    const created = await createUser(sql, email, hash, role);

    let verification = { enabled: hasResendConfig(), sent: false, required: REQUIRE_EMAIL_VERIFICATION };
    if (AUTO_SEND_VERIFICATION && verification.enabled) {
      const sent = await sendVerificationEmail(event, sql, created).catch((err) => ({ ok: false, error: err.message || "Could not send verification email" }));
      verification = {
        enabled: true,
        sent: !!sent.ok,
        required: REQUIRE_EMAIL_VERIFICATION,
        skipped: !!sent.skipped,
        error: sent.ok ? null : sent.error || null
      };
    }

    return withCors(event, jsonResponse(200, {
      ok: true,
      user: {
        user_id: created.id,
        email: created.email,
        role: created.role,
        created_at: created.created_at,
        session_version: created.session_version,
        email_verified_at: created.email_verified_at || null
      },
      verification
    }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    const message = /already exists/i.test(err.message || "") ? "Account already exists for this email" : (err.message || "Server error");
    return withCors(event, jsonResponse(500, { ok: false, error: message }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  }
};
