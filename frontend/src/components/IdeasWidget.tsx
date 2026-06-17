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

// Pinned to widget v0.1.1 with SHA-384 integrity hashes from the
// ideas-api manifest at https://ideas.fortiumsoftware.com/widget/latest.json
const WIDGET_BASE = 'https://ideas.fortiumsoftware.com/widget/v0.1.1';
const WIDGET_CSS_INTEGRITY = 'sha384-jBluHDmSx9HmMApEPKFK29DRVWUEIrmavL2HxzdDe2YEjZftXbmVFYxq8btll6KL';
const WIDGET_JS_INTEGRITY = 'sha384-6guBmX35PL935L9ltOEnFtDg9NyMPDYVzKpLZIfO4ALTw1SK0Y+wOvAKr15lcaVZ';

export function IdeasWidget() {
  useEffect(() => {
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${WIDGET_BASE}/style.css`;
    link.integrity = WIDGET_CSS_INTEGRITY;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    // Load UMD script
    const script = document.createElement('script');
    script.src = `${WIDGET_BASE}/fortium-ideas.umd.js`;
    script.integrity = WIDGET_JS_INTEGRITY;
    script.crossOrigin = 'anonymous';
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
