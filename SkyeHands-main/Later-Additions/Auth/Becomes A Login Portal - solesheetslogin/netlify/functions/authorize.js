const {
  badRequest,
  redirectResponse,
  htmlResponse,
  getDb,
  authenticateRequest,
  getIssuer,
  createOauthAuthorizationCode,
  appendQueryToUrl,
  buildAuthorizeRedirect,
  withCors,
  optionsResponse,
  escapeHtml
} = require("./_helpers");
const {
  getOauthClient,
  isAllowedRedirectUri,
  getConsent,
  saveConsent,
  isConsentRequired,
  scopeArray,
  scopeString
} = require("./oauth_ext");

function parseIncoming(event) {
  if ((event.httpMethod || "GET").toUpperCase() === "GET") return event.queryStringParameters || {};
  const contentType = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(event.body || "").entries());
  }
  try {
    return JSON.parse(event.body || "{}");
  } catch (_err) {
    return {};
  }
}

function buildErrorRedirect(redirectUri, state, error, description) {
  return appendQueryToUrl(redirectUri, {
    error,
    error_description: description,
    ...(state ? { state } : {})
  });
}

function scopeDescription(scope) {
  const map = {
    openid: "Confirm identity with an OpenID Connect login.",
    profile: "Read your basic profile details from the auth portal.",
    email: "Read your verified email address.",
    offline_access: "Keep this app signed in with rotating refresh tokens."
  };
  return map[scope] || "Access a portal capability requested by this app.";
}

function consentPage({ client, user, requestedScope, state, redirectUri, clientId, nonce, codeChallenge, codeChallengeMethod, issuer }) {
  const scopes = scopeArray(requestedScope);
  const hidden = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: requestedScope,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    consent_action: "approve"
  };
  const hiddenInputs = Object.entries(hidden).map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(String(v || ""))}">`).join("");
  const denyInputs = Object.entries({ ...hidden, consent_action: "deny" }).map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(String(v || ""))}">`).join("");
  const scopeHtml = scopes.map((scope) => `<div class="scope"><div class="s1">${escapeHtml(scope)}</div><div class="s2">${escapeHtml(scopeDescription(scope))}</div></div>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Consent • ${escapeHtml(client.name)}</title>
  <style>
    :root{--bg:#060812;--panel:rgba(255,255,255,.07);--line:rgba(255,255,255,.14);--txt:rgba(255,255,255,.93);--muted:rgba(255,255,255,.68);--gold:#ffcf5a;--purple:#7c3aed}
    *{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;background:radial-gradient(900px 540px at 20% 10%, rgba(124,58,237,.23), transparent 60%),radial-gradient(900px 560px at 80% 10%, rgba(255,207,90,.16), transparent 60%),linear-gradient(180deg,#060812,#05060a 70%);color:var(--txt)}
    .wrap{max-width:860px;margin:0 auto;padding:42px 18px 72px}.card{background:linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.055));border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 70px rgba(0,0,0,.55);padding:22px}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:rgba(255,207,90,.88)}h1{margin:8px 0 10px;font-size:30px}.sub{color:var(--muted);line-height:1.68;max-width:720px}.scopeList{display:grid;gap:12px;margin-top:18px}.scope{padding:14px 15px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}.s1{font-weight:800}.s2{margin-top:6px;color:var(--muted);line-height:1.6}.meta{margin-top:14px;padding:14px 15px;border-radius:16px;background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.10);font-size:13px;color:var(--muted);line-height:1.7}.btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}button{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:var(--txt);padding:12px 14px;border-radius:14px;font-weight:800;cursor:pointer}.primary{border-color:rgba(255,207,90,.35);background:linear-gradient(135deg, rgba(255,207,90,.22), rgba(124,58,237,.14))}.tiny{margin-top:16px;font-size:12px;color:rgba(255,255,255,.45)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="eyebrow">Authorization consent</div>
      <h1>${escapeHtml(client.name)} wants access</h1>
      <div class="sub">You are signed in as <strong>${escapeHtml(user.email)}</strong>. Review what this project is asking for before the auth portal returns an authorization code.</div>
      <div class="scopeList">${scopeHtml}</div>
      <div class="meta">
        Client ID: <code>${escapeHtml(client.client_id)}</code><br>
        Redirect URI: <code>${escapeHtml(redirectUri)}</code><br>
        Issuer: <code>${escapeHtml(issuer)}</code>
      </div>
      <div class="btns">
        <form method="post">${hiddenInputs}<button class="primary" type="submit">Approve and continue</button></form>
        <form method="post">${denyInputs}<button type="submit">Deny</button></form>
      </div>
      <div class="tiny">Approvals are stored so repeat logins can skip this screen unless scopes change or the app requests consent again.</div>
    </div>
  </div>
</body>
</html>`;
}

