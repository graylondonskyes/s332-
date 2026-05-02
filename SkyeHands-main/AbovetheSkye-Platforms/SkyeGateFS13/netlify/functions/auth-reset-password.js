import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { consumeResetToken } from "./_lib/emailAuth.js";
import { hashPassword } from "./_lib/passwords.js";
import { getUserById, updateUserPassword } from "./_lib/identity.js";
import { revokeAllUserSessions } from "./_lib/sessions.js";

async function readBodyOrQuery(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const url = new URL(req.url);
  return {
    token: body.token || url.searchParams.get("token") || "",
    password: body.password || ""
  };
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const payload = await readBodyOrQuery(req);
  if (!payload.token || !payload.password) return badRequest("Missing token or password", cors);

  const tokenRow = await consumeResetToken(payload.token);
  if (!tokenRow) return json(400, { error: "Invalid or expired token" }, cors);
  const user = await getUserById(tokenRow.user_id);
  if (!user) return json(404, { error: "User not found" }, cors);

  await updateUserPassword(user.id, await hashPassword(payload.password));
  await revokeAllUserSessions(user.id, "password_reset");
  await audit("auth", "AUTH_RESET_PASSWORD", `user:${user.id}`);

  return json(200, { ok: true }, cors);
});
