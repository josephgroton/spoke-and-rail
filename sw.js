const CACHE = 'velorail-v1';
const CDN = [
  '/velorail/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CDN)).then(() => self.skipWaiting())
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

  // Always network for geocoding and routing APIs
  if (url.hostname === 'nominatim.openstreetmap.org' ||
      url.hostname === 'router.hereapi.com' ||
      url.hostname === 'router.project-osrm.org') return;

  // Network-first for the HTML page — always get the latest version
  if (url.hostname === 'josephgroton.github.io' && (url.pathname.endsWith('/') || url.pathname.endsWith('.html'))) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for CDN assets (Leaflet never changes)
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'josephgroton.github.io') {
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

  // Stale-while-revalidate for map tiles
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
