const CACHE_NAME = 'printful-pod-v2';
const ASSETS = [
  './',
  './index.html',
  './assets/css/printful-edm.css',
  './assets/js/partial-loader.js',
  './assets/js/printful-edm-config.js',
  './assets/js/printful-edm.js',
  './partials/designer-shell.html',
  './config/storefront-products.json',
  './assets/img/tee-placeholder.svg',
  './assets/img/mug-placeholder.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
