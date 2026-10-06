/* Daily Tracker service worker: offline app shell. Bump CACHE when shipping changes. */
const CACHE = 'daily-tracker-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('daily-tracker-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheable(res) {
  return res && res.ok && !res.redirected && res.type === 'basic';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Stale-while-revalidate for the app shell: instant + offline, updates on next launch.
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const cached = await c.match('./index.html');
      const net = fetch(req).then((res) => {
        if (cacheable(res)) c.put('./index.html', res.clone());
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(net); return cached; }
      return (await net) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }));
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
