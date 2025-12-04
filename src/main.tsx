import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import './styles/global-dark-mode.css';

import { getCRMBridge } from './services/crmBridge';
import { getStorageBucketService } from './services/storageBucketService';
getCRMBridge();

// Initialize storage buckets
getStorageBucketService().initializeBuckets().then((result) => {
  if (result.success) {
    console.log('✅ Storage buckets initialized successfully');
  } else {
    console.error('❌ Failed to initialize storage buckets:', result.errors);
  }
}).catch((error) => {
  console.error('❌ Error initializing storage buckets:', error);
});
import { getCRMBridge } from './services/crmBridge';
getCRMBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);
