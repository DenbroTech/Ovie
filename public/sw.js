/* Ovie service worker.
 *
 * Ovie needs the internet (Supabase), so this worker is NOT an offline-first
 * cache. Its jobs are:
 *   1. App shell (HTML) is network-first, so a new deploy is picked up on the
 *      next load and never hidden behind a stale cache.
 *   2. Hashed build assets (/assets/*) are cache-first; their names change
 *      on every build, so they can never be stale.
 *   3. If the network is down, serve the last shell so the app can show its
 *      "offline / reconnecting" state instead of a browser error page.
 *   4. A new worker activates immediately; the page reloads onto it.
 */
const SHELL_CACHE = 'ovie-shell-v1';
const ASSET_CACHE = 'ovie-assets-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
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
  if (url.origin !== self.location.origin) return; // Supabase etc. go straight to network

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstShell(req));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(req));
  }
});

async function networkFirstShell(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) {
      await cache.put('/', res.clone());
      pruneAssets(res.clone()); // fire and forget
    }
    return res;
  } catch {
    const cached = await cache.match('/');
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta name="viewport" content="width=device-width"><title>Ovie</title>' +
        '<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">' +
        '<p>Ovie is offline. Reconnecting…</p><script>setTimeout(()=>location.reload(),5000)</script>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
    );
  }
}

// Keep only the hashed assets the current shell references, so old builds
// don't pile up in the cache.
async function pruneAssets(shellRes) {
  try {
    const html = await shellRes.text();
    const used = new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? []);
    const cache = await caches.open(ASSET_CACHE);
    for (const req of await cache.keys()) {
      const path = new URL(req.url).pathname;
      // Lazy-loaded chunks aren't in the HTML; only prune entry files of old builds.
      if (/\/assets\/index-[^/]+\.(js|css)$/.test(path) && !used.has(path)) await cache.delete(req);
    }
  } catch {
    // pruning is best effort
  }
}

async function cacheFirstAsset(req) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
