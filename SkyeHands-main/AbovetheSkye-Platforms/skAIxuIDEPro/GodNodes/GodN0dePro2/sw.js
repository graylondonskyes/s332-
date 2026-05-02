const CACHE_NAME = "godnode2-portal-v2";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./GodNode2.html",
  "./BookOfGray_RoyalEdition.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigation requests: serve index.html when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Cache-first for other same-origin assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Update in background
        event.waitUntil(
          fetch(req)
            .then((resp) => {
              const copy = resp.clone();
              return caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            })
            .catch(() => {})
        );
        return cached;
      }

      return fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => cached);
    })
  );
});
