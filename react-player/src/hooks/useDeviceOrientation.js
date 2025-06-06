import { useState, useCallback, useEffect } from 'react';

export const useDeviceOrientation = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showPermissionOverlay, setShowPermissionOverlay] = useState(false);
  const [error, setError] = useState(null);

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
    try {
      // For iOS Safari
      if (typeof DeviceOrientationEvent !== 'undefined' && 
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
      
      // For non-iOS devices
      setHasPermission(true);
      localStorage.setItem('hasRequestedMotionPermissions', 'true');
      setShowPermissionOverlay(false);
      return true;
    } catch (error) {
      console.error('Error requesting device orientation permission:', error);
      setError('Failed to request device orientation permission. Please try again.');
      return false;
    }
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
    skipPermission,
    error
  };
};
