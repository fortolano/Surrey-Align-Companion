let APP_CACHE = 'surreyalign-app-v14';
let ASSET_CACHE = 'surreyalign-assets-v14';
let SENSITIVE_PREFIXES = ['/api/', '/auth/'];
let STATIC_FILE_RE = /\.(?:css|js|png|jpe?g|svg|webp|ico|woff2?|ttf|map)$/i;
let PRECACHE_URLS = [
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

  let destination = request.destination;
  if (destination === 'script' || destination === 'style' || destination === 'image' || destination === 'font') {
    return true;
  }

  return STATIC_FILE_RE.test(url.pathname);
}

function cacheResponse(cacheName, request, response) {
  if (!response || response.status !== 200) return;

  let cacheControl = response.headers.get('Cache-Control') || '';
  if (/no-store|private/i.test(cacheControl)) return;

  caches.open(cacheName).then(function(cache) {
    cache.put(request, response.clone());
  });
}

function firstString(value) {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) && value.length > 0) return firstString(value[0]);
  return null;
}

function buildInternalPath(pathname, params) {
  let url = new URL(pathname, self.location.origin);

  Object.keys(params || {}).forEach(function(key) {
    let value = params[key];
    if (value === null || typeof value === 'undefined' || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function normalizeTargetUrl(targetUrl) {
  try {
    return new URL(targetUrl || '/notifications', self.location.origin).toString();
  } catch (_error) {
    return new URL('/notifications', self.location.origin).toString();
  }
}

function resolvePushTarget(payload) {
  let action = payload && payload.app_action ? payload.app_action : {};
  let params = action && action.params ? action.params : {};
  let actionName = action && action.name ? action.name : '';

  switch (actionName) {
    case 'calling_request.detail': {
      let callingRequestId = firstString(params.calling_request_id);
      if (callingRequestId) {
        return buildInternalPath('/calling-detail', {
          id: callingRequestId,
          tab: firstString(params.tab),
          returnTo: '/notifications',
        });
      }
      break;
    }

    case 'goal.detail': {
      let goalId = firstString(params.goal_id) || firstString(params.goalId);
      if (goalId) {
        return buildInternalPath('/goal-detail', {
          goalId: goalId,
          returnTo: '/notifications',
        });
      }
      break;
    }

    case 'agenda.detail': {
      let agendaId = firstString(params.agenda_id) || firstString(params.agendaId);
      if (agendaId) {
        return buildInternalPath('/agenda-entity', {
          agendaId: agendaId,
          returnTo: '/notifications',
        });
      }
      break;
    }

    case 'agenda.item_detail':
      return buildInternalPath('/assignments', { returnTo: '/notifications' });

    case 'agenda.submission_detail': {
      let targetAgendaId = firstString(params.target_agenda_id) || firstString(params.agenda_id);
      if (targetAgendaId) {
        return buildInternalPath('/agenda-entity', {
          agendaId: targetAgendaId,
          returnTo: '/notifications',
        });
      }
      break;
    }

    case 'sunday_business.index':
      return buildInternalPath('/sunday-business', { returnTo: '/notifications' });

    case 'speaking.swap_detail':
      return buildInternalPath('/speaking-assignments', { returnTo: '/notifications' });

    case 'checkin.detail':
      return buildInternalPath('/align-pulse', { returnTo: '/notifications' });

    case 'announcement.active':
      return buildInternalPath('/sacrament-overview', {
        wardId: firstString(params.ward_id),
        announcementId: firstString(params.announcement_id),
        returnTo: '/notifications',
      });

    case 'web.open':
      return normalizeTargetUrl(action.fallback_url || payload.target_url);

    default:
      break;
  }

  if (action && action.fallback_url) {
    return normalizeTargetUrl(action.fallback_url);
  }

  return normalizeTargetUrl(payload && payload.target_url ? payload.target_url : '/notifications');
}

function parsePushPayload(event) {
  if (!event.data) return {};

  try {
    return event.data.json() || {};
  } catch (_error) {
    let text = '';

    try {
      text = event.data.text() || '';
    } catch (_nestedError) {
      text = '';
    }

    return {
      title: 'SurreyALIGN',
      body: text,
    };
  }
}

function focusOrOpenClient(targetUrl) {
  let resolvedUrl = normalizeTargetUrl(targetUrl);

  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
    for (let i = 0; i < clientList.length; i += 1) {
      const client = clientList[i];

      if (!client || !client.url) continue;

      try {
        let clientUrl = new URL(client.url);
        if (clientUrl.origin !== self.location.origin) continue;
      } catch (_error) {
        continue;
      }

      return client.navigate(resolvedUrl).then(function() {
        return client.focus();
      }).catch(function() {
        return client.focus();
      });
    }

    return self.clients.openWindow(resolvedUrl);
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(APP_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
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
    }).then(function() {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        return Promise.all(
          clientList.map(function(client) {
            return client.navigate(client.url);
          })
        );
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', function(event) {
  let payload = parsePushPayload(event);
  let title = firstString(payload.title) || 'SurreyALIGN';
  let body = firstString(payload.body) || 'Open SurreyALIGN to view this update.';
  let targetUrl = resolvePushTarget(payload);

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      tag: firstString(payload.tag) || 'surreyalign-notification',
      icon: firstString(payload.icon) || '/icon-192.png',
      badge: firstString(payload.badge) || '/icon-192.png',
      data: {
        targetUrl: targetUrl,
      },
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  let targetUrl = event.notification && event.notification.data
    ? event.notification.data.targetUrl
    : '/notifications';

  event.waitUntil(focusOrOpenClient(targetUrl));
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  let url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('/offline.html').then(function(cachedOffline) {
          return cachedOffline || caches.match('/');
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
