const STATIC_CACHE = 'cmm-static-v2';
const MEDIA_CACHE = 'cmm-media-cache-v1';
const LARGE_FILE_DB = 'cmm-large-files-db';
const LARGE_FILE_STORE = 'large-files';
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB threshold

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
      .then(async (cache) => {
        console.log('[SW] 📁 Caching static files');
        
        // Cache files one by one to identify which ones fail
        const results = [];
        for (const file of STATIC_FILES) {
          try {
            console.log('[SW] Caching:', file);
            await cache.add(file);
            results.push({ file, success: true });
            console.log('[SW] ✅ Successfully cached:', file);
          } catch (error) {
            console.warn('[SW] ⚠️ Failed to cache:', file, error.message);
            results.push({ file, success: false, error: error.message });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        console.log(`[SW] 📊 Caching summary: ${successCount} successful, ${failedCount} failed`);
        
        if (failedCount > 0) {
          console.warn('[SW] ⚠️ Failed to cache files:', results.filter(r => !r.success));
        }
        
        return results;
      })
      .then(() => {
        console.log('[SW] ✅ Static files caching completed');
        console.log('[SW] 🚀 Skipping waiting to activate immediately');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] ❌ Error in static file caching:', error);
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

// IndexedDB helper functions for large files
async function openLargeFileDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LARGE_FILE_DB, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(LARGE_FILE_STORE)) {
        db.createObjectStore(LARGE_FILE_STORE);
      }
    };
  });
}

