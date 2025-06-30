import React, { useState, useEffect } from 'react';
import { usePWA } from '../../hooks/usePWA';
import playlistData from '../../data/playlist.json';
import './DownloadButton.css';

const DownloadButton = () => {
  const {
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
  } = usePWA();

  const [isAllCached, setIsAllCached] = useState(false);

  // Check cache status on mount and when cache status changes
  useEffect(() => {
    if (isServiceWorkerRegistered) {
      getCacheStatus(playlistData);
    }
  }, [isServiceWorkerRegistered, getCacheStatus]);

  useEffect(() => {
    setIsAllCached(isAllMediaCached());
  }, [cacheStatus, isAllMediaCached]);

  const handleDownloadClick = async () => {
    if (isDownloading) return;
    
    await downloadAllMedia(playlistData);
  };

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear all downloaded content? This will free up storage space but you\'ll need to download again for offline use.')) {
      await clearCache();
      setIsAllCached(false);
    }
  };

  const getButtonText = () => {
    if (isDownloading) {
      return `Downloading... ${getDownloadProgressPercentage()}%`;
    }
    if (isAllCached) {
      return '✓ Downloaded';
    }
    return 'Download All';
  };

  const getButtonIcon = () => {
    if (isDownloading) {
      return 'fas fa-spinner fa-spin';
    }
    if (isAllCached) {
      return 'fas fa-check';
    }
    return 'fas fa-download';
  };

  const getButtonClass = () => {
    let className = 'download-btn';
    if (isDownloading) className += ' downloading';
    if (isAllCached) className += ' downloaded';
    return className;
  };

  const getErrorMessage = () => {
    if (swError) {
      if (swError.includes('not supported')) {
        return 'Service Worker not supported in this browser';
      }
      if (swError.includes('fetch')) {
        return 'Network error - check your connection';
      }
      if (swError.includes('development mode')) {
        return 'Offline features available in production build';
      }
      if (swError.includes('direct cache API')) {
        return 'Using direct cache API (offline features available)';
      }
      return `Service Worker error: ${swError}`;
    }
    return 'Offline mode not available';
  };

  return (
    <div className="download-button-container">
      <button
        className={getButtonClass()}
        onClick={handleDownloadClick}
        disabled={isDownloading || !isServiceWorkerRegistered}
        title={
          isDownloading 
            ? 'Downloading content for offline use...' 
            : isAllCached 
              ? 'All content downloaded for offline use' 
              : 'Download all audio, video, and images for offline use'
        }
      >
        <i className={getButtonIcon()}></i>
        <span className="download-text">{getButtonText()}</span>
      </button>

      {/* Progress indicator */}
      {isDownloading && (
        <div className="download-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${getDownloadProgressPercentage()}%` }}
            ></div>
          </div>
          <div className="progress-text">
            {downloadProgress.successCount + downloadProgress.failedCount} / {downloadProgress.total} files
            {downloadProgress.failedCount > 0 && (
              <span className="failed-count"> ({downloadProgress.failedCount} failed)</span>
            )}
          </div>
        </div>
      )}

      {/* Cache management */}
      {isAllCached && (
        <button
          className="clear-cache-btn"
          onClick={handleClearCache}
          title="Clear downloaded content to free up storage"
        >
          <i className="fas fa-trash"></i>
          <span>Clear Cache</span>
        </button>
      )}

      {/* Service worker status indicator */}
      {!isServiceWorkerRegistered && !swError?.includes('direct cache API') && (
        <div className="service-worker-status">
          <i className="fas fa-exclamation-triangle"></i>
          <span>{getErrorMessage()}</span>
        </div>
      )}
      
      {/* Fallback mode indicator */}
      {swError?.includes('direct cache API') && (
        <div className="service-worker-status" style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', borderColor: 'rgba(76, 175, 80, 0.3)' }}>
          <i className="fas fa-info-circle"></i>
          <span>{getErrorMessage()}</span>
        </div>
      )}
    </div>
  );
};

export default DownloadButton; 