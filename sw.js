// Planejador Renno — service worker
// Strategy: conservative network-first so the app is always fresh.
// We only cache the manifest + icon for offline fallback. HTML/JS/CSS
// are served fresh from the network; if offline, the browser falls back
// to whatever pages are already cached by the HTTP cache.

var CACHE = 'planejador-shell-v1';
var SHELL = ['/manifest.json', '/icon.svg'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                             .map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for everything; fallback to cache only if offline.
  event.respondWith(
    fetch(req).catch(function () { return caches.match(req); })
  );
});
