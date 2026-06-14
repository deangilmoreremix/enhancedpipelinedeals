import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/global-dark-mode.css';

// Initialize CRM Bridge for remote app communication
import { getCRMBridge } from './services/crmBridge';
getCRMBridge();

// Global error handlers for production hardening
if (import.meta.env.PROD) {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // In production, you would send this to an error reporting service
  });

  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // In production, you would send this to an error reporting service
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
