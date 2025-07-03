class PWAManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.registration = null;
    this.deferredPrompt = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.registerServiceWorker();
    this.checkInstallability();
    this.updateOnlineStatus();
  }

  setupEventListeners() {
    // Online/offline status
    window.addEventListener('online', () => this.updateOnlineStatus());
    window.addEventListener('offline', () => this.updateOnlineStatus());

    // Install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });

    // App installed
    window.addEventListener('appinstalled', () => {
      console.log('App was installed');
      this.hideInstallPrompt();
    });
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered:', this.registration);

        // Listen for updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showUpdatePrompt();
            }
          });
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  updateOnlineStatus() {
    this.isOnline = navigator.onLine;
    this.showStatusMessage();
  }

  showStatusMessage() {
    const message = this.isOnline ? 
      '🟢 Online - Content will sync automatically' : 
      '🔴 Offline - Using cached content';
    
    this.showToast(message, this.isOnline ? 'success' : 'warning');
  }

  showInstallPrompt() {
    const installBanner = document.createElement('div');
    installBanner.id = 'install-banner';
    installBanner.className = 'install-banner';
    installBanner.innerHTML = `
      <div class="install-content">
        <div class="install-icon">📱</div>
        <div class="install-text">
          <h3>Install CMM Player</h3>
          <p>Add to home screen for offline access</p>
        </div>
        <div class="install-actions">
          <button id="install-btn" class="install-btn">Install</button>
          <button id="dismiss-btn" class="dismiss-btn">Not now</button>
        </div>
      </div>
    `;

    document.body.appendChild(installBanner);

    // Add event listeners
    document.getElementById('install-btn').addEventListener('click', () => {
      this.installApp();
    });

    document.getElementById('dismiss-btn').addEventListener('click', () => {
      this.hideInstallPrompt();
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      this.hideInstallPrompt();
    }, 10000);
  }

  hideInstallPrompt() {
    const banner = document.getElementById('install-banner');
    if (banner) {
      banner.remove();
    }
  }

  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log('Install prompt outcome:', outcome);
      this.deferredPrompt = null;
      this.hideInstallPrompt();
    }
  }

  showUpdatePrompt() {
    const updateBanner = document.createElement('div');
    updateBanner.id = 'update-banner';
    updateBanner.className = 'update-banner';
    updateBanner.innerHTML = `
      <div class="update-content">
        <div class="update-icon">🔄</div>
        <div class="update-text">
          <h3>Update Available</h3>
          <p>New version ready to install</p>
        </div>
        <div class="update-actions">
          <button id="update-btn" class="update-btn">Update</button>
          <button id="update-dismiss-btn" class="dismiss-btn">Later</button>
        </div>
      </div>
    `;

    document.body.appendChild(updateBanner);

    document.getElementById('update-btn').addEventListener('click', () => {
      this.updateApp();
    });

    document.getElementById('update-dismiss-btn').addEventListener('click', () => {
      this.hideUpdatePrompt();
    });
  }

  hideUpdatePrompt() {
    const banner = document.getElementById('update-banner');
    if (banner) {
      banner.remove();
    }
  }

  updateApp() {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async checkInstallability() {
    if ('getInstalledRelatedApps' in navigator) {
      const relatedApps = await navigator.getInstalledRelatedApps();
      console.log('Installed related apps:', relatedApps);
    }
  }

  // Method to preload all media for offline use
  async preloadAllMedia() {
    if (!this.isOnline) {
      this.showToast('Cannot preload while offline', 'error');
      return;
    }

    try {
      this.showToast('Starting media preload...', 'info');
      
      // Load playlist data
      const response = await fetch('/playlists.json');
      const playlists = await response.json();
      
      let totalFiles = 0;
      let loadedFiles = 0;
      
      // Count total files
      playlists.playlists.forEach(playlist => {
        playlist.tracks.forEach(track => {
          totalFiles += 2; // audio + artwork
          if (track.IsAR && track.XR_Scene) {
            totalFiles += 1; // XR video
          }
        });
      });

      // Preload files
      for (const playlist of playlists.playlists) {
        for (const track of playlist.tracks) {
          try {
            // Preload audio
            await this.preloadFile(track.audio_url);
            loadedFiles++;
            this.updatePreloadProgress(loadedFiles, totalFiles);

            // Preload artwork
            await this.preloadFile(track.artwork_url);
            loadedFiles++;
            this.updatePreloadProgress(loadedFiles, totalFiles);

            // Preload XR video if available
            if (track.IsAR && track.XR_Scene) {
              await this.preloadFile(track.XR_Scene);
              loadedFiles++;
              this.updatePreloadProgress(loadedFiles, totalFiles);
            }
          } catch (error) {
            console.error('Failed to preload:', track.title, error);
          }
        }
      }

      this.showToast(`Preload complete! ${loadedFiles} files cached`, 'success');
    } catch (error) {
      console.error('Preload failed:', error);
      this.showToast('Preload failed. Please try again.', 'error');
    }
  }

  async preloadFile(url) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }
    return response;
  }

  updatePreloadProgress(loaded, total) {
    const progress = Math.round((loaded / total) * 100);
    this.showToast(`Preloading... ${progress}%`, 'info');
  }

  // Get cache status
  async getCacheStatus() {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const cacheStats = {};
      
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        cacheStats[name] = keys.length;
      }
      
      return cacheStats;
    }
    return null;
  }

  // Clear all caches
  async clearAllCaches() {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      this.showToast('All caches cleared', 'success');
    }
  }
}

// Initialize PWA Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.pwaManager = new PWAManager();
}); 