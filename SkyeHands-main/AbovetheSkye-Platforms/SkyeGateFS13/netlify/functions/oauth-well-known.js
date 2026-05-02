import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { buildOAuthMetadata } from "./_lib/oauth.js";

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);
  return json(200, buildOAuthMetadata(req), cors);
});
