// Service Worker: macht die App installierbar ("Zum Home-Bildschirm").
// Netzwerk zuerst; Modelle und Icons werden nach dem ersten Laden zwischengespeichert.
// Bei jedem Fehler wird einfach das Netzwerk benutzt – der SW darf nie eine Anfrage scheitern lassen.
const CACHE = 'vocabquest-v3';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))); await self.clients.claim(); })()); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (!(url.pathname.includes('/models/') || url.pathname.includes('/icons/'))) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request);
      if (res && res.ok && res.status === 200) { try { const c = await caches.open(CACHE); c.put(e.request, res.clone()); } catch (err) { } }
      return res;
    } catch (err) {
      try { const c = await caches.open(CACHE); const hit = await c.match(e.request); if (hit) return hit; } catch (e2) { }
      throw err;
    }
  })());
});
