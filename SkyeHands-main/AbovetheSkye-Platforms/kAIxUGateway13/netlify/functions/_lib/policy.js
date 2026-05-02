export const KNOWN_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "gateway.invoke",
  "gateway.read",
  "keys.read",
  "keys.write",
  "admin.read",
  "admin.write",
  "billing.read",
  "billing.write"
];

export function hasScope(scopeList, required) {
  const scopes = new Set(Array.isArray(scopeList) ? scopeList : []);
  if (!required) return true;
  if (Array.isArray(required)) return required.every((scope) => scopes.has(scope));
  return scopes.has(required);
}

export function requireScopes(scopeList, required) {
  if (!hasScope(scopeList, required)) {
    const err = new Error("Insufficient scope");
    err.status = 403;
    err.code = "INSUFFICIENT_SCOPE";
    throw err;
  }
}

export function principalSummary(principal) {
  if (!principal) return null;
  return {
    type: principal.type || principal.payload?.type || "unknown",
    subject: principal.user?.id || principal.payload?.sub || null,
    role: principal.user?.role || principal.payload?.role || null,
    scope: principal.scope || principal.payload?.scope || []
  };
}
