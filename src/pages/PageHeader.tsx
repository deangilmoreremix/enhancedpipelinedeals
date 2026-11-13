import React from 'react';

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {subtitle && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
);

export interface TabDef { id: string; label: string }

export const Tabs: React.FC<{ tabs: TabDef[]; active: string; onChange: (id: string) => void }> = ({ tabs, active, onChange }) => (
  <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
    {tabs.map(t => (
      <button
        key={t.id}
        role="tab"
        aria-selected={active === t.id}
        onClick={() => onChange(t.id)}
        className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
          active === t.id
            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);
