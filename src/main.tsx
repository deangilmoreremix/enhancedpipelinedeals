import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/global-dark-mode.css';

// DEV ONLY - Quick guard to catch setTimeout misuse
(function () {
  const _setTimeout = window.setTimeout;
  window.setTimeout = function (cb: any, ms?: number, ...args: any[]) {
    if (typeof cb !== "function") {
      console.error("❌ setTimeout callback is not a function:", cb);
      console.error("❌ Stack trace:", new Error().stack);
      return _setTimeout(() => {}, ms ?? 0); // avoid crash so we can see the log
    }
    return _setTimeout(cb, ms!, ...args);
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
