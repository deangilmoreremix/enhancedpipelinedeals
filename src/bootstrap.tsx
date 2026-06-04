import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import SmartCRMApp from './SmartCRMApp';
import './index.css';
import './styles/global-dark-mode.css';

import { getCRMBridge } from './services/crmBridge';
import { getStorageBucketService } from './services/storageBucketService';
import initializeAllFeatures from './scripts/initializeFeatures';
import { LoadingTimeout } from './components/LoadingTimeout';

async function initStandalone() {
  try {
    getCRMBridge();
    await getStorageBucketService().initializeBuckets();
    await initializeAllFeatures();
    console.log('[Standalone] Services initialized');
  } catch (err) {
    console.error('[Standalone] Initialization error', err);
  }
}

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

initStandalone();

const props = readMockProps();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <Suspense fallback={<LoadingTimeout />}>
        <SmartCRMApp {...props} />
      </Suspense>
    </React.StrictMode>
  );
} else {
  console.error('[Bootstrap] Root element not found');
}
} else {
  console.error('[Bootstrap] Root element not found');
}