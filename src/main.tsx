import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/global-dark-mode.css';

// Initialize CRM Bridge for remote app communication
import { getCRMBridge } from './services/crmBridge';
getCRMBridge();
import './styles/global-dark-mode.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
