/* rappdex service worker — offline-first for the shell, network-first for the map.

   The shell is precached so the app opens with no network at all. The live
   mapp.json is deliberately NOT cached-first: the dex should track the map
   when it can reach it, and fall back to the vendored snapshot when it can't.
*/
const VERSION = 'rappdex-v2';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './allele.js',
  './pets.js',
  './mapp.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // Never cache the live map — app.js already falls back to the vendored copy.
  if (request.url.includes('raw.githubusercontent.com')) return;

  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok && new URL(request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
