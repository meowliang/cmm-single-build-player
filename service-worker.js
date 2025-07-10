const STATIC_CACHE = 'cmm-static-v1';
const MEDIA_CACHE = 'cmm-media-cache-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/cmm-single-build-player/',
  '/cmm-single-build-player/index.html',
  '/cmm-single-build-player/manifest.json',
  '/cmm-single-build-player/favicon.ico',
  '/cmm-single-build-player/logo192.png',
  '/cmm-single-build-player/logo512.png',
  '/cmm-single-build-player/styles.css',
  '/cmm-single-build-player/app.js',
  '/cmm-single-build-player/playlists.json',
  '/cmm-single-build-player/libs/aframe-v1.7.1.min.js',
  '/cmm-single-build-player/libs/aframe.min.js',
  '/cmm-single-build-player/libs/aframe-master.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] 🚀 Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] 📁 Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] ✅ Static files cached successfully');
        console.log('[SW] 🚀 Skipping waiting to activate immediately');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] ❌ Error caching static files:', error);
        // Still skip waiting even if some files fail to cache
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] 🔄 Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW] 📋 Found caches:', cacheNames);
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== MEDIA_CACHE) {
            console.log('[SW] 🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] ✅ Activated and claiming clients');
      return self.clients.claim();
    }).then(() => {
      console.log('[SW] ✅ Service Worker is now controlling all clients');
      // Notify all clients that the service worker is ready
      return self.clients.matchAll().then(clients => {
        console.log('[SW] 📨 Notifying', clients.length, 'clients that service worker is ready');
        clients.forEach(client => {
          client.postMessage({
            type: 'SERVICE_WORKER_READY',
            message: 'Service Worker is now controlling this page'
          });
        });
      });
    }).catch((error) => {
      console.error('[SW] ❌ Error during activation:', error);
    })
  );
});

// Message event - handle download requests
self.addEventListener('message', (event) => {
  console.log('[SW] 📨 Received message:', event.data);
  
  if (event.data.type === 'CACHE_MEDIA') {
    console.log('[SW] 📥 Received cache media request for', event.data.urls.length, 'files');
    event.waitUntil(cacheMediaFiles(event.data.urls));
  } else if (event.data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(getCacheStatus(event.data.urls).then(status => {
      event.ports[0].postMessage(status);
    }));
  } else if (event.data.type === 'PING') {
    // Simple ping to test if service worker is responding
    console.log('[SW] 🏓 Pong! Service worker is alive');
    event.ports[0].postMessage({ type: 'PONG', message: 'Service worker is alive' });
  }
});

// Cache media files (used by download feature)
async function cacheMediaFiles(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  console.log('[SW] Starting to cache', urls.length, 'files');
  
  // Log XR videos specifically
  const xrVideos = urls.filter(url => url.includes('XR-CHAPTERS') || url.includes('XR_Scene'));
  if (xrVideos.length > 0) {
    console.log('[SW] XR videos to cache:', xrVideos);
  }
  
  const promises = urls.map(async (url) => {
    try {
      console.log('[SW] Caching', url);
      
      // Try with CORS first
      let req = new Request(url, {
        mode: 'cors',
        credentials: 'omit'
      });
      let response = await fetch(req);
      
      // If CORS fails, try without CORS for images and videos
      if (!response.ok && (url.match(/\.(jpg|jpeg|png|gif|webp|mp4)$/i) || url.includes('XR-CHAPTERS'))) {
        console.log('[SW] CORS failed for media, trying no-cors mode:', url);
        req = new Request(url, {
          mode: 'no-cors',
          credentials: 'omit'
        });
        response = await fetch(req);
      }
      
      if (response.ok || response.type === 'opaque') {
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
  
  // Log XR video results specifically
  const xrResults = results.filter(r => r.url.includes('XR-CHAPTERS') || r.url.includes('XR_Scene'));
  if (xrResults.length > 0) {
    console.log('[SW] XR video caching results:', xrResults);
  }
  
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
    const req = new Request(url, {
      mode: 'cors',
      credentials: 'omit'
    });
    const response = await cache.match(req);
    status[url] = !!response;
  }
  return status;
}

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    console.log('[SW] Skipping non-GET request:', request.method, request.url);
    return;
  }
  
  console.log('[SW] Fetch event for:', request.url);
  console.log('[SW] Request method:', request.method);
  console.log('[SW] Request mode:', request.mode);

  if (isMediaRequest(request)) {
    console.log('[SW] Handling as media request');
    event.respondWith(handleMediaRequest(request));
  } else if (isStaticRequest(request)) {
    console.log('[SW] Handling as static request');
    event.respondWith(handleStaticRequest(request));
  } else {
    console.log('[SW] Handling as other request');
    event.respondWith(handleOtherRequest(request));
  }
});

