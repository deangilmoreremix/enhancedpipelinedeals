import React, { useState } from 'react';
import { Users, BarChart3, Bot, Calendar, Grid3X3, ChevronDown, ChevronUp } from 'lucide-react';

export type NavigationTab = 'contacts' | 'pipeline' | 'agents' | 'calendar' | 'apps';

export interface AppNavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  appsExpanded: boolean;
  onAppsToggle: () => void;
}

export const AppNavigation: React.FC<AppNavigationProps> = ({
  activeTab,
  onTabChange,
  appsExpanded,
  onAppsToggle
}) => {
  const coreTabs = [
    {
      id: 'contacts' as NavigationTab,
      label: 'Contacts',
      icon: Users,
      description: 'Contact management & CRM'
    },
    {
      id: 'pipeline' as NavigationTab,
      label: 'Pipeline',
      icon: BarChart3,
      description: 'Deal pipeline & sales management'
    },
    {
      id: 'agents' as NavigationTab,
      label: 'Agents',
      icon: Bot,
      description: 'SDR agents & automation'
    },
    {
      id: 'calendar' as NavigationTab,
      label: 'Calendar',
      icon: Calendar,
      description: 'AI calendar & scheduling'
    }
  ];

  const appsList = [
    { id: 'voice', label: 'Voice Assistant', icon: '🔊' },
    { id: 'video', label: 'Video AI', icon: '🎥' },
    { id: 'autopilot', label: 'AI Autopilot', icon: '🤖' },
    { id: 'skills', label: 'Agent Skills', icon: '🧠' },
    { id: 'heatmap', label: 'Deal Heatmap', icon: '🔥' },
    { id: 'playbooks', label: 'Sales Playbooks', icon: '📋' },
    { id: 'memory', label: 'Agent Memory', icon: '🧠' },
    { id: 'mood', label: 'Mood Engine', icon: '🎭' }
  ];

  return (
    <div
      style={{
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Core Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {coreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '16px 20px',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                    background: 'transparent',
                    color: isActive ? '#1a202c' : '#6b7280',
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  title={tab.description}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -3,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: '#3b82f6',
                        borderRadius: '3px 3px 0 0'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Apps Section */}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button
              onClick={onAppsToggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '16px 20px',
                border: 'none',
                borderBottom: appsExpanded ? '3px solid #6b7280' : '3px solid transparent',
                background: 'transparent',
                color: appsExpanded ? '#1a202c' : '#6b7280',
                fontSize: 14,
                fontWeight: appsExpanded ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Advanced tools and features"
            >
              <Grid3X3 size={18} />
              <span>Apps</span>
              {appsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Apps Dropdown */}
            {appsExpanded && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: 280,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  maxHeight: 400,
                  overflow: 'auto'
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}
                >
                  Advanced Tools
                </div>
                {appsList.map((app) => (
                  <div
                    key={app.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f8fafc',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title={`Open ${app.label}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16 }}>{app.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#1a202c' }}>
                          {app.label}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          Advanced feature
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div
                  style={{
                    padding: '12px 16px',
                    fontSize: 12,
                    color: '#64748b',
                    textAlign: 'center',
                    fontStyle: 'italic'
                  }}
                >
                  Click to open advanced tools
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppNavigation;