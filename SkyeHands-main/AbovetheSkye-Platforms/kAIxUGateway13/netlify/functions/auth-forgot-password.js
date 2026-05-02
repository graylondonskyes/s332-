import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest } from "./_lib/http.js";
import { audit } from "./_lib/audit.js";
import { createResetToken, sendResetEmail } from "./_lib/emailAuth.js";
import { getUserByEmail } from "./_lib/identity.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }
  const email = (body.email || "").toString().trim();
  if (!email) return badRequest("Missing email", cors);

  const user = await getUserByEmail(email);
  if (!user) return json(200, { ok: true }, cors);

  const token = await createResetToken(user);
  const delivery = await sendResetEmail(user, token, new URL(req.url).origin);
  await audit("auth", "AUTH_FORGOT_PASSWORD", `user:${user.id}`);

  return json(200, {
    ok: true,
    delivery,
    token_preview: delivery.mode === "preview" ? token : undefined
  }, cors);
});
