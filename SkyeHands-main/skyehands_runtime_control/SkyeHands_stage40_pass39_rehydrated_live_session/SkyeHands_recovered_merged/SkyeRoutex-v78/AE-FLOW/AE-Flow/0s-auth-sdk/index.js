(function (global) {
  const sdk = {
    version: "v78-local-stub",
    isStub: true,
    mountedAt: "./0s-auth-sdk/index.js",
    status: "ready",
    getSession() { return null; },
    isAuthenticated() { return false; },
    signIn() { return Promise.resolve({ ok: false, stub: true, reason: "local_stub" }); },
    signOut() { return Promise.resolve({ ok: true, stub: true }); }
  };

  global.ZeroSAuthSDK = sdk;
  global.zeroSAuthSDK = sdk;

  try {
    global.dispatchEvent(new CustomEvent("zeros-auth-sdk-ready", { detail: sdk }));
  } catch (error) {}
})(window);
