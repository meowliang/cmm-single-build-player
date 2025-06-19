import { useEffect, useState } from 'react';

export default function useParentPageInfo() {
  const [pageInfo, setPageInfo] = useState(null);

  useEffect(() => {
    console.log('useParentPageInfo: Initializing...');
    
    function handleMessage(event) {
      console.log('useParentPageInfo: Received message:', event.data);
      if (event.data.type === 'PAGE_INFO') {
        console.log('useParentPageInfo: Got PAGE_INFO:', event.data);
        setPageInfo(event.data);
      }
    }

    // Check if we're in an iframe
    const isInIframe = window !== window.parent;
    console.log('useParentPageInfo: Is in iframe?', isInIframe);

    window.addEventListener('message', handleMessage);
    
    // Request page info from parent with retry mechanism
    let retryCount = 0;
    const maxRetries = 3;
    
    function requestPageInfo() {
      console.log(`useParentPageInfo: Sending REQUEST_PAGE_INFO message to parent (attempt ${retryCount + 1})`);
      window.parent.postMessage({ type: 'REQUEST_PAGE_INFO' }, '*');
      
      retryCount++;
      if (retryCount < maxRetries) {
        setTimeout(requestPageInfo, 2000); // Retry after 2 seconds
      } else {
        console.warn('useParentPageInfo: No response from parent after', maxRetries, 'attempts');
      }
    }
    
    requestPageInfo();

    return () => {
      console.log('useParentPageInfo: Cleaning up event listener');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return pageInfo;
} 