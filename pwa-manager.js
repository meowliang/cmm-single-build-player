class PWAManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isServiceWorkerSupported = 'serviceWorker' in navigator;
    this.isIOSDevice = this.detectIOSDevice();
    this.isIPadDevice = this.detectIPadDevice();
    this.isChromeOnIOS = this.detectChromeOnIOS();
    this.setupEventListeners();
    this.updateOnlineStatus();
    this.registerServiceWorker();
    
    console.log('🚀 PWA Manager initialized with enhanced iOS detection:', {
      isIOSDevice: this.isIOSDevice,
      isIPadDevice: this.isIPadDevice,
      isChromeOnIOS: this.isChromeOnIOS,
      isServiceWorkerSupported: this.isServiceWorkerSupported,
      userAgent: navigator.userAgent.substring(0, 100)
    });
  }

  detectIOSDevice() {
    // Enhanced iOS detection using multiple methods
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const maxTouchPoints = navigator.maxTouchPoints;
    
    // Check for explicit iOS user agents
    const isIOSUserAgent = /iPad|iPhone|iPod/.test(userAgent);
    
    // Check for modern iPad (reports as MacIntel with touch)
    const isModernIPad = platform === 'MacIntel' && maxTouchPoints > 1;
    
    // Check for Chrome on iOS (reports as CriOS)
    const isChromeOnIOS = /CriOS/.test(userAgent);
    
    return isIOSUserAgent || isModernIPad || isChromeOnIOS;
  }

  detectIPadDevice() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const maxTouchPoints = navigator.maxTouchPoints;
    
    // Explicit iPad detection
    const isIPadUserAgent = /iPad/.test(userAgent);
    
    // Modern iPad detection (reports as MacIntel with touch support)
    const isModernIPad = platform === 'MacIntel' && maxTouchPoints > 1;
    
    return isIPadUserAgent || isModernIPad;
  }

  detectChromeOnIOS() {
    const userAgent = navigator.userAgent;
    return /CriOS|Chrome/.test(userAgent) && this.isIOSDevice;
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateOnlineStatus();
      console.log('📶 App is online');
      if (this.isIOSDevice) {
        console.log('🍎 iOS device back online');
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateOnlineStatus();
      console.log('📵 App is offline');
      if (this.isIOSDevice) {
        console.log('🍎 iOS device went offline');
      }
    });

    // iOS-specific event listeners
    if (this.isIOSDevice) {
      // Handle iOS app state changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          console.log('🍎 iOS app went to background');
        } else {
          console.log('🍎 iOS app came to foreground');
          // Re-check service worker state when app returns
          this.checkServiceWorkerState();
        }
      });

      // Handle iOS page unload
      window.addEventListener('beforeunload', () => {
        console.log('🍎 iOS app is unloading');
      });
    }
  }

  async checkServiceWorkerState() {
    if (this.isServiceWorkerSupported && this.isIOSDevice) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const hasController = !!navigator.serviceWorker.controller;
        
        console.log('🍎 iOS service worker state check:', {
          hasRegistration: !!registration,
          hasController,
          registrationState: registration?.active?.state
        });
        
        // If we lost the service worker controller, try to reactivate
        if (registration && !hasController) {
          console.log('🍎 iOS service worker lost, attempting reactivation');
          registration.update();
        }
      } catch (error) {
        console.warn('🍎 iOS service worker state check failed:', error);
      }
    }
  }

  async registerServiceWorker() {
    if (!this.isServiceWorkerSupported) {
      console.log('❌ Service Worker not supported in this browser');
      if (this.isIOSDevice) {
        console.log('🍎 iOS device without service worker support');
      }
      return;
    }

    try {
      console.log('🔄 Attempting to register service worker...');
      if (this.isIOSDevice) {
        console.log('🍎 iOS service worker registration with enhanced compatibility');
      }

      // Enhanced registration for iOS devices
      const registrationOptions = {
        scope: '/cmm-single-build-player/'
      };

      // iOS-specific registration handling
      if (this.isIOSDevice) {
        // Add longer timeout for iOS
        registrationOptions.updateViaCache = 'none';
      }

      const registration = await navigator.serviceWorker.register(
        '/cmm-single-build-player/service-worker.js',
        registrationOptions
      );

      console.log('✅ Service Worker registered successfully:', registration);
      if (this.isIOSDevice) {
        console.log('🍎 iOS service worker registered successfully');
      }

      // Enhanced iOS handling for service worker ready state
      const readyPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise((_, reject) => {
        const timeout = this.isIOSDevice ? 10000 : 5000; // Longer timeout for iOS
        setTimeout(() => reject(new Error('Service worker ready timeout')), timeout);
      });

      try {
        await Promise.race([readyPromise, timeoutPromise]);
        console.log('✅ Service Worker is ready');
        if (this.isIOSDevice) {
          console.log('🍎 iOS service worker is ready');
        }
      } catch (readyError) {
        console.warn('⚠️ Service worker ready timeout, continuing anyway');
        if (this.isIOSDevice) {
          console.warn('🍎 iOS service worker ready timeout');
        }
      }

      // Enhanced controller check with iOS-specific handling
      await this.waitForController();

      // Set up message listener
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Received message from service worker:', event.data);
        if (this.isIOSDevice) {
          console.log('🍎 iOS service worker message:', event.data.type);
        }
      });

      // iOS-specific service worker state monitoring
      if (this.isIOSDevice) {
        this.monitorIOSServiceWorker(registration);
      }

    } catch (error) {
      console.error('❌ Error registering service worker:', error);
      if (this.isIOSDevice) {
        console.error('🍎 iOS service worker registration failed:', error.message);
        
        // iOS fallback: Set up basic caching without service worker
        this.setupIOSFallback();
      }
    }
  }

  async waitForController() {
    const maxAttempts = this.isIOSDevice ? 8 : 5; // More attempts for iOS
    const attemptDelay = this.isIOSDevice ? 1500 : 1000; // Longer delay for iOS

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (navigator.serviceWorker.controller) {
        console.log(`✅ Service Worker is controlling the page (attempt ${attempt})`);
        if (this.isIOSDevice) {
          console.log('🍎 iOS service worker gained control');
        }
        return true;
      }

      console.log(`⏳ Waiting for service worker control (attempt ${attempt}/${maxAttempts})`);
      if (this.isIOSDevice) {
        console.log('🍎 iOS waiting for service worker control');
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attemptDelay));
      }
    }

    console.warn('⚠️ Service Worker failed to gain control after maximum attempts');
    if (this.isIOSDevice) {
      console.warn('🍎 iOS service worker control failed');

      // iOS-specific fallback: Try page reload if this is Chrome on iPad
      if (this.isChromeOnIOS && !sessionStorage.getItem('iosSwReloadAttempted')) {
        console.log('🍎 Chrome on iOS detected, attempting page reload for service worker activation');
        sessionStorage.setItem('iosSwReloadAttempted', 'true');
        // Add a small delay to let any pending operations complete
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return;
      }
    }

    return false;
  }

  monitorIOSServiceWorker(registration) {
    console.log('🍎 Setting up iOS service worker monitoring');

    // Monitor registration state changes
    if (registration.installing) {
      console.log('🍎 iOS service worker installing');
      registration.installing.addEventListener('statechange', (event) => {
        console.log('🍎 iOS installing service worker state:', event.target.state);
      });
    }

    if (registration.waiting) {
      console.log('🍎 iOS service worker waiting');
    }

    if (registration.active) {
      console.log('🍎 iOS service worker active');
      registration.active.addEventListener('statechange', (event) => {
        console.log('🍎 iOS active service worker state:', event.target.state);
      });
    }

    // Monitor for updates
    registration.addEventListener('updatefound', () => {
      console.log('🍎 iOS service worker update found');
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🍎 iOS service worker updated, refresh recommended');
          }
        });
      }
    });

    // Periodic health check for iOS
    setInterval(() => {
      this.checkServiceWorkerState();
    }, 30000); // Check every 30 seconds
  }

  setupIOSFallback() {
    console.log('🍎 Setting up iOS fallback caching mechanism');

    // Store device info for React app
    window.deviceInfo = {
      isIOS: this.isIOSDevice,
      isIPad: this.isIPadDevice,
      isChromeOnIOS: this.isChromeOnIOS,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      devicePixelRatio: window.devicePixelRatio,
      hasServiceWorkerFallback: true
    };

    // Basic cache API usage for iOS when service worker fails
    if ('caches' in window) {
      console.log('🍎 iOS fallback: Cache API available');
      
      // Pre-cache critical resources
      this.preCacheCriticalResources();
    } else {
      console.warn('🍎 iOS fallback: Cache API not available');
    }
  }

  async preCacheCriticalResources() {
    try {
      const cache = await caches.open('cmm-ios-fallback-v1');
      const criticalResources = [
        '/cmm-single-build-player/',
        '/cmm-single-build-player/index.html',
        '/cmm-single-build-player/manifest.json',
        '/cmm-single-build-player/favicon.ico'
      ];

      console.log('🍎 iOS fallback: Pre-caching critical resources');
      
      for (const resource of criticalResources) {
        try {
          await cache.add(resource);
          console.log('🍎 iOS fallback: Cached', resource);
        } catch (error) {
          console.warn('🍎 iOS fallback: Failed to cache', resource, error.message);
        }
      }
    } catch (error) {
      console.error('🍎 iOS fallback: Pre-caching failed', error);
    }
  }

  updateOnlineStatus() {
    const statusIndicator = document.querySelector('.network-status');
    if (statusIndicator) {
      statusIndicator.textContent = this.isOnline ? 'Online' : 'Offline';
      statusIndicator.className = `network-status ${this.isOnline ? 'online' : 'offline'}`;
      
      if (this.isIOSDevice) {
        statusIndicator.classList.add('ios-device');
      }
    }

    // Dispatch custom event for app components
    const statusEvent = new CustomEvent('networkstatus', {
      detail: { 
        isOnline: this.isOnline,
        isIOSDevice: this.isIOSDevice,
        isIPadDevice: this.isIPadDevice,
        isChromeOnIOS: this.isChromeOnIOS
      }
    });
    window.dispatchEvent(statusEvent);
  }

  // Enhanced error handling for iOS
  handleError(error, context = 'PWA Manager') {
    console.error(`❌ ${context} Error:`, error);
    
    if (this.isIOSDevice) {
      console.error('🍎 iOS Error Details:', {
        message: error.message,
        stack: error.stack,
        context,
        userAgent: navigator.userAgent.substring(0, 100),
        timestamp: new Date().toISOString()
      });

      // Store iOS errors for potential debugging
      if (!window.iosErrors) window.iosErrors = [];
      window.iosErrors.push({
        error: error.message,
        context,
        timestamp: new Date().toISOString(),
        component: 'PWAManager'
      });
    }
  }

  // Get diagnostic information for iOS debugging
  getDiagnosticInfo() {
    const info = {
      isIOSDevice: this.isIOSDevice,
      isIPadDevice: this.isIPadDevice,
      isChromeOnIOS: this.isChromeOnIOS,
      isOnline: this.isOnline,
      isServiceWorkerSupported: this.isServiceWorkerSupported,
      hasServiceWorkerController: !!navigator.serviceWorker?.controller,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      devicePixelRatio: window.devicePixelRatio,
      timestamp: new Date().toISOString()
    };

    if (this.isIOSDevice) {
      console.log('🍎 iOS Diagnostic Info:', info);
    }

    return info;
  }
}

// Enhanced initialization with error handling
try {
  // Ensure DOM is ready before initializing PWA Manager
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.pwaManager = new PWAManager();
    });
  } else {
    window.pwaManager = new PWAManager();
  }
} catch (error) {
  console.error('❌ Failed to initialize PWA Manager:', error);
  
  // Basic iOS detection for error reporting
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    console.error('🍎 iOS PWA Manager initialization failed');
    
    // Store error for debugging
    if (!window.iosErrors) window.iosErrors = [];
    window.iosErrors.push({
      error: error.message,
      context: 'PWA Manager Initialization',
      timestamp: new Date().toISOString(),
      component: 'PWAManager'
    });
  }
} 