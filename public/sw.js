var APP_CACHE = 'surreyalign-app-v2';
var ASSET_CACHE = 'surreyalign-assets-v2';
var SENSITIVE_PREFIXES = ['/api/', '/auth/'];
var STATIC_FILE_RE = /\.(?:css|js|png|jpe?g|svg|webp|ico|woff2?|ttf|map)$/i;
var PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isSensitivePath(pathname) {
  return SENSITIVE_PREFIXES.some(function(prefix) {
    return pathname.indexOf(prefix) === 0;
  });
}

function isCacheableAsset(request, url) {
  if (!isSameOrigin(url)) return false;
  if (isSensitivePath(url.pathname)) return false;

  var destination = request.destination;
  if (destination === 'script' || destination === 'style' || destination === 'image' || destination === 'font') {
    return true;
  }

  return STATIC_FILE_RE.test(url.pathname);
}

function cacheResponse(cacheName, request, response) {
  if (!response || response.status !== 200) return;

  var cacheControl = response.headers.get('Cache-Control') || '';
  if (/no-store|private/i.test(cacheControl)) return;

  caches.open(cacheName).then(function(cache) {
    cache.put(request, response.clone());
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(APP_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(cacheName) {
            return cacheName !== APP_CACHE && cacheName !== ASSET_CACHE;
          })
          .map(function(cacheName) {
            return caches.delete(cacheName);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('/').then(function(cachedAppShell) {
          return cachedAppShell || caches.match('/offline.html');
        });
      })
    );
    return;
  }

  if (!isSameOrigin(url) || isSensitivePath(url.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isCacheableAsset(event.request, url)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;

        return fetch(event.request).then(function(response) {
          cacheResponse(ASSET_CACHE, event.request, response);
          return response;
        });
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
