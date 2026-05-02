const { jsonResponse, getIssuer, withCors, optionsResponse } = require("./_helpers");

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return optionsResponse(event, { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
  if (method !== "GET") return withCors(event, jsonResponse(405, { ok: false, error: "Method not allowed" }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });

  const issuer = getIssuer(event);
  return withCors(event, jsonResponse(200, {
    ok: true,
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    end_session_endpoint: `${issuer}/oauth/logout`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    claims_supported: ["sub", "email", "email_verified", "role"]
  }), { allowAny: true, allowMethods: ["GET", "OPTIONS"] });
};
