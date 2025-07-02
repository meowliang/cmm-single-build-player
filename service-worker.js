const STATIC_CACHE = 'cmm-static-v1';
const MEDIA_CACHE = 'cmm-media-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/styles.css',
  '/app.js',
  '/playlists.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== MEDIA_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activated');
      return self.clients.claim();
    })
  );
});

// Message event - handle download requests
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_MEDIA') {
    console.log('[SW] Received cache media request for', event.data.urls.length, 'files');
    event.waitUntil(cacheMediaFiles(event.data.urls));
  } else if (event.data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(getCacheStatus(event.data.urls).then(status => {
      event.ports[0].postMessage(status);
    }));
  }
});

// Cache media files (used by download feature)
async function cacheMediaFiles(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  const promises = urls.map(async (url) => {
    try {
      const req = new Request(url, {mode: 'cors'});
      console.log('[SW] Caching', url);
      const response = await fetch(req);
      if (response.ok) {
        await cache.put(req, response.clone());
        console.log('[SW] Successfully cached', url);
        return { url, status: 'success' };
      } else {
        console.log('[SW] Failed to cache', url, 'Status:', response.status);
        return { url, status: 'failed', error: response.status };
      }
    } catch (error) {
      console.log('[SW] Error caching', url, error);
      return { url, status: 'error', error: error.message };
    }
  });

  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.length - successCount;
  
  console.log(`[SW] Caching complete. ${successCount} successful, ${failedCount} failed`);
  
  // Send progress update to main thread
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_PROGRESS',
        results,
        total: urls.length,
        successCount,
        failedCount
      });
    });
  });
}

// Get cache status for URLs
async function getCacheStatus(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  const status = {};
  for (const url of urls) {
    const req = new Request(url, {mode: 'cors'});
    const response = await cache.match(req);
    status[url] = !!response;
  }
  return status;
}

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isMediaRequest(request)) {
    event.respondWith(handleMediaRequest(request));
  } else if (isStaticRequest(request)) {
    event.respondWith(handleStaticRequest(request));
  } else {
    event.respondWith(handleOtherRequest(request));
  }
});

// Check if request is for media files
function isMediaRequest(request) {
  const url = request.url.toLowerCase();
  return url.match(/\.(mp3|mp4|jpg|jpeg|png|gif|webp)$/i) || url.includes('s3.us-west-1.amazonaws.com');
}

// Check if request is for static files
function isStaticRequest(request) {
  const url = new URL(request.url);
  return STATIC_FILES.includes(url.pathname) || url.origin === self.location.origin;
}

// Handle media requests with cache-first strategy, always cache on fetch miss
async function handleMediaRequest(request) {
  const req = new Request(request.url, {mode: 'cors'});
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const cachedResponse = await cache.match(req);
    if (cachedResponse) {
      console.log('[SW] Serving media from cache:', request.url);
      return cachedResponse;
    }
    // Not in cache, fetch and cache
    console.log('[SW] Fetching media from network:', request.url);
    const networkResponse = await fetch(req);
    if (networkResponse.ok) {
      await cache.put(req, networkResponse.clone());
      console.log('[SW] Cached media file:', request.url);
    } else {
      console.warn('[SW] Network response not ok for', request.url, networkResponse.status);
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Error handling media request:', error);
    return new Response('Media not available offline', { status: 404 });
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Error handling static request:', error);
    return new Response('Resource not available offline', { status: 404 });
  }
}

// Handle other requests with network-first strategy
async function handleOtherRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network request failed:', error);
    return new Response('Network error', { status: 503 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('[SW] Performing background sync...');
  // Add any background sync logic here
}

// Handle push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  event.waitUntil(
    self.registration.showNotification('CMM Player', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
}); 