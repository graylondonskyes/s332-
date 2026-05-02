const CACHE_NAME = 'dead-route-detector-skyevsx-v2';
const ASSETS = [
  'index.html',
  'scan.html',
  'demo.html',
  'install.html',
  'privacy.html',
  'styles.css',
  'app.js',
  'scanner-core.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'assets/sample-report.json',
  'assets/proof-fixture.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((response) => response || fetch(event.request)));
});
