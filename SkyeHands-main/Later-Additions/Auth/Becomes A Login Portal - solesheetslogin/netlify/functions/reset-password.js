const bcrypt = require("bcryptjs");
const {
  jsonResponse,
  badRequest,
  parseBody,
  PASSWORD_MIN_LENGTH,
  getDb,
  consumePasswordResetToken,
  updateUserPassword,
  revokeAllSessionsForUser,
  issueSessionResponse,
  withCors,
  optionsResponse
} = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowMethods: ["POST", "OPTIONS"] });
  if (method !== "POST") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }, { Allow: "POST" }), { allowMethods: ["POST", "OPTIONS"] });

  try {
    const body = parseBody(event);
    const token = String(body.token || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!token) return withCors(event, badRequest("Reset token required"), { allowMethods: ["POST", "OPTIONS"] });
    if (newPassword.length < PASSWORD_MIN_LENGTH) return withCors(event, badRequest(`New password must be ${PASSWORD_MIN_LENGTH}+ characters`), { allowMethods: ["POST", "OPTIONS"] });

    const sql = await getDb();
    const tokenResult = await consumePasswordResetToken(sql, token);
    if (!tokenResult.ok) return withCors(event, jsonResponse(400, { ok: false, error: tokenResult.error }), { allowMethods: ["POST", "OPTIONS"] });

    const hash = await bcrypt.hash(newPassword, 12);
    const updated = await updateUserPassword(sql, tokenResult.user.user_id || tokenResult.user.id, hash);
    if (!updated) return withCors(event, jsonResponse(500, { ok: false, error: "Could not update password" }), { allowMethods: ["POST", "OPTIONS"] });

    await revokeAllSessionsForUser(sql, updated.id, "password-reset");
    const session = await issueSessionResponse(event, sql, {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      session_version: updated.session_version
    });

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
          user_id: updated.id,
          email: updated.email,
          role: updated.role,
          session_version: updated.session_version,
          email_verified_at: updated.email_verified_at || null,
          password_changed_at: updated.password_changed_at
        }
      })
    }, { allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowMethods: ["POST", "OPTIONS"] });
  }
};
