import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { getUserPasswordRecord, updateUserPassword } from "./_lib/identity.js";
import { hashPassword, verifyPassword } from "./_lib/passwords.js";
import { revokeAllUserSessions, verifySessionToken } from "./_lib/sessions.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const verified = await verifySessionToken(getBearer(req));
  if (!verified?.user) return json(401, { error: "Unauthorized" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
  if (!body.current_password || !body.new_password) return badRequest("Missing current_password or new_password", cors);

  const record = await getUserPasswordRecord(verified.user.id);
  const ok = record ? await verifyPassword(body.current_password, record.password_hash) : false;
  if (!ok) return json(401, { error: "Invalid credentials" }, cors);

  const nextHash = await hashPassword(body.new_password);
  await updateUserPassword(verified.user.id, nextHash);
  await revokeAllUserSessions(verified.user.id, "password_change");
  await audit("auth", "AUTH_CHANGE_PASSWORD", `user:${verified.user.id}`);

  return json(200, { ok: true }, cors);
});
