// Ovie service worker.
// - Pages: network first, so a new deploy is used straight away. The cached copy is
//   only used when the network is down (the app then carries on with its saved data).
// - assets/* (hashed file names, never change): cache first.
// - sheep/, icons/, favicon: cache first (kept offline; the sheep are saved on install).
// - Screensaver photos (Supabase storage links): network first, kept by photo path so they show offline.
// - Everything else (Supabase API, fonts, version.json): straight to the network. The app keeps its own
//   offline copy of the data (src/lib/offline.ts).
// Works at / (local) and /Ovie/ (GitHub Pages): everything is relative to where the worker lives.
const BASE = new URL(self.registration.scope).pathname;
const SHELL = 'ovie-shell-v1';
const ASSETS = 'ovie-assets-v1';
const PICS = 'ovie-pics-v1';
const PHOTOS = 'ovie-photos-v1';
const SHEEP = ['happy', 'sad', 'angry', 'excited', 'worried', 'sleepy', 'surprised', 'in-love', 'cool', 'silly',
  'shocked', 'tired', 'thinking', 'celebrating', 'hungry', 'working', 'shopping', 'calendar', 'watch', 'photos',
  'alarms', 'finances', 'settings'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Save every Ovie picture now, so none is missing when the screen is offline.
  event.waitUntil(
    caches.open(PICS)
      .then((c) => c.addAll([...SHEEP.map((m) => `${BASE}sheep/${m}.webp`), `${BASE}favicon.png`, `${BASE}icons/icon-192.png`]))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS, PICS, PHOTOS]);
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

  // Screensaver photos: private links change every hour, so keep them by the photo's path.
  if (url.pathname.includes('/storage/v1/object/sign/ovie-photos/')) {
    event.respondWith(
      (async () => {
        const key = url.origin + url.pathname;
        const cache = await caches.open(PHOTOS);
        try {
          const res = await fetch(req);
          if (res.ok || res.type === 'opaque') cache.put(key, res.clone());
          return res;
        } catch {
          return (await cache.match(key)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // GIFs on notes: keep a copy so they still show offline.
  if (/^(media[0-9]?\.giphy\.com|i\.giphy\.com|static\.klipy\.com)$/.test(url.hostname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PHOTOS);
        const hit = await cache.match(req.url);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req.url, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(BASE + 'sheep/') || url.pathname.startsWith(BASE + 'icons/') || url.pathname === BASE + 'favicon.png') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PICS);
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

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
