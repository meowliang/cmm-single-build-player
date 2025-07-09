const STATIC_CACHE = 'cmm-static-v1';
const MEDIA_CACHE = 'cmm-media-cache-v1';

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
  // A-Frame library - ensure this path is correct
  '/cmm-single-build-player/libs/aframe-v1.7.1.min.js',
  // Also cache the CDN version as fallback
  'https://cdnjs.cloudflare.com/ajax/libs/aframe/1.7.1/aframe.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache static files with better error handling
self.addEventListener('install', (event) => {
  console.log('[SW] 🚀 Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] 📁 Caching static files');
        // Cache files one by one to identify which ones fail
        return Promise.allSettled(
          STATIC_FILES.map(async (url) => {
            try {
              console.log('[SW] Caching:', url);
              const response = await fetch(url, {
                mode: url.startsWith('http') ? 'cors' : 'same-origin',
                credentials: 'omit'
              });
              
              if (response.ok) {
                await cache.put(url, response);
                console.log('[SW] ✅ Successfully cached:', url);
              } else {
                console.error('[SW] ❌ Failed to cache (bad response):', url, response.status);
              }
            } catch (error) {
              console.error('[SW] ❌ Failed to cache (error):', url, error);
              // For critical libraries like A-Frame, try alternative URLs
              if (url.includes('aframe')) {
                try {
                  const fallbackUrl = 'https://cdnjs.cloudflare.com/ajax/libs/aframe/1.7.1/aframe.min.js';
                  console.log('[SW] Trying A-Frame fallback:', fallbackUrl);
                  const fallbackResponse = await fetch(fallbackUrl, { mode: 'cors', credentials: 'omit' });
                  if (fallbackResponse.ok) {
                    await cache.put(url, fallbackResponse); // Cache with original URL key
                    await cache.put(fallbackUrl, fallbackResponse.clone()); // Also cache with fallback URL
                    console.log('[SW] ✅ A-Frame fallback cached successfully');
                  }
                } catch (fallbackError) {
                  console.error('[SW] ❌ A-Frame fallback also failed:', fallbackError);
                }
              }
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Static files caching completed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] ❌ Error during install:', error);
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
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SERVICE_WORKER_READY',
            message: 'Service Worker is now controlling this page'
          });
        });
      });
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
    console.log('[SW] 🏓 Pong! Service worker is alive');
    event.ports[0].postMessage({ type: 'PONG', message: 'Service worker is alive' });
  }
});

