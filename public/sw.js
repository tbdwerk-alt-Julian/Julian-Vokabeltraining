// Minimaler Service Worker: macht die App installierbar ("Zum Home-Bildschirm").
// Lädt immer frisch vom Server; Modelle werden nach dem ersten Laden zwischengespeichert.
const CACHE = 'vocabquest-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/models/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(e.request); if (hit) return hit; const res = await fetch(e.request); if (res.ok) c.put(e.request, res.clone()); return res; }));
  }
});
