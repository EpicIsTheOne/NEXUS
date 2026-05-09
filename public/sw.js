const CACHE_NAME = 'nexus-shell-user-placeholder-v52';
const IMAGE_CACHE_NAME = 'nexus-images-avatar-cache-v1';
const APP_SHELL = [
  '/aichat/',
  '/aichat/index.html',
  '/aichat/styles.css?v=user-placeholder-v50',
  '/aichat/app.js?v=user-placeholder-v54',
  '/aichat/manifest.webmanifest',
  '/aichat/icon.svg'
];

const IMAGE_PATH_RE = /^\/aichat\/assets\/(characters|local-characters|personas|backgrounds)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== IMAGE_CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/aichat')) return;

  if (IMAGE_PATH_RE.test(url.pathname) || request.destination === 'image') {
    event.respondWith(cacheFirstImage(request).catch(() => caches.match(request)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/aichat/index.html')));
    return;
  }

  const isFreshAsset = /\/(styles\.css|app\.js|sw\.js)$/.test(url.pathname);
  if (isFreshAsset) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
      return response;
    }))
  );
});
