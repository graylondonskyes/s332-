import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { consumeVerificationToken } from "./_lib/emailAuth.js";
import { getUserById, markEmailVerified } from "./_lib/identity.js";

async function readToken(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const url = new URL(req.url);
  return body.token || url.searchParams.get("token") || "";
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST" && req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const token = await readToken(req);
  if (!token) return badRequest("Missing token", cors);

  const tokenRow = await consumeVerificationToken(token);
  if (!tokenRow) return json(400, { error: "Invalid or expired token" }, cors);
  const user = await getUserById(tokenRow.user_id);
  if (!user) return json(404, { error: "User not found" }, cors);

  await markEmailVerified(user.id);
  await audit("auth", "AUTH_VERIFY_EMAIL", `user:${user.id}`);

  return json(200, { ok: true, email: user.email }, cors);
});