// Cache media files (used by download feature)
async function cacheMediaFiles(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  console.log('[SW] Starting to cache', urls.length, 'files');
  
  const xrVideos = urls.filter(url => url.includes('XR-CHAPTERS') || url.includes('XR_Scene'));
  if (xrVideos.length > 0) {
    console.log('[SW] XR videos to cache:', xrVideos);
  }
  
  const promises = urls.map(async (url) => {
    try {
      console.log('[SW] Caching', url);
      
      let req = new Request(url, {
        mode: 'cors',
        credentials: 'omit'
      });
      let response = await fetch(req);
      
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
  
  const xrResults = results.filter(r => r.url.includes('XR-CHAPTERS') || r.url.includes('XR_Scene'));
  if (xrResults.length > 0) {
    console.log('[SW] XR video caching results:', xrResults);
  }
  
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
  const staticCache = await caches.open(STATIC_CACHE);
  const status = {};
  
  for (const url of urls) {
    const req = new Request(url, {
      mode: 'cors',
      credentials: 'omit'
    });
    
    // Check both caches
    let response = await cache.match(req) || await staticCache.match(req);
    status[url] = !!response;
  }
  return status;
}

// Enhanced fetch event handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  console.log('[SW] Fetch event for:', request.url);
  console.log('[SW] Request method:', request.method);
  console.log('[SW] Request mode:', request.mode);

  // Special handling for A-Frame library
  if (isAFrameRequest(request)) {
    console.log('[SW] Handling A-Frame library request');
    event.respondWith(handleAFrameRequest(request));
  } else if (isMediaRequest(request)) {
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

// Check if request is for A-Frame library
function isAFrameRequest(request) {
  const url = request.url.toLowerCase();
  return url.includes('aframe') && url.includes('.js');
}

// Handle A-Frame library requests
async function handleAFrameRequest(request) {
  console.log('[SW] handleAFrameRequest called for:', request.url);
  
  try {
    const staticCache = await caches.open(STATIC_CACHE);
    
    // Try multiple possible URLs for A-Frame
    const possibleUrls = [
      request.url,
      '/cmm-single-build-player/libs/aframe-v1.7.1.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/aframe/1.7.1/aframe.min.js'
    ];
    
    for (const url of possibleUrls) {
      console.log('[SW] Trying A-Frame URL:', url);
      const req = new Request(url, {
        mode: url.startsWith('http') ? 'cors' : 'same-origin',
        credentials: 'omit'
      });
      
      // Check cache first
      const cachedResponse = await staticCache.match(req);
      if (cachedResponse) {
        console.log('[SW] ✅ Serving A-Frame from cache:', url);
        return cachedResponse;
      }
    }
    
    // If not in cache, try to fetch
    console.log('[SW] A-Frame not in cache, trying network');
    for (const url of possibleUrls) {
      try {
        const req = new Request(url, {
          mode: url.startsWith('http') ? 'cors' : 'same-origin',
          credentials: 'omit'
        });
        
        const response = await fetch(req);
        if (response.ok) {
          console.log('[SW] ✅ A-Frame fetched from network:', url);
          // Cache it for future use
          await staticCache.put(req, response.clone());
          return response;
        }
      } catch (error) {
        console.log('[SW] Failed to fetch A-Frame from:', url, error);
      }
    }
    
    console.error('[SW] ❌ A-Frame library not available');
    return new Response('A-Frame library not available', { 
      status: 404,
      statusText: 'A-Frame library not available'
    });
    
  } catch (error) {
    console.error('[SW] ❌ Error handling A-Frame request:', error);
    return new Response('Error loading A-Frame', { 
      status: 500,
      statusText: 'Error loading A-Frame'
    });
  }
}

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
  return STATIC_FILES.includes(url.pathname) || url.origin === self.location.origin;
}

// Handle media requests with cache-first strategy
async function handleMediaRequest(request) {
  console.log('[SW] handleMediaRequest called for:', request.url);
  
  const req = new Request(request.url, {
    mode: 'cors',
    credentials: 'omit'
  });
  
  try {
    const cache = await caches.open(MEDIA_CACHE);
    console.log('[SW] Checking cache for:', request.url);
    
    const cachedResponse = await cache.match(req);
    if (cachedResponse) {
      console.log('[SW] ✅ Serving media from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] ❌ Not in cache, fetching from network:', request.url);
    
    let networkResponse;
    try {
      networkResponse = await fetch(req);
    } catch (corsError) {
      console.log('[SW] CORS error, trying without CORS mode:', corsError.message);
      const noCorsReq = new Request(request.url, {
        mode: 'no-cors',
        credentials: 'omit'
      });
      networkResponse = await fetch(noCorsReq);
    }
    
    console.log('[SW] Network response status:', networkResponse.status, 'for:', request.url);
    
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      await cache.put(req, networkResponse.clone());
      console.log('[SW] ✅ Cached media file:', request.url);
    } else {
      console.warn('[SW] ⚠️ Network response not ok for', request.url, networkResponse.status);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] ❌ Error handling media request:', error);
    
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
    
    if (request.url.includes('XR-CHAPTERS') || request.url.includes('XR_Scene')) {
      console.error('[SW] ❌ XR video not available:', request.url);
      return new Response('XR video not available offline', { 
        status: 404,
        statusText: 'XR video not available offline'
      });
    }
    
    return new Response('Media not available offline', { 
      status: 404,
      statusText: 'Media not available offline'
    });
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