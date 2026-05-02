import { json } from "./_shared/response";
import { q } from "./_shared/neon";
import { parseBearerToken, parseCookies, clearSessionCookie, clearSkyeGateCookie, requestSkyeGate } from "./_shared/auth";

export const handler = async (event: any) => {
  const authHeader = String(event.headers?.authorization || event.headers?.Authorization || "").trim();
  const bearer = parseBearerToken(authHeader);
  const cookies = parseCookies(event.headers?.cookie);
  const bridgeToken = bearer || String(cookies["kx_gate_token"] || "").trim();

  if (bridgeToken) {
    try {
      await requestSkyeGate("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bridgeToken}`,
        },
      });
    } catch (_) {
      // ignore bridge failures during logout
    }
  }

  // Remove session record if possible.
  try {
    const token = cookies["kx_session"];
    if (token) {
      await q("delete from sessions where token=$1", [token]);
    }
  } catch (_) {
    // ignore errors
  }
  return json(
    200,
    { ok: true },
    { "Set-Cookie": clearSkyeGateCookie() }
  );
};
