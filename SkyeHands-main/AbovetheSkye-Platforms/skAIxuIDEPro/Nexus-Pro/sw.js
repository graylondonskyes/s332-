const CACHE = 'nexuspro-v1';
const SHELL = ['/Nexus-Pro/NexusPro.html', '/Nexus-Pro/manifest.json'];
const NETWORK_FIRST = ['kaixugateway', '/api/', 'fonts.googleapis', 'fonts.gstatic', 'placehold.co'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  const netFirst = NETWORK_FIRST.some(p => url.includes(p));
  if (netFirst) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match('/Nexus-Pro/NexusPro.html'));
      })
    );
  }
});
