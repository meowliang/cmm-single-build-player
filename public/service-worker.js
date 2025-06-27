const CACHE_NAME = 'cmm-player-cache-v1';
const MEDIA_CACHE_NAME = 'cmm-media-cache-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/static/js/bundle.js',
        '/manifest.json'
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== MEDIA_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Message event - handle download requests
self.addEventListener('message', (event) => {
  if (event.data.type === 'CACHE_MEDIA') {
    console.log('Service Worker: Received cache media request for', event.data.urls.length, 'files');
    event.waitUntil(cacheMediaFiles(event.data.urls));
  } else if (event.data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(getCacheStatus(event.data.urls).then(status => {
      event.ports[0].postMessage(status);
    }));
  }
});


// Cache media files
async function cacheMediaFiles(urls) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const promises = urls.map(async (url) => {
    try {
      console.log('Service Worker: Caching', url);
      const response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        await cache.put(url, response.clone());
        console.log('Service Worker: Successfully cached', url);
        return { url, status: 'success' };
      } else {
        console.log('Service Worker: Failed to cache', url, 'Status:', response.status);
        return { url, status: 'failed', error: response.status };
      }
    } catch (error) {
      console.log('Service Worker: Error caching', url, error);
      return { url, status: 'error', error: error.message };
    }
  });

  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.length - successCount;
  
  console.log(`Service Worker: Caching complete. ${successCount} successful, ${failedCount} failed`);
  
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
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const status = {};
  
  for (const url of urls) {
    const response = await cache.match(url);
    status[url] = !!response;
  }
  
  return status;
}

// Fetch event - serve from cache when available
self.addEventListener('fetch', (event) => {
  // Only handle media requests
  const isMediaRequest = event.request.url.match(/\.(mp3|mp4|jpg|jpeg|png|gif|webp)$/i);
  
  if (isMediaRequest) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request);
      })
    );
  }
}); 