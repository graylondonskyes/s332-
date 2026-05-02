import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { buildOAuthMetadata } from "./_lib/oauth.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);
  const metadata = buildOAuthMetadata(req);
  return json(200, {
    ...metadata,
    claims_supported: ["sub", "email", "email_verified", "name", "role", "customer_id"],
    userinfo_signing_alg_values_supported: ["RS256"]
  }, cors);
});
