const { jsonResponse, withCors, optionsResponse, getDb } = require("./_helpers");
const { getJwks } = require("./oauth_ext");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
  if (method !== "GET") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });

  try {
    const sql = await getDb();
    return withCors(event, {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify(await getJwks(sql))
    }, { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
  } catch (err) {
    return withCors(event, jsonResponse(500, { ok: false, error: err.message || "Server error" }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
  }
};
