// Offline support: the app files are cached on first visit, so the reader works
// with no signal. Books themselves live in IndexedDB, not here.

const CACHE = 'listen-reader-v4';
const FILES = [
  './',
  'index.html',
  'chapters.html',
  'read.html',
  'style.css',
  'icons.svg',
  'common.js',
  'db.js',
  'import.js',
  'library.js',
  'chapters.js',
  'read.js',
  'speech.js',
  'vendor/jszip.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Serve from cache straight away and refresh it in the background, so an
// update on GitHub Pages shows up on the next visit.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(new URL(e.request.url).pathname, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
