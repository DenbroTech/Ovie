/**
 * Registers the service worker and makes sure every device runs the newest
 * deploy: when a new worker takes control, the page reloads onto it.
 * The kiosk never gets a manual refresh, so we also poll for updates.
 */
const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  // Only reload when replacing an existing controller, not on first install.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      const check = () => reg.update().catch(() => undefined);
      setInterval(check, UPDATE_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.addEventListener('online', check);
    } catch (err) {
      console.warn('Service worker registration failed', err);
    }
  });
}
