
const CACHE_NAME = 'pwa-cache-1771428081142';
const URLS_TO_CACHE = ["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","https://cdn.tailwindcss.com","https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js","https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js","https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js","https://unpkg.com/lucide@latest","https://cdn1.sharemyimage.com/2026/02/09/SOL_Tiger_Logo_transparent_cropped.png","https://cdn1.sharemyimage.com/2025/12/15/5645626565959.png","https://cdn1.sharemyimage.com/2026/01/08/Untitled-design-35.png"];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Force cache all identified assets
        return cache.addAll(URLS_TO_CACHE).catch(err => {
            console.error('Failed to cache some assets:', err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(
          function(response) {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        ).catch(() => {
            // Offline fallback for navigation
            if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});