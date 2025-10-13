import React from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { PersonalizationProvider } from './contexts/PersonalizationContext';
import { GamificationProvider } from './contexts/GamificationContext';
import Pipeline from './components/Pipeline';
import { DarkModeToggle } from './components/ui/DarkModeToggle';
import { EnhancedAIStatusIndicator } from './components/ui/EnhancedAIStatusIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useKeyboardShortcuts, globalShortcuts } from './hooks/useKeyboardShortcuts';

function AppContent() {
  console.log('🔧 AppContent: Initializing application...');
  useKeyboardShortcuts(globalShortcuts);
  const { isInitialized } = useTheme();

  console.log('🎨 Theme initialized:', isInitialized);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-all duration-200 ${
      isInitialized ? 'opacity-100' : 'opacity-0'
    }`}>
      {/* Header */}
      <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 transition-colors duration-300">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Smart CRM</h1>
            <div className="flex items-center space-x-4">
              <DarkModeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <Pipeline />
      
      {/* Enhanced AI Status Indicator */}
      <ErrorBoundary level="component">
        <EnhancedAIStatusIndicator />
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary level="critical">
      <ThemeProvider>
        <PersonalizationProvider>
          <GamificationProvider>
            <ErrorBoundary level="page">
              <AppContent />
            </ErrorBoundary>
          </GamificationProvider>
        </PersonalizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;