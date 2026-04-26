const CACHE = "sky-audit-ready-v2";
const APP_SCOPE = new URL(self.registration.scope);
const scoped = (path = "") => new URL(path, APP_SCOPE).toString();
const APP_SHELL = scoped("index.html");
const PRECACHE = [
  APP_SCOPE.href,
  APP_SHELL,
  scoped("assets/styles.css"),
  scoped("assets/app.js"),
  scoped("manifest.webmanifest"),
  scoped("audit_console_stress_test_import.json"),
  scoped("icon-192.png"),
  scoped("icon-512.png"),
  scoped("apple-touch-icon.png")
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE ? null : caches.delete(key))));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(APP_SHELL, fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match(APP_SHELL)) || new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" }
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true }) || await cache.match(url.href, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && res.ok) {
        cache.put(req, res.clone());
      }
      return res;
    } catch (error) {
      return cached || (await cache.match(APP_SHELL)) || new Response("", { status: 504 });
    }
  })());
});
