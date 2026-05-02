import { getUserById } from "./identity.js";
import { createSession, verifySessionToken } from "./sessions.js";
import { lookupKeyById } from "./authz.js";
import { issueAccessToken, verifyAccessToken } from "./oauth.js";

export async function issueKeyBoundSession(keyRow, { ttlSeconds, issuer = null }) {
  return await createSession({
    customerId: keyRow.customer_id,
    apiKeyId: keyRow.api_key_id,
    sessionKind: "key_bridge",
    scope: ["gateway.invoke", "gateway.read"],
    ttlSeconds,
    title: `Bridge session for key ${keyRow.key_last4 || keyRow.api_key_id}`,
    meta: { bridge: "session-token" },
    issuer
  });
}

export async function resolveGatewayPrincipal(token) {
  const session = await verifySessionToken(token);
  if (session?.session?.api_key_id) {
    const keyRow = await lookupKeyById(session.session.api_key_id);
    if (!keyRow) return null;
    return { mode: "session", keyRow, session };
  }

  const access = await verifyAccessToken(token);
  if (access?.payload?.api_key_id) {
    const keyRow = await lookupKeyById(access.payload.api_key_id);
    if (!keyRow) return null;
    return { mode: "oauth", keyRow, access };
  }

  return null;
}

export async function issueClientAccessBridge({ client, session, user, scope, audience, apiKeyId = null, issuer = null }) {
  return await issueAccessToken({
    user,
    client,
    session: session ? { ...session, api_key_id: apiKeyId ?? session.api_key_id ?? null } : null,
    scope,
    audience,
    issuer,
    extraClaims: {
      api_key_id: apiKeyId ?? session?.api_key_id ?? null
    }
  });
}
