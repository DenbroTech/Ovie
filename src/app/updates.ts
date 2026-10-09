// Make sure no screen (especially the kiosk) keeps running an old build after a deploy.

const CHECK_EVERY_MS = 5 * 60 * 1000;

async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { build?: string };
    return data.build ?? null;
  } catch {
    return null; // offline: try again later
  }
}

async function reloadToLatest() {
  try {
    if ('caches' in window) await caches.delete('ovie-assets-v1');
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export function startUpdateChecks() {
  if (import.meta.env.DEV) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      /* app still works without it */
    });
  }

  const check = async () => {
    const latest = await latestBuild();
    if (latest && latest !== __BUILD_ID__) await reloadToLatest();
  };
  window.setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.addEventListener('online', () => void check());
}
