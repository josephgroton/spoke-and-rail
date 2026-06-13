const CACHE = 'spoke-rail-v1';
const SHELL = [
  '/spoke-and-rail/',
  '/spoke-and-rail/index.html',
  '/spoke-and-rail/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for geocoding — stale results are useless
  if (url.hostname === 'nominatim.openstreetmap.org') return;

  // Cache-first for the app shell and CDN assets (they don't change)
  if (url.hostname === 'josephgroton.github.io' || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(e.request).then(cached => cached ||
        fetch(e.request).then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // Stale-while-revalidate for map tiles — show cached instantly, refresh in background
  if (url.hostname.includes('cartocdn.com')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fresh = fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res; });
          return cached || fresh;
        })
      )
    );
  }
});
