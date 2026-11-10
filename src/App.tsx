import React, { Suspense, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { PersonalizationProvider } from './contexts/PersonalizationContext';
import { GamificationProvider } from './contexts/GamificationContext';
import { AuthProvider } from './components/auth/AuthProvider';
import { AppNavigation } from './components/navigation/AppNavigation';
import { DarkModeToggle } from './components/ui/DarkModeToggle';
import { EnhancedAIStatusIndicator } from './components/ui/EnhancedAIStatusIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsModal } from './components/ui/SettingsModal';
import { useKeyboardShortcuts, globalShortcuts } from './hooks/useKeyboardShortcuts';
import { Settings } from 'lucide-react';

const PipelinePage = React.lazy(() => import('./pages/PipelinePage'));
const ContactsPage = React.lazy(() => import('./pages/ContactsPage'));
const AgentsPage = React.lazy(() => import('./pages/AgentsPage'));
const CalendarPage = React.lazy(() => import('./pages/CalendarPage'));
const EmailPage = React.lazy(() => import('./pages/EmailPage'));
const ViewsPage = React.lazy(() => import('./pages/ViewsPage'));
const WorkflowsPage = React.lazy(() => import('./pages/WorkflowsPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const AppsPage = React.lazy(() => import('./pages/AppsPage'));
const DealRecordPage = React.lazy(() => import('./pages/DealRecordPage'));

const routeElement = (node: React.ReactNode) => (
  <ErrorBoundary level="page">{node}</ErrorBoundary>
);

const PageFallback = () => (
  <div className="flex items-center justify-center py-24 text-gray-500 dark:text-gray-400" role="status">
    Loading...
  </div>
);

const NotFound = () => (
  <div className="max-w-7xl mx-auto px-4 py-16 text-center">
    <h2 className="text-xl font-semibold">Page not found</h2>
  </div>
);

function AppContent() {
  useKeyboardShortcuts(globalShortcuts);
  const { isInitialized } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 text-gray-900 dark:text-white ${
      isInitialized ? 'opacity-100' : 'opacity-0'
    }`}>
      {/* Header */}
      <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 transition-colors duration-300">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Smart CRM</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <DarkModeToggle />
            </div>
          </div>
          <AppNavigation />
        </div>
      </header>

      {/* Main content */}
      <main>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={routeElement(<PipelinePage />)} />
            <Route path="/contacts" element={routeElement(<ContactsPage />)} />
            <Route path="/agents" element={routeElement(<AgentsPage />)} />
            <Route path="/calendar" element={routeElement(<CalendarPage />)} />
            <Route path="/email" element={routeElement(<EmailPage />)} />
            <Route path="/views" element={routeElement(<ViewsPage />)} />
            <Route path="/workflows" element={routeElement(<WorkflowsPage />)} />
            <Route path="/analytics" element={routeElement(<AnalyticsPage />)} />
            <Route path="/apps" element={routeElement(<AppsPage />)} />
            <Route path="/deals/:id" element={routeElement(<DealRecordPage />)} />
            <Route path="*" element={routeElement(<NotFound />)} />
          </Routes>
        </Suspense>
      </main>

      {/* Enhanced AI Status Indicator */}
      <ErrorBoundary level="component">
        <EnhancedAIStatusIndicator />
      </ErrorBoundary>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary level="critical">
      <ThemeProvider>
        <PersonalizationProvider>
          <GamificationProvider>
            <AuthProvider>
              <ErrorBoundary level="page">
                <AppContent />
              </ErrorBoundary>
            </AuthProvider>
          </GamificationProvider>
        </PersonalizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;