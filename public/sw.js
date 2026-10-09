// Ovie service worker.
// - Pages: network first, so a new deploy is used straight away. The cached copy is
//   only used when the network is down, and the app then shows "Offline – reconnecting".
// - assets/* (hashed file names, never change): cache first.
// - Everything else (Supabase API, fonts, version.json): straight to the network.
// Works at / (local) and /Ovie/ (GitHub Pages): everything is relative to where the worker lives.
const BASE = new URL(self.registration.scope).pathname;
const SHELL = 'ovie-shell-v1';
const ASSETS = 'ovie-assets-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS]);
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          const cache = await caches.open(SHELL);
          cache.put(BASE, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(BASE);
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith(BASE + 'assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSETS);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});
