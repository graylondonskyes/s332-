import { wrap } from "./_lib/wrap.js";
import { buildCors, json, getBearer } from "./_lib/http.js";
import { getUserById } from "./_lib/identity.js";
import { verifyAccessToken } from "./_lib/oauth.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const access = await verifyAccessToken(getBearer(req));
  if (!access) return json(401, { error: "Invalid token" }, cors);
  const user = access.payload.sub ? await getUserById(access.payload.sub) : null;

  return json(200, {
    sub: access.payload.sub,
    email: user?.email || access.payload.email || null,
    email_verified: user ? !!user.email_verified_at : false,
    name: user?.display_name || null,
    role: user?.role || access.payload.role || null,
    customer_id: access.payload.customer_id || null
  }, cors);
});
