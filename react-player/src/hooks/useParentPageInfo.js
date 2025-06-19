import { useEffect, useState } from 'react';

export default function useParentPageInfo() {
  const [pageInfo, setPageInfo] = useState(null);

  useEffect(() => {
    function handleMessage(event) {
      if (event.data.type === 'PAGE_INFO') {
        setPageInfo(event.data);
      }
    }
    window.addEventListener('message', handleMessage);
    // Request page info from parent
    window.parent.postMessage({ type: 'REQUEST_PAGE_INFO' }, '*');
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return pageInfo;
} 