import React, { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
import './styles/global-dark-mode.css';
import { SmartCRMRemoteProps } from './types/remote';
import { ThemeProvider } from './contexts/ThemeContext';
import { PersonalizationProvider } from './contexts/PersonalizationContext';
import { GamificationProvider } from './contexts/GamificationContext';
import { AuthProvider } from './components/auth/AuthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

export default function SmartCRMApp(props: SmartCRMRemoteProps) {
  useEffect(() => {
    if (props?.sharedData?.theme) {
      try {
        localStorage.setItem('theme', props.sharedData.theme);
        if (props.sharedData.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      (window as any).__SMARTCRM_REMOTE_BOOTSTRAPPED__ = true;
      console.log('[SmartCRM Remote] bootstrapped', { initialRoute: props?.initialRoute });
      if (props?.onEvent) props.onEvent({ type: 'bootstrapped', payload: { initialRoute: props?.initialRoute } });
    }
  }, []);

  const embedded = !!(props && (props.initialRoute || props.sharedData));
  const Router = embedded ? MemoryRouter : BrowserRouter;
  const routerProps: any = embedded ? { initialEntries: [props.initialRoute || '/'] } : {};

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <PersonalizationProvider>
              <GamificationProvider>
                <Router {...routerProps}>
                  <App {...props} />
                </Router>
              </GamificationProvider>
            </PersonalizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export type { SmartCRMRemoteProps };
