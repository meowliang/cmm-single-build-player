import { useState, useCallback, useEffect } from 'react';

export const useDeviceOrientation = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showPermissionOverlay, setShowPermissionOverlay] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkDevice = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroidDevice = /Android/.test(navigator.userAgent);
      
      setIsIOS(isIOSDevice);
      setIsAndroid(isAndroidDevice);

      // Check if we need to show the permission overlay
      const hasRequestedBefore = localStorage.getItem('hasRequestedMotionPermissions');
      
      // Show overlay for iOS devices that haven't requested before
      if (isIOSDevice && !hasRequestedBefore) {
        setShowPermissionOverlay(true);
      }
      // For Android and other devices, we don't need to show the overlay
      // as they typically don't require explicit permission requests
    };
    checkDevice();
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      // For iOS Safari - requires explicit permission
      if (isIOS && typeof DeviceOrientationEvent !== 'undefined' && 
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        const isGranted = permission === 'granted';
        setHasPermission(isGranted);
        
        if (isGranted) {
          localStorage.setItem('hasRequestedMotionPermissions', 'true');
          setShowPermissionOverlay(false);
          
          // Also request motion permission if available
          if (typeof DeviceMotionEvent !== 'undefined' && 
              typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
              await DeviceMotionEvent.requestPermission();
            } catch (motionError) {
              console.warn('Motion permission request failed:', motionError);
            }
          }
        } else {
          setError('Permission denied. Some features may not work properly.');
        }
        return isGranted;
      }
      
      // For Android and other devices - no explicit permission needed
      // Just check if the device supports orientation events
      if (typeof DeviceOrientationEvent !== 'undefined') {
        setHasPermission(true);
        localStorage.setItem('hasRequestedMotionPermissions', 'true');
        setShowPermissionOverlay(false);
        return true;
      }
      
      // Fallback for devices that don't support orientation events
      setHasPermission(false);
      localStorage.setItem('hasRequestedMotionPermissions', 'true');
      setShowPermissionOverlay(false);
      setError('Device orientation not supported on this device.');
      return false;
    } catch (error) {
      console.error('Error requesting device orientation permission:', error);
      setError('Failed to request device orientation permission. Please try again.');
      return false;
    }
  }, [isIOS]);

  const skipPermission = useCallback(() => {
    localStorage.setItem('hasRequestedMotionPermissions', 'true');
    setShowPermissionOverlay(false);
  }, []);

  return {
    hasPermission,
    isIOS,
    isAndroid,
    showPermissionOverlay,
    requestPermission,
    skipPermission,
    error
  };
};