exports.handler = async (event) => {
  const method = (event.httpMethod || "GET").toUpperCase();
  const incoming = parseIncoming(event);
  const clientId = String(incoming.client_id || "").trim();
  const queryClientId = String((event.queryStringParameters || {}).client_id || clientId).trim();

  if (method === "OPTIONS") return optionsResponse(event, { allowMethods: ["GET", "POST", "OPTIONS"] });
  if (!["GET", "POST"].includes(method)) return withCors(event, badRequest("Method not allowed"), { allowMethods: ["GET", "POST", "OPTIONS"] });

  try {
    const issuer = getIssuer(event);
    const sql = await getDb();
    const client = await getOauthClient(sql, clientId || queryClientId);
    const responseType = String(incoming.response_type || "code").trim();
    const redirectUri = String(incoming.redirect_uri || "").trim();
    const state = String(incoming.state || "").trim();
    const scope = scopeString(incoming.scope || client?.default_scope || "openid profile email offline_access") || "openid profile email offline_access";
    const nonce = String(incoming.nonce || "").trim();
    const prompt = String(incoming.prompt || "").trim();
    const codeChallenge = String(incoming.code_challenge || "").trim();
    const codeChallengeMethod = String(incoming.code_challenge_method || "S256").trim().toUpperCase();

    if (!issuer) return badRequest("Auth issuer/base URL is not configured");
    if (!client) return badRequest("Unknown OAuth client_id");
    if (responseType !== "code") return withCors(event, badRequest("Only response_type=code is supported"), { client });
    if (!redirectUri || !isAllowedRedirectUri(client, redirectUri)) return withCors(event, badRequest("redirect_uri is not allowed for this client"), { client });
    if (client.pkce_required && (!codeChallenge || codeChallengeMethod !== "S256")) {
      return withCors(event, badRequest("code_challenge with S256 is required for this client"), { client });
    }

    const auth = await authenticateRequest(event, sql).catch(() => ({ ok: false }));
    if (!auth.ok) {
      const authorizeUrl = buildAuthorizeRedirect(`${issuer}/oauth/authorize`, {
        response_type: "code",
        client_id: client.client_id,
        redirect_uri: redirectUri,
        state,
        scope,
        nonce,
        prompt,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod
      });
      return redirectResponse(`/index.html?flow=authorize&client_id=${encodeURIComponent(client.client_id)}&client_name=${encodeURIComponent(client.name)}&return_to=${encodeURIComponent(authorizeUrl)}`, 302);
    }

    const consent = await getConsent(sql, auth.user.id, client.client_id);
    const needsConsent = isConsentRequired(client, consent, scope, prompt);
    if (prompt.split(/\s+/).includes("none") && needsConsent) {
      return redirectResponse(buildErrorRedirect(redirectUri, state, "consent_required", "User consent is required"), 302);
    }

    if (method === "GET" && needsConsent) {
      return htmlResponse(200, consentPage({ client, user: auth.user, requestedScope: scope, state, redirectUri, clientId: client.client_id, nonce, codeChallenge, codeChallengeMethod, issuer }));
    }

    if (method === "POST") {
      const action = String(incoming.consent_action || "approve").trim().toLowerCase();
      if (action === "deny") {
        return redirectResponse(buildErrorRedirect(redirectUri, state, "access_denied", "The resource owner denied the request"), 302);
      }
      await saveConsent(sql, { userId: auth.user.id, clientId: client.client_id, scope });
    }

    if (!needsConsent && method === "POST") {
      // explicit approval refreshes stored consent scope when broader scopes are requested
      await saveConsent(sql, { userId: auth.user.id, clientId: client.client_id, scope });
    }

    const { rawCode } = await createOauthAuthorizationCode(sql, {
      userId: auth.user.id,
      clientId: client.client_id,
      redirectUri,
      scope,
      nonce,
      codeChallenge,
      codeChallengeMethod,
      event
    });

    return redirectResponse(appendQueryToUrl(redirectUri, { code: rawCode, ...(state ? { state } : {}) }), 302);
  } catch (err) {
    return htmlResponse(500, `<!doctype html><html><body style="font-family:Arial,sans-serif;padding:32px;background:#070812;color:#fff"><h1>Authorize failed</h1><p>${escapeHtml(err.message || "Server error")}</p></body></html>`);
  }
};
