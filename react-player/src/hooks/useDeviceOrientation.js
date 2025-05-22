import { useState, useCallback, useEffect } from 'react';

export const useDeviceOrientation = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(isIOSDevice);
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

  const checkPermission = useCallback(() => {
    const hasRequestedBefore = localStorage.getItem('hasRequestedMotionPermissions');
    return !isIOS || hasRequestedBefore;
  }, [isIOS]);

  return {
    hasPermission,
    isIOS,
    requestPermission,
    checkPermission,
  };
};