async function storeLargeFile(url, response) {
  try {
    // Read the response data first, outside of any transaction
    console.log('[SW] Reading response data for', url);
    const arrayBuffer = await response.arrayBuffer();
    console.log('[SW] Response data read, size:', arrayBuffer.byteLength, 'bytes');
    
    const fileData = {
      url,
      data: arrayBuffer,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
      statusText: response.statusText,
      timestamp: Date.now()
    };
    
    // Open database and create transaction after data is ready
    const db = await openLargeFileDB();
    
    return new Promise((resolve, reject) => {
      // Create transaction only when ready to store
      const transaction = db.transaction([LARGE_FILE_STORE], 'readwrite');
      const store = transaction.objectStore(LARGE_FILE_STORE);
      
      // Set up transaction event handlers
      transaction.onerror = () => {
        console.error('[SW] Transaction error for', url, transaction.error);
        reject(transaction.error);
      };
      
      transaction.onabort = () => {
        console.error('[SW] Transaction aborted for', url);
        reject(new Error('Transaction aborted'));
      };
      
      // Store the data
      const request = store.put(fileData, url);
      
      request.onsuccess = () => {
        console.log('[SW] Successfully stored in IndexedDB:', url);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error('[SW] Put request error for', url, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[SW] Error storing large file in IndexedDB:', error);
    throw error;
  }
}

async function getLargeFile(url) {
  try {
    const db = await openLargeFileDB();
    const transaction = db.transaction([LARGE_FILE_STORE], 'readonly');
    const store = transaction.objectStore(LARGE_FILE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const response = new Response(result.data, {
            status: result.status,
            statusText: result.statusText,
            headers: new Headers(result.headers)
          });
          resolve(response);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Error getting large file from IndexedDB:', error);
    return null;
  }
}

async function hasLargeFile(url) {
  try {
    const db = await openLargeFileDB();
    const transaction = db.transaction([LARGE_FILE_STORE], 'readonly');
    const store = transaction.objectStore(LARGE_FILE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Error checking large file in IndexedDB:', error);
    return false;
  }
}

// Enhanced XR video quality selection
function selectOptimalXRQuality(xrUrl) {
  const lowerUrl = xrUrl.toLowerCase();
  
  // Simple device/connection detection in service worker context
  const userAgent = self.navigator.userAgent;
  const isHighEndDevice = userAgent.includes('Chrome') && !userAgent.includes('Mobile');
  const isMobile = /iPad|iPhone|iPod|Android/i.test(userAgent);
  
  console.log('[SW] XR Quality Selection:', {
    originalUrl: xrUrl,
    isHighEndDevice,
    isMobile,
    userAgent: userAgent.substring(0, 100)
  });
  
  const qualityVariants = [];
  
  // Extract base URL pattern and generate variants
  if (lowerUrl.includes('-low-') || lowerUrl.includes('-med-') || lowerUrl.includes('-high-')) {
    const baseUrl = xrUrl.replace(/-(?:low|med|high)-/i, '-{quality}-');
    
    // Add variants based on device capability (mobile gets lower quality first)
    if (isMobile) {
      qualityVariants.push(baseUrl.replace('{quality}', 'LOW'));
      qualityVariants.push(baseUrl.replace('{quality}', 'MED'));
    } else if (isHighEndDevice) {
      qualityVariants.push(baseUrl.replace('{quality}', 'MED'));
      qualityVariants.push(baseUrl.replace('{quality}', 'HIGH'));
      qualityVariants.push(baseUrl.replace('{quality}', 'LOW'));
    } else {
      qualityVariants.push(baseUrl.replace('{quality}', 'MED'));
      qualityVariants.push(baseUrl.replace('{quality}', 'LOW'));
    }
  } else {
    // If no quality indicators, use original
    qualityVariants.push(xrUrl);
  }
  
  console.log('[SW] Generated quality variants:', qualityVariants);
  return qualityVariants;
}

// Cache media files (used by download feature)
async function cacheMediaFiles(urls) {
  const cache = await caches.open(MEDIA_CACHE);
  console.log('[SW] Starting to cache', urls.length, 'files');
  
  // Enhanced XR video detection
  const xrVideos = urls.filter(url => {
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('xr-chapters') || lowerUrl.includes('xr_scene') || lowerUrl.includes('xr-src');
  });
  if (xrVideos.length > 0) {
    console.log('[SW] XR videos to cache:', xrVideos);
  }
  
  const results = [];
  let successCount = 0;
  let failedCount = 0;

  // Simple device detection
  const userAgent = self.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  
  console.log('[SW] Device info:', { isIOS, userAgent: userAgent.substring(0, 100) });

  // Process files sequentially to provide real-time progress updates
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const isXRVideo = xrVideos.includes(url);
    
    try {
      console.log('[SW] Processing', url, isXRVideo ? '(XR Video)' : '');
      
      let response;
      let cacheSuccess = false;
      
      if (isXRVideo) {
        // Enhanced XR video handling with adaptive quality
        console.log('[SW] Processing XR video with adaptive quality selection');
        const qualityVariants = selectOptimalXRQuality(url);
        
        // Try each quality variant until one works
        for (const [index, variantUrl] of qualityVariants.entries()) {
          try {
            console.log(`[SW] Attempting XR quality variant ${index + 1}/${qualityVariants.length}:`, variantUrl);
            
            response = await fetch(variantUrl, {
              credentials: 'omit',
              cache: 'no-cache'
            });
            
            if (response.ok || response.type === 'opaque') {
              console.log('[SW] ✅ XR video fetch successful:', variantUrl);
              break;
            } else {
              throw new Error(`Response not ok: ${response.status}`);
            }
          } catch (variantError) {
            console.log(`[SW] XR quality variant ${index + 1} failed:`, variantError.message);
            if (index === qualityVariants.length - 1) {
              throw new Error('All XR quality variants failed');
            }
          }
        }
      } else {
        // Standard handling for audio and images
        const FETCH_TIMEOUT = 15000; // 15s for non-XR files
        
        const fetchWithTimeout = async (fetchFunction) => {
          return Promise.race([
            fetchFunction(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Fetch timeout')), FETCH_TIMEOUT)
            )
          ]);
        };

        // Simplified fetch strategy for non-XR files
        try {
          // First attempt: Use appropriate mode for device
          const fetchMode = isIOS ? 'no-cors' : 'cors';
          console.log('[SW] Fetching with', fetchMode, 'mode for', url);
          
          response = await fetchWithTimeout(() => fetch(new Request(url, {
            mode: fetchMode,
            credentials: 'omit',
            cache: 'no-cache'
          })));
          
          if (response.ok || response.type === 'opaque') {
            console.log('[SW] ✅ Fetch successful:', url);
          } else {
            throw new Error('Response not ok');
          }
        } catch (firstError) {
          console.log('[SW] First fetch failed, trying alternative mode:', firstError.message);
          
          // Second attempt: Try alternative mode
          const altMode = isIOS ? 'cors' : 'no-cors';
          response = await fetchWithTimeout(() => fetch(new Request(url, {
            mode: altMode,
            credentials: 'omit',
            cache: 'no-cache'
          })));
          
          if (!response.ok && response.type !== 'opaque') {
            throw new Error('Both fetch attempts failed');
          }
        }
      }
      
      // Storage strategy: Cache API first, IndexedDB fallback
      const contentLength = response.headers.get('content-length');
      const fileSize = contentLength ? parseInt(contentLength, 10) : 0;
      const isLargeFile = fileSize > LARGE_FILE_THRESHOLD;
      
      console.log('[SW] Response details for', url, ':', {
        status: response.status,
        type: response.type,
        fileSize: fileSize,
        isLargeFile: isLargeFile,
        isXRVideo: isXRVideo
      });
      
      // Try Cache API first for all files
      try {
        const cacheRequest = new Request(url);
        await cache.put(cacheRequest, response.clone());
        console.log('[SW] ✅ Cached in Cache API:', url);
        results.push({ url, status: 'success', storage: 'cache' });
        successCount++;
        cacheSuccess = true;
      } catch (cacheError) {
        console.log('[SW] Cache API failed for', url, 'Error:', cacheError.message);
        
        // IndexedDB fallback for large files or when Cache API fails
        try {
          console.log('[SW] Trying IndexedDB for', url);
          await storeLargeFile(url, response.clone());
          console.log('[SW] ✅ Stored in IndexedDB:', url);
          results.push({ url, status: 'success', storage: 'indexeddb' });
          successCount++;
          cacheSuccess = true;
        } catch (indexedDBError) {
          console.log('[SW] IndexedDB also failed for', url, 'Error:', indexedDBError.message);
        }
      }
      
      if (!cacheSuccess) {
        console.log('[SW] ❌ Failed to cache', url);
        results.push({ url, status: 'failed', error: 'Storage failed' });
        failedCount++;
      }
      
    } catch (error) {
      console.log('[SW] ❌ Error caching', url, ':', error.message);
      results.push({ url, status: 'error', error: error.message });
      failedCount++;
    }

    // Send progress update after each file
    const completedCount = successCount + failedCount;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'CACHE_PROGRESS',
          results: results.slice(),
          total: urls.length,
          successCount,
          failedCount,
          completedCount,
          currentFile: i + 1
        });
      });
    });
  }

  console.log(`[SW] Caching complete. ${successCount} successful, ${failedCount} failed`);
  
  // Log XR video results specifically
  const xrResults = results.filter(r => xrVideos.includes(r.url));
  if (xrResults.length > 0) {
    console.log('[SW] XR video caching results:', xrResults);
  }
  
  // Send final completion message
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_COMPLETE',
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
    let isCached = false;
    
    // Check Cache API first
    const req = new Request(url, {
      mode: 'cors',
      credentials: 'omit'
    });
    const response = await cache.match(req);
    
    if (response) {
      isCached = true;
    } else {
      // Check IndexedDB for large files
      const hasLargeFileStored = await hasLargeFile(url);
      if (hasLargeFileStored) {
        isCached = true;
      }
    }
    
    status[url] = isCached;
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
  // Fix XR video detection - use consistent case-insensitive matching
  const isXRVideo = url.includes('xr-chapters') || url.includes('xr_scene') || url.includes('xr-src');
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
  
  const lowerUrl = request.url.toLowerCase();
  const isXRVideo = lowerUrl.includes('xr-chapters') || lowerUrl.includes('xr_scene') || lowerUrl.includes('xr-src');
  
  console.log('[SW] Processing media request:', { url: request.url, isXRVideo });
  
  try {
    const cache = await caches.open(MEDIA_CACHE);
    
    // Enhanced cache lookup with multiple strategies
    const lookupStrategies = [
      () => cache.match(request.url),
      () => cache.match(request),
      () => cache.match(new Request(request.url)),
      () => cache.match(new Request(request.url, { method: 'GET' }))
    ];
    
    for (const strategy of lookupStrategies) {
      try {
        const cachedResponse = await strategy();
        if (cachedResponse) {
          console.log('[SW] ✅ Serving from cache:', request.url);
          return cachedResponse;
        }
      } catch (error) {
        console.log('[SW] Cache lookup strategy failed:', error.message);
      }
    }
    
    // Check IndexedDB for large files
    const largeFileResponse = await getLargeFile(request.url);
    if (largeFileResponse) {
      console.log('[SW] ✅ Serving from IndexedDB:', request.url);
      return largeFileResponse;
    }
    
    console.log('[SW] Not in cache, fetching from network:', request.url);
    
    let networkResponse;
    
    // Enhanced network fetch with adaptive quality for XR videos
    if (isXRVideo) {
      console.log('[SW] XR video network fetch with adaptive quality');
      const qualityVariants = selectOptimalXRQuality(request.url);
      
      // Try each quality variant until one works
      for (const [index, variantUrl] of qualityVariants.entries()) {
        try {
          console.log(`[SW] Trying XR quality variant ${index + 1}/${qualityVariants.length}:`, variantUrl);
          
          networkResponse = await fetch(variantUrl, {
            credentials: 'omit',
            cache: 'no-cache'
          });
          
          if (networkResponse.ok || networkResponse.type === 'opaque') {
            console.log('[SW] ✅ XR video network fetch successful:', variantUrl);
            break;
          } else {
            console.log(`[SW] XR variant ${index + 1} failed with status:`, networkResponse.status);
            if (index === qualityVariants.length - 1) {
              throw new Error('All XR quality variants failed');
            }
          }
        } catch (variantError) {
          console.log(`[SW] XR variant ${index + 1} error:`, variantError.message);
          if (index === qualityVariants.length - 1) {
            throw new Error('All XR quality variants failed');
          }
        }
      }
    } else {
      // Standard network fetch for non-XR files
      networkResponse = await fetch(request);
    }
    
    if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
      console.log('[SW] ✅ Network fetch successful:', request.url);
      
      // Cache for future use
      try {
        await cache.put(new Request(request.url), networkResponse.clone());
        console.log('[SW] ✅ Cached for future use:', request.url);
      } catch (cacheError) {
        console.log('[SW] Caching failed, trying IndexedDB:', cacheError.message);
        try {
          await storeLargeFile(request.url, networkResponse.clone());
          console.log('[SW] ✅ Stored in IndexedDB:', request.url);
        } catch (dbError) {
          console.log('[SW] IndexedDB storage failed:', dbError.message);
        }
      }
      
      return networkResponse;
    } else {
      throw new Error(`Network response not ok: ${networkResponse?.status || 'unknown'}`);
    }
  } catch (error) {
    console.error('[SW] Error handling media request:', error);
    
    // Final fallback attempt
    try {
      const cache = await caches.open(MEDIA_CACHE);
      const fallbackResponse = await cache.match(request.url) || await getLargeFile(request.url);
      
      if (fallbackResponse) {
        console.log('[SW] ✅ Serving from fallback cache:', request.url);
        return fallbackResponse;
      }
    } catch (fallbackError) {
      console.error('[SW] Fallback failed:', fallbackError);
    }
    
    if (isXRVideo) {
      console.error('[SW] ❌ XR video not available offline:', request.url);
      return new Response('XR video not available offline', { status: 503 });
    }
    
    return new Response('Media not available offline', { status: 503 });
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const url = new URL(request.url);
    
    console.log('[SW] Handling static request for:', url.pathname);
    
    // Try multiple cache lookup strategies
    let cachedResponse = await cache.match(url.pathname);
    
    // Also try to match by full URL for external resources
    if (!cachedResponse) {
      cachedResponse = await cache.match(request.url);
    }
    
    // For A-Frame libraries, try different variants
    if (!cachedResponse && url.pathname.includes('/libs/aframe')) {
      console.log('[SW] A-Frame library request, trying variants...');
      const variants = [
        '/cmm-single-build-player/libs/aframe-v1.7.1.min.js',
        '/cmm-single-build-player/libs/aframe.min.js',
        '/cmm-single-build-player/libs/aframe-master.min.js'
      ];
      
      for (const variant of variants) {
        cachedResponse = await cache.match(variant);
        if (cachedResponse) {
          console.log('[SW] ✅ Found A-Frame variant in cache:', variant);
          break;
        }
      }
    }
    
    if (cachedResponse) {
      console.log('[SW] ✅ Serving static file from cache:', url.pathname);
      return cachedResponse;
    }
    
    console.log('[SW] ❌ Static file not in cache, attempting network fetch:', url.pathname);
    
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        console.log('[SW] ✅ Network fetch successful, caching:', url.pathname);
        await cache.put(url.pathname, networkResponse.clone());
        return networkResponse;
      } else {
        console.warn('[SW] ⚠️ Network fetch failed with status:', networkResponse.status);
        throw new Error(`Network response not ok: ${networkResponse.status}`);
      }
    } catch (networkError) {
      console.error('[SW] ❌ Network fetch failed:', networkError);
      
      // For A-Frame libraries, this is critical - try to serve any cached A-Frame version
      if (request.url.includes('/libs/aframe')) {
        console.log('[SW] 🚨 A-Frame library fetch failed, trying any cached version...');
        const aframeVariants = [
          '/cmm-single-build-player/libs/aframe-v1.7.1.min.js',
          '/cmm-single-build-player/libs/aframe.min.js',
          '/cmm-single-build-player/libs/aframe-master.min.js'
        ];
        
        for (const variant of aframeVariants) {
          const fallbackResponse = await cache.match(variant);
          if (fallbackResponse) {
            console.log('[SW] 🔄 Serving fallback A-Frame version:', variant);
            return fallbackResponse;
          }
        }
        
        console.error('[SW] 💀 No A-Frame library available in cache - this will break XR functionality');
        return new Response('A-Frame library not available offline', { 
          status: 503,
          statusText: 'Critical library not cached'
        });
      }
      
      throw networkError;
    }
  } catch (error) {
    console.error('[SW] Error handling static request:', error);
    
    return new Response('Resource not available offline', { 
      status: 404,
      statusText: 'Resource not found'
    });
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