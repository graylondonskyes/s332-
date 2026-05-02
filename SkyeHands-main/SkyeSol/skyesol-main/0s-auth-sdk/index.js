(function () {
  const storage = window.SkyeStandaloneSession;

  function resolveAuthOrigin() {
    const origin = String(
      window.SKYGATEFS13_ORIGIN ||
      localStorage.getItem("SKYGATEFS13_ORIGIN") ||
      localStorage.getItem("skygate.authOrigin") ||
      ""
    ).trim().replace(/\/+$/, "");
    return origin;
  }

  function loginUrl(returnTo) {
    const target = returnTo || window.location.pathname + window.location.search + window.location.hash;
    const authOrigin = resolveAuthOrigin();
    const suffix = authOrigin ? "&auth_origin=" + encodeURIComponent(authOrigin) : "";
    return "/0s-auth-sdk/0s-login.html?return_to=" + encodeURIComponent(target) + suffix;
  }

  function currentSession() {
    if (!storage) return null;
    const token = typeof storage.getToken === "function" ? storage.getToken() : "";
    const email = typeof storage.getTokenEmail === "function" ? storage.getTokenEmail() : "";
    if (!token) return null;
    return {
      email: email || null,
      token,
      auth_source: "skygatefs13-bridge",
      auth_origin: resolveAuthOrigin() || null,
    };
  }

  function currentToken() {
    if (!storage) return "";
    return storage.getToken();
  }

  async function getSession() {
    return currentSession();
  }

  function getToken() {
    return currentToken();
  }

  function setSession(session, token) {
    if (!storage || typeof storage.saveManualToken !== "function") return session;
    const email = session?.email || session?.user?.email || "";
    storage.saveManualToken(token || session?.token || "", email);
    return currentSession();
  }

  function clearSession() {
    if (storage && typeof storage.clearToken === "function") storage.clearToken();
  }

  function requireSession(returnTo) {
    const session = currentSession();
    if (!session) {
      window.location.assign(loginUrl(returnTo));
      return false;
    }
    return true;
  }

  function logout(returnTo) {
    clearSession();
    window.location.assign(loginUrl(returnTo || "/"));
  }

  window.OmegaAuth = {
    getSession,
    getToken,
    setSession,
    clearSession,
    requireSession,
    logout,
  };
})();
