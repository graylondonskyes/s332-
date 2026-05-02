const CACHE_NAME = 'skyewebcreatormax-v1';
const ASSETS = [
  './',
  './landing.html',
  './index.html',
  './homepage.html',
  './offline.html',
  './manifest.json',
  './manifest.webmanifest',
  './js/landing-scene.js',
  './js/donor-template-library.js',
  './js/webcreator.js',
  './js/skygate-client.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match('./offline.html')))
  );
});
