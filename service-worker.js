// Service Worker — Celmedik Transporte (app del chofer)
// Estrategia: network-first para que el chofer siempre vea la última
// versión del HTML/JS cuando hay conexión; cache de respaldo para que
// la app abra sin internet (lista de OTs cargadas + shell básico).
//
// Las acciones del chofer sin conexión (En Ruta / Entregada + foto)
// se encolan en IndexedDB desde conductor.html y se sincronizan al
// volver online — ese flujo NO vive en este worker.

const CACHE_NAME = 'celmedik-conductor-v1';
const SHELL_URLS = [
  '/conductor.html',
  '/manifest.json',
  '/icon-conductor-192.svg',
  '/icon-conductor-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase / Google APIs: pass-through directo, nunca cachear.
  if (/firebaseio\.com|googleapis\.com|gstatic\.com|google-analytics\.com/.test(url.hostname)) return;

  // Rangos de media (fotos) y uploads a Storage: pass-through.
  if (req.headers.has('range')) return;

  // Shell y recursos del dominio: network-first con fallback a cache.
  event.respondWith(
    fetch(req).then(res => {
      // Cachea respuestas 200 del propio dominio.
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('/conductor.html')))
  );
});
