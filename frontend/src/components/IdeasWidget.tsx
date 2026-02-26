// frontend/src/components/IdeasWidget.tsx
import { useEffect } from 'react';

declare global {
  interface Window {
    FortiumIdeas?: {
      init: (config: {
        appId: string;
        repo: string;
        apiUrl?: string;
        getContext?: () => Record<string, unknown>;
      }) => void;
      destroy: () => void;
    };
  }
}

export function IdeasWidget() {
  useEffect(() => {
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/fortium-ideas.css';
    document.head.appendChild(link);

    // Load UMD script
    const script = document.createElement('script');
    script.src = '/js/fortium-ideas.umd.js';
    script.onload = () => {
      window.FortiumIdeas?.init({
        appId: 'athleticos',
        repo: 'FortiumPartners/AthleticOS',
        apiUrl: '/api/v1/ideas',
        getContext: () => ({
          pageUrl: window.location.pathname,
        }),
      });
    };
    document.body.appendChild(script);

    return () => {
      window.FortiumIdeas?.destroy();
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
