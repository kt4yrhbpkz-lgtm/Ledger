// Ledger service worker — network-first with offline fallback.
//
// Strategy choice matters here: the app is updated by replacing index.html
// on GitHub Pages and reloading, often several times a day during active
// development. A cache-first worker would keep serving the OLD version
// after an update (needing a second reload, or worse, a confusing stale
// session) — so this worker always tries the network first and only falls
// back to the cached copy when the network is unavailable. Online behavior
// is therefore identical to having no service worker at all; the cache
// only ever shows up when offline, where it makes the app fully usable
// (all data already lives in localStorage on the device).
var CACHE_NAME = 'ledger-shell-v1';

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(['./', './manifest.webmanifest', './icon-192.png', './icon-512.png']);
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Keep the cached copy fresh with every successful network load,
        // so the offline fallback is always the last version actually used.
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          // A navigation with no exact cache match still gets the app
          // shell, so opening the PWA offline always works.
          return cached || caches.match('./');
        });
      })
  );
});