// Check if request is for media files
function isMediaRequest(request) {
  const url = request.url.toLowerCase();
  const isMediaFile = url.match(/\.(mp3|mp4|jpg|jpeg|png|gif|webp)$/i);
  const isS3Media = url.includes('s3.us-west-1.amazonaws.com');
  const isXRVideo = url.includes('XR-CHAPTERS') || url.includes('XR_Scene');
  const isMediaRequest = isMediaFile || isS3Media || isXRVideo;
  
  console.log('[SW] Media request check:', {
    url: request.url,
    isMediaFile,
    isS3Media,
    isXRVideo,
    isMediaRequest
  });
  
  return isMediaRequest;
}

// Check if request is for static files
function isStaticRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Check if it's in our static files list
  if (STATIC_FILES.includes(pathname)) {
    return true;
  }
  
  // Check if it's a JavaScript library file (like A-Frame)
  const isLibraryFile = pathname.includes('/cmm-single-build-player/libs/') && pathname.endsWith('.js');
  
  // Check if it's from our origin and within our app path
  const isSameOrigin = url.origin === self.location.origin;
  const isAppPath = pathname.startsWith('/cmm-single-build-player/');
  
  // Check if it's a static asset type
  const isStaticAsset = pathname.match(/\.(js|css|html|json|ico|png|jpg|jpeg|gif|webp|svg|ttf|woff|woff2)$/i);
  
  return isLibraryFile || (isSameOrigin && isAppPath && isStaticAsset);
}

// Handle media requests with cache-first strategy, always cache on fetch miss
async function handleMediaRequest(request) {
  console.log('[SW] handleMediaRequest called for:', request.url);
  
  // Create a consistent request object for caching
  const req = new Request(request.url, {
    mode: 'cors',
    credentials: 'omit'
  });
  
  try {
    const cache = await caches.open(MEDIA_CACHE);
    console.log('[SW] Checking cache for:', request.url);
    
    // Try to get from cache first
    const cachedResponse = await cache.match(req);
    if (cachedResponse) {
      console.log('[SW] ✅ Serving media from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] ❌ Not in cache, fetching from network:', request.url);
    
    // Not in cache, fetch from network
    // For XR videos and other media, try with CORS first, then without CORS as fallback
    let networkResponse;
    try {
      networkResponse = await fetch(req);
    } catch (corsError) {
      console.log('[SW] CORS error, trying without CORS mode:', corsError.message);
      // Try without CORS mode for images and videos
      const noCorsReq = new Request(request.url, {
        mode: 'no-cors',
        credentials: 'omit'
      });
      networkResponse = await fetch(noCorsReq);
    }
    
    console.log('[SW] Network response status:', networkResponse.status, 'for:', request.url);
    
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      // Cache the response for future use
      await cache.put(req, networkResponse.clone());
      console.log('[SW] ✅ Cached media file:', request.url);
    } else {
      console.warn('[SW] ⚠️ Network response not ok for', request.url, networkResponse.status);
      // For failed requests, still try to return the response to avoid breaking the app
      if (networkResponse.status === 404) {
        console.warn('[SW] ⚠️ 404 error for media file:', request.url);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] ❌ Error handling media request:', error);
    console.error('[SW] Error details:', {
      url: request.url,
      error: error.message,
      stack: error.stack
    });
    
    // Try to serve from cache as fallback even if there was an error
    try {
      const cache = await caches.open(MEDIA_CACHE);
      const fallbackResponse = await cache.match(req);
      if (fallbackResponse) {
        console.log('[SW] ✅ Serving from cache as fallback:', request.url);
        return fallbackResponse;
      }
    } catch (fallbackError) {
      console.error('[SW] ❌ Fallback cache check also failed:', fallbackError);
    }
    
    // For XR videos, return a more specific error
    if (request.url.includes('XR-CHAPTERS') || request.url.includes('XR_Scene')) {
      console.error('[SW] ❌ XR video not available offline:', request.url);
      return new Response('XR video not available offline. Please download content first.', { 
        status: 503,
        statusText: 'XR video not cached'
      });
    }
    
    return new Response('Media not available offline. Please download content first.', { 
      status: 503,
      statusText: 'Media not cached'
    });
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const url = new URL(request.url);
    
    console.log('[SW] Handling static request for:', url.pathname);
    
    // Try to match by pathname for robust static file serving
    let cachedResponse = await cache.match(url.pathname);
    
    // Also try to match by full URL for external resources
    if (!cachedResponse) {
      cachedResponse = await cache.match(request.url);
    }
    
    if (cachedResponse) {
      console.log('[SW] ✅ Serving static file from cache:', url.pathname);
      return cachedResponse;
    }
    
    console.log('[SW] ❌ Static file not in cache, fetching from network:', url.pathname);
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      console.log('[SW] ✅ Caching static file:', url.pathname);
      await cache.put(url.pathname, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Error handling static request:', error);
    
    // For A-Frame and other critical library files, provide a more specific error
    if (request.url.includes('/cmm-single-build-player/libs/') && request.url.endsWith('.js')) {
      return new Response('Critical library file not available offline', { 
        status: 503,
        statusText: 'Library file not cached'
      });
    }
    
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