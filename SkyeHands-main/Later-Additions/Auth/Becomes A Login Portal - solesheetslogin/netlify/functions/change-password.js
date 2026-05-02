const bcrypt = require("bcryptjs");
const {
  jsonResponse,
  badRequest,
  parseBody,
  PASSWORD_MIN_LENGTH,
  getDb,
  authenticateRequest,
  updateUserPassword,
  revokeAllSessionsForUser,
  issueSessionResponse,
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
    if (!auth.ok) return withCors(event, jsonResponse(401, { ok: false, error: auth.error }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

    const body = parseBody(event);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) return withCors(event, badRequest("Current password and new password required"), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
    if (newPassword.length < PASSWORD_MIN_LENGTH) return withCors(event, badRequest(`New password must be ${PASSWORD_MIN_LENGTH}+ characters`), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
    if (currentPassword === newPassword) return withCors(event, badRequest("New password must be different from current password"), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

    const ok = await bcrypt.compare(currentPassword, auth.user.password_hash || "");
    if (!ok) return withCors(event, jsonResponse(401, { ok: false, error: "Current password is incorrect" }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

    const hash = await bcrypt.hash(newPassword, 12);
    const updated = await updateUserPassword(sql, auth.user.id, hash);
    if (!updated) return withCors(event, jsonResponse(500, { ok: false, error: "Could not update password" }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });

    await revokeAllSessionsForUser(sql, auth.user.id, "password-changed");
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
    }, { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowCredentials: true, allowMethods: ["POST", "OPTIONS"] });
  }
};
