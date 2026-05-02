self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Pass everything through to network, this is a live-connected app
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
