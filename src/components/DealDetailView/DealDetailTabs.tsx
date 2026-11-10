import React, { useEffect, useCallback } from 'react';
import { User, Brain, TrendingUp, MessageSquare, BarChart3, Zap, Settings, Calendar, Mail, FileText, ListChecks, Paperclip, Clock } from 'lucide-react';
import { DealDetailTabsProps } from './types';

export const DealDetailTabs: React.FC<DealDetailTabsProps> = ({
  activeTab,
  onTabChange
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: User, shortcut: '1' },
    { id: 'notes', label: 'Notes', icon: FileText, shortcut: '2' },
    { id: 'tasks', label: 'Tasks', icon: ListChecks, shortcut: '3' },
    { id: 'files', label: 'Files', icon: Paperclip, shortcut: '4' },
    { id: 'timeline', label: 'Timeline', icon: Clock, shortcut: '5' },
    { id: 'insights', label: 'AI Insights', icon: Brain, shortcut: '6' },
    { id: 'journey', label: 'Journey', icon: TrendingUp, shortcut: '7' },
    { id: 'communication', label: 'Communication', icon: MessageSquare, shortcut: '8' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, shortcut: '9' },
    { id: 'email', label: 'Email', icon: Mail, shortcut: '' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, shortcut: '' },
    { id: 'automation', label: 'Automation', icon: Zap, shortcut: '' },
    { id: 'management', label: 'Management', icon: Settings, shortcut: '' },
  ];


  // Keyboard navigation support
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Only handle keyboard shortcuts if the modal is focused
    // Check if we're in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    // Alt + number to switch tabs
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      const tab = tabs.find(t => t.shortcut && t.shortcut === e.key);
      if (tab) {
        e.preventDefault();
        onTabChange(tab.id);
      }
    }
  }, [onTabChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.shortcut ? `${tab.label} (Alt+${tab.shortcut})` : tab.label}
                className={`
                  relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2
                  ${activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm scale-105'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-0.5 bg-blue-500 rounded-t-full"></span>
                )}
                {tab.shortcut && (
                  <span className="hidden xl:inline-block text-xs opacity-60 ml-1">
                    {tab.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="hidden lg:flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">Alt</kbd>
          <span>+</span>
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">1-9</kbd>
          <span className="ml-2">to switch tabs</span>
        </div>
      </div>
    </div>
  );
};