import { useState, useEffect, useCallback } from 'react';

export const usePWA = () => {
  const [isServiceWorkerRegistered, setIsServiceWorkerRegistered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, successCount: 0, failedCount: 0 });
  const [cacheStatus, setCacheStatus] = useState({});
  const [swError, setSwError] = useState(null);

  // Register service worker
  useEffect(() => {
    const registerServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) {
        console.log('Service Worker not supported in this browser');
        setSwError('Service Worker not supported');
        return;
      }

      try {
        console.log('Attempting to register service worker...');
        
        // Check if we're in development mode
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        if (isDevelopment) {
          console.log('Development mode detected - using direct cache API');
          // In development, we'll use the Cache API directly
          setIsServiceWorkerRegistered(true);
          setSwError(null);
          console.log('Direct cache API enabled for development');
          
          // Set up fetch interceptor for development mode
          setupDevelopmentFetchInterceptor();
          return;
        }

        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered successfully:', registration);
        setIsServiceWorkerRegistered(true);
        setSwError(null);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        
        // Handle specific MIME type error
        if (error.message.includes('MIME type')) {
          setSwError('Service Worker not available in development mode. Build the app for production to enable offline features.');
        } else {
          setSwError(error.message);
        }
        setIsServiceWorkerRegistered(false);
      }
    };

    // Set up fetch interceptor for development mode
    const setupDevelopmentFetchInterceptor = () => {
      if (process.env.NODE_ENV === 'development') {
        // Store original fetch
        const originalFetch = window.fetch;
        
        // Override fetch to check cache first
        window.fetch = async (input, init) => {
          const url = typeof input === 'string' ? input : input.url;
          
          // Only intercept media requests
          const isMediaRequest = url.match(/\.(mp3|mp4|jpg|jpeg|png|gif|webp)$/i);
          
          if (isMediaRequest) {
            try {
              // Try to get from cache first
              const cache = await caches.open('cmm-media-cache-v1');
              const cachedResponse = await cache.match(url);
              
              if (cachedResponse) {
                console.log('Development mode: Serving from cache:', url);
                return cachedResponse;
              }
            } catch (error) {
              console.log('Development mode: Cache check failed:', error);
            }
          }
          
          // Fall back to original fetch
          try {
            const response = await originalFetch(input, init);
            return response;
          } catch (error) {
            // If network fails, try cache as fallback
            if (isMediaRequest) {
              try {
                const cache = await caches.open('cmm-media-cache-v1');
                const cachedResponse = await cache.match(url);
                
                if (cachedResponse) {
                  console.log('Development mode: Network failed, serving from cache:', url);
                  return cachedResponse;
                }
              } catch (cacheError) {
                console.log('Development mode: Cache fallback failed:', cacheError);
              }
            }
            throw error;
          }
        };
      }
    };

    // Wait for the page to load before registering
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', registerServiceWorker);
    } else {
      registerServiceWorker();
    }

    // Listen for messages from service worker
    const handleMessage = (event) => {
      if (event.data.type === 'CACHE_PROGRESS') {
        setDownloadProgress({
          current: event.data.total,
          total: event.data.total,
          successCount: event.data.successCount,
          failedCount: event.data.failedCount
        });
        
        if (event.data.successCount + event.data.failedCount === event.data.total) {
          setIsDownloading(false);
          // Refresh cache status after download
          getCacheStatus();
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      document.removeEventListener('DOMContentLoaded', registerServiceWorker);
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Extract all media URLs from playlist data
  const extractMediaUrls = useCallback((playlistData) => {
    const urls = new Set();
    
    if (playlistData && playlistData.playlists) {
      playlistData.playlists.forEach(playlist => {
        if (playlist.tracks) {
          playlist.tracks.forEach(track => {
            if (track.audio_url) urls.add(track.audio_url);
            if (track.artwork_url) urls.add(track.artwork_url);
            if (track.XR_Scene && track.XR_Scene.trim() !== '') urls.add(track.XR_Scene);
          });
        }
      });
    }
    
    return Array.from(urls);
  }, []);

  // Download all media files
  const downloadAllMedia = useCallback(async (playlistData) => {
    if (!isServiceWorkerRegistered) {
      console.error('Service Worker not registered');
      return;
    }

    const urls = extractMediaUrls(playlistData);
    console.log('Downloading', urls.length, 'media files');

    if (urls.length === 0) {
      console.warn('No media URLs found in playlist data');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: urls.length, successCount: 0, failedCount: 0 });

    // Check if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development, use Cache API directly
      console.log('Development mode: Using Cache API directly...');
      
      try {
        const cache = await caches.open('cmm-media-cache-v1');
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < urls.length; i++) {
          try {
            const url = urls[i];
            console.log('Caching:', url);
            
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok) {
              await cache.put(url, response.clone());
              successCount++;
              console.log('Successfully cached:', url);
            } else {
              failedCount++;
              console.log('Failed to cache:', url, 'Status:', response.status);
            }
          } catch (error) {
            failedCount++;
            console.log('Error caching:', urls[i], error);
          }

          // Update progress
          setDownloadProgress({
            current: urls.length,
            total: urls.length,
            successCount,
            failedCount
          });

          // Small delay to show progress
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`Development mode: Caching complete. ${successCount} successful, ${failedCount} failed`);
        setIsDownloading(false);
        
        // Refresh cache status
        getCacheStatus(playlistData);
      } catch (error) {
        console.error('Error in development caching:', error);
        setIsDownloading(false);
      }
      return;
    }

    try {
      // Send URLs to service worker for caching
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_MEDIA',
          urls
        });
      } else {
        console.error('Service Worker controller not available');
        setIsDownloading(false);
      }
    } catch (error) {
      console.error('Error initiating download:', error);
      setIsDownloading(false);
    }
  }, [isServiceWorkerRegistered, extractMediaUrls]);

  // Get cache status for all media files
  const getCacheStatus = useCallback(async (playlistData) => {
    if (!isServiceWorkerRegistered) return;

    const urls = extractMediaUrls(playlistData);
    if (urls.length === 0) return;

    // Check if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development, check cache directly
      try {
        const cache = await caches.open('cmm-media-cache-v1');
        const status = {};
        
        for (const url of urls) {
          const response = await cache.match(url);
          status[url] = !!response;
        }
        
        setCacheStatus(status);
        return status;
      } catch (error) {
        console.error('Error checking cache status in development:', error);
      }
    }

    try {
      const status = await new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'GET_CACHE_STATUS',
            urls
          }, [channel.port2]);
        }
      });

      setCacheStatus(status);
      return status;
    } catch (error) {
      console.error('Error getting cache status:', error);
    }
  }, [isServiceWorkerRegistered, extractMediaUrls]);

  // Clear all cached media
  const clearCache = useCallback(async () => {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        const mediaCacheNames = cacheNames.filter(name => name.includes('media'));
        
        await Promise.all(
          mediaCacheNames.map(cacheName => caches.delete(cacheName))
        );
        
        console.log('Media cache cleared');
        setCacheStatus({});
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
    }
  }, []);

  // Get download progress percentage
  const getDownloadProgressPercentage = useCallback(() => {
    if (downloadProgress.total === 0) return 0;
    return Math.round((downloadProgress.successCount + downloadProgress.failedCount) / downloadProgress.total * 100);
  }, [downloadProgress]);

  // Check if all media is cached
  const isAllMediaCached = useCallback(() => {
    const cachedCount = Object.values(cacheStatus).filter(Boolean).length;
    const totalCount = Object.keys(cacheStatus).length;
    return totalCount > 0 && cachedCount === totalCount;
  }, [cacheStatus]);

  return {
    isServiceWorkerRegistered,
    isDownloading,
    downloadProgress,
    cacheStatus,
    downloadAllMedia,
    getCacheStatus,
    clearCache,
    getDownloadProgressPercentage,
    isAllMediaCached,
    swError
  };
}; 