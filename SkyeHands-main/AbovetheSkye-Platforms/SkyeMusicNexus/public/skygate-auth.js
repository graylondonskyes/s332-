(function initSkyGateBrowserAuth() {
  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeToken(value) {
    const raw = clean(value);
    if (!raw) return '';
    return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw;
  }

  window.createSkyGateAuth = function createSkyGateAuth(config) {
    const options = config || {};
    const storageKey = clean(options.storageKey || 'skygate_token');
    const sessionPath = clean(options.sessionPath || '/.netlify/functions/skygate-session');

    function readStorage(storage) {
      try {
        return normalizeToken(storage.getItem(storageKey));
      } catch {
        return '';
      }
    }

    function writeStorage(storage, token) {
      try {
        if (token) storage.setItem(storageKey, token);
        else storage.removeItem(storageKey);
      } catch {}
    }

    function getToken() {
      const sessionToken = readStorage(window.sessionStorage);
      if (sessionToken) return sessionToken;
      const legacyToken = readStorage(window.localStorage);
      if (legacyToken) {
        writeStorage(window.sessionStorage, legacyToken);
        writeStorage(window.localStorage, '');
      }
      return legacyToken;
    }

    function setToken(value) {
      const token = normalizeToken(value);
      writeStorage(window.sessionStorage, token);
      writeStorage(window.localStorage, '');
      return token;
    }

    function clearToken() {
      return setToken('');
    }

    async function bootstrapLocalProof(payload) {
      const response = await window.fetch(sessionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      const data = await response.json().catch(function parseFailure() { return {}; });
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Local proof session bootstrap failed.');
      }
      setToken(data.token);
      return data;
    }

    async function getSessionInfo() {
      const response = await window.fetch(sessionPath, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.json().catch(function parseFailure() { return {}; });
    }

    async function loginLocalOperator(credentials) {
      const payload = credentials || {};
      const response = await window.fetch(sessionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantType: 'password',
          email: clean(payload.email || payload.username),
          password: clean(payload.password),
          subject: clean(payload.subject),
          role: clean(payload.role),
        }),
      });
      const data = await response.json().catch(function parseFailure() { return {}; });
      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Local operator login failed.');
      }
      setToken(data.token);
      return data;
    }

    async function authFetch(url, init, authOptions) {
      const requestInit = init || {};
      const opts = authOptions || {};
      const headers = new window.Headers(requestInit.headers || {});
      if (opts.auth !== false) {
        const token = getToken();
        if (!token) {
          throw new Error(opts.missingAuthMessage || 'Connect a SkyGate token before using this action.');
        }
        headers.set('Authorization', 'Bearer ' + token);
      }
      return window.fetch(url, { ...requestInit, headers });
    }

    return {
      storageKey,
      sessionPath,
      getToken,
      setToken,
      clearToken,
      hasToken: function hasToken() { return Boolean(getToken()); },
      getSessionInfo,
      bootstrapLocalProof,
      loginLocalOperator,
      fetch: authFetch,
    };
  };
})();
