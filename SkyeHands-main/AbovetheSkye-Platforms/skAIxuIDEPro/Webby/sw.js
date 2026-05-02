/* Webby Service Worker — offline-first page builder */
const CACHE = 'webby-v1';
const SHELL = [
  '/Webby/Webby.html',
  '/Webby/manifest.json',
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);

  /* Always go network-first for API / gateway calls */
  if (url.pathname.includes('/api/') || url.hostname.includes('kaixugateway') || url.hostname.includes('fonts.googleapis') || url.hostname.includes('placehold.co')) {
    ev.respondWith(fetch(ev.request).catch(() => caches.match(ev.request)));
    return;
  }

  /* Cache-first for app shell */
  ev.respondWith(
    caches.match(ev.request).then(cached => {
      if (cached) return cached;
      return fetch(ev.request).then(resp => {
        if (resp && resp.status === 200 && ev.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(ev.request, clone));
        }
        return resp;
      }).catch(() => caches.match('/Webby/Webby.html'));
    })
  );
});
