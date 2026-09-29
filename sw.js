// Offline support: the app files are cached, so the reader works with no
// signal. Books themselves live in IndexedDB, not here.

const CACHE = 'listen-reader-v5';
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

// 'no-cache' revalidates with the server, so a deploy is never mixed with
// files still in the browser's HTTP cache (GitHub Pages caches for 10 min).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first, so every file on a page comes from the same deploy. The
// cached copy is used offline, or when the network takes over 3 seconds.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = () => cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request, { cache: 'no-cache' }).then((res) => {
        if (res.ok) cache.put(url.pathname, res.clone());
        return res;
      });
      const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const res = await Promise.race([network, timeout.then(cached)]);
        return res || (await network);
      } catch {
        return (await cached()) || Response.error();
      }
    }),
  );
});
