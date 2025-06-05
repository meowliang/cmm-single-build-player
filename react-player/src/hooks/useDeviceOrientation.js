import { useState, useCallback, useEffect } from 'react';

export const useDeviceOrientation = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showPermissionOverlay, setShowPermissionOverlay] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(isIOSDevice);

      // Check if we need to show the permission overlay
      const hasRequestedBefore = localStorage.getItem('hasRequestedMotionPermissions');
      if (isIOSDevice && !hasRequestedBefore) {
        setShowPermissionOverlay(true);
      }
    };
    checkDevice();
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        setHasPermission(permission === 'granted');
        
        if (permission === 'granted') {
          localStorage.setItem('hasRequestedMotionPermissions', 'true');
          setShowPermissionOverlay(false);
          
          // Also request motion permission if available
          if (typeof DeviceMotionEvent !== 'undefined' && 
              typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission();
          }
        }
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        return false;
      }
    }
    return true; // Non-iOS devices don't need permission
  }, []);

  const skipPermission = useCallback(() => {
    localStorage.setItem('hasRequestedMotionPermissions', 'true');
    setShowPermissionOverlay(false);
  }, []);

  return {
    hasPermission,
    isIOS,
    showPermissionOverlay,
    requestPermission,
    skipPermission
  };
};
