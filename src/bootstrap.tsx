import React from 'react';
import { createRoot } from 'react-dom/client';
import SmartCRMApp from './SmartCRMApp';
import './index.css';
import './styles/global-dark-mode.css';

import { getCRMBridge } from './services/crmBridge';
import { getStorageBucketService } from './services/storageBucketService';
import initializeAllFeatures from './scripts/initializeFeatures';

async function initStandalone() {
  try {
    // Initialize optional services used in standalone mode
    getCRMBridge();
    await getStorageBucketService().initializeBuckets();
    await initializeAllFeatures();
    console.log('[Standalone] Services initialized');
  } catch (err) {
    console.error('[Standalone] Initialization error', err);
  }
}

// Read mock props from URL for standalone testing
function readMockProps() {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get('theme') as 'light' | 'dark' | null;
  const initialRoute = params.get('route') || undefined;
  const user = params.get('user') ? JSON.parse(decodeURIComponent(params.get('user')!)) : undefined;
  return {
    sharedData: {
      user,
      isAuthenticated: !!user,
      theme: theme || undefined
    },
    initialRoute
  };
}

// Standalone init runs AFTER mount; errors are trapped and never break bootstrap
initStandalone().catch((err) => console.error('[Standalone] Initialization error', err));

const props = readMockProps();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SmartCRMApp {...props} />
  </React.StrictMode>
);
