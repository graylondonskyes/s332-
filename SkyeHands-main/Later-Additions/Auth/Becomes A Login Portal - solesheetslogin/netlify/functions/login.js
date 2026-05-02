const bcrypt = require("bcryptjs");
const {
  jsonResponse,
  badRequest,
  unauthorized,
  tooManyRequests,
  parseBody,
  normalizeEmail,
  getDb,
  findUserByEmail,
  touchLogin,
  getClientIp,
  getLoginAttemptSubjects,
  getLoginLockState,
  recordLoginFailure,
  clearLoginFailures,
  issueSessionResponse,
  REQUIRE_EMAIL_VERIFICATION,
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

    if (!email || !password) return withCors(event, badRequest("Email and password required"), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

    const sql = await getDb();
    const ip = getClientIp(event);
    const subjects = getLoginAttemptSubjects(email, ip);
    const lock = await getLoginLockState(sql, subjects);
    if (lock) {
      return withCors(event, tooManyRequests("Too many failed sign-in attempts. Try again later.", lock.retryAfterSeconds), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
    }

    const user = await findUserByEmail(sql, email);
    if (!user) {
      await recordLoginFailure(sql, subjects);
      return withCors(event, unauthorized("Invalid credentials"), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
    }

    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok) {
      await recordLoginFailure(sql, subjects);
      return withCors(event, unauthorized("Invalid credentials"), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
    }

    if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified_at) {
      return withCors(event, unauthorized("Email verification is required before sign in", {
        code: "EMAIL_NOT_VERIFIED",
        email: user.email
      }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
    }

    await clearLoginFailures(sql, subjects);
    await touchLogin(sql, user.id);
    const session = await issueSessionResponse(event, sql, user);

    return withCors(event, {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": session.setCookie
      },
      body: JSON.stringify({
        ok: true,
        user: {
          user_id: user.id,
          email: user.email,
          role: user.role,
          session_version: user.session_version,
          email_verified_at: user.email_verified_at || null
        }
      })
    }, { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  }
};
