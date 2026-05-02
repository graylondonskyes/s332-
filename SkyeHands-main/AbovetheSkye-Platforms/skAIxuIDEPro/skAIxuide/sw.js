
const CACHE_NAME = 'pwa-cache-1771570976539';
const URLS_TO_CACHE = ["./","./index.html","./manifest.json","../Images/icon-192.png","../Images/icon-512.png","https://cdn.tailwindcss.com","https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js","https://unpkg.com/lucide@latest","https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;900&family=JetBrains+Mono:wght@100..800&display=swap","https://cdn1.sharemyimage.com/2026/02/15/ChatGPT-Image-Feb-15-2026-05_15_46-AM-1.png","https://cdn1.sharemyimage.com/2026/02/15/Screenshot-2026-02-14-1.45.11-PM-3.png"];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE).catch(e => console.error(e)))); self.skipWaiting(); });
self.addEventListener('fetch', event => { 
    // Network First strategy for HTML navigation requests
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    const rc = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, rc));
                    return res;
                })
                .catch(() => caches.match(event.request) || caches.match('./index.html'))
        );
        return;
    }
    
    // Cache First for everything else
    event.respondWith(caches.match(event.request).then(response => response || fetch(event.request).then(res => { if(!res || res.status !== 200 || res.type !== 'basic') return res; const rc = res.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, rc)); return res; }).catch(() => null))); 
});
self.addEventListener('activate', event => { const whitelist = [CACHE_NAME]; event.waitUntil(caches.keys().then(names => Promise.all(names.map(n => whitelist.indexOf(n) === -1 ? caches.delete(n) : null)))); self.clients.claim(); });
