import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/global-dark-mode.css';

// DEV ONLY - Quick guard to catch setTimeout misuse
(function () {
  const _setTimeout = window.setTimeout;
  window.setTimeout = function (cb: any, ms?: number, ...args: any[]): NodeJS.Timeout {
    if (typeof cb !== "function") {
      console.error("❌ setTimeout callback is not a function:", cb);
      console.error("❌ Stack trace:", new Error().stack);
      // Return a safe timer that does nothing to avoid crash
      return _setTimeout(() => {
        // Safe no-op function
      }, ms ?? 0);
    }
    return _setTimeout(cb, ms ?? 0, ...args);
  };
})();

// Initialize CRM Bridge for remote app communication
import { getCRMBridge } from './services/crmBridge';
getCRMBridge();
import './styles/global-dark-mode.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
