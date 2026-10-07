// Service worker: caches only the app's own code (HTML, JS, CSS, icons) for offline use.
// Never caches users' word lists or settings: those never go over the network.
const VERSION = 'efc53807af';
const CACHE = `puzzle-maker-${VERSION}`;
const PRECACHE = ["./","assets/index-CBzbw3bB.js","assets/pdfVector-DsmZOfhA.js","assets/generator.worker-uLQZoT5K.js","assets/index-Dz9oTEGF.css","assets/sf-pro-display-bold-Bgh8z1DJ.woff2","assets/sf-pro-display-semibold-ZOznpXR9.woff2","assets/sf-pro-text-bold-DkMbQGED.woff2","assets/sf-pro-text-medium-Bnj9Hq3l.woff2","assets/sf-pro-text-regular-QSo_NMEO.woff2","assets/sf-pro-text-semibold-tq455XQE.woff2","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('puzzle-maker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)),
  );
});
