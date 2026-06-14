import React, { useState, useEffect } from 'react';
import { Settings, Key, Eye, EyeOff, Check, X, AlertCircle, Sparkles, Database, Brain, Globe } from 'lucide-react';
import { getSettingsService, UserApiKeys } from '../../services/settingsService';
import { ModernButton } from './ModernButton';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ApiKeyFieldProps {
  provider: keyof UserApiKeys;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  icon: React.ReactNode;
}

const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  label,
  description,
  placeholder,
  value,
  onChange,
  onClear,
  icon
}) => {
  const [showKey, setShowKey] = useState(false);
  const isConfigured = value && !value.includes('placeholder') && value.length > 0;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            {icon}
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{label}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
        {isConfigured && (
          <span className="flex items-center text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-full">
            <Check className="w-3 h-3 mr-1" />
            Configured
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     font-mono text-sm"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {value && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
              title="Clear key"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {!isConfigured && value && value.includes('placeholder') && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center">
          <AlertCircle className="w-3 h-3 mr-1" />
          This appears to be a placeholder key
        </p>
      )}
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const settingsService = getSettingsService();
  const [settings, setSettings] = useState(settingsService.getSettings());
  const [activeTab, setActiveTab] = useState<'api' | 'general'>('api');
  const [saved, setSaved] = useState(false);
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = settingsService.subscribe(() => {
      setSettings(settingsService.getSettings());
    });
    return unsubscribe;
  }, []);

  const handleApiKeyChange = (provider: keyof UserApiKeys, value: string) => {
    settingsService.setApiKey(provider, value);
    setSettings(settingsService.getSettings());
    showSaved();
  };

  const handleClearApiKey = (provider: keyof UserApiKeys) => {
    settingsService.removeApiKey(provider);
    setSettings(settingsService.getSettings());
    showSaved();
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearAll = () => {
    settingsService.clearAll();
    setSettings(settingsService.getSettings());
    setShowDangerConfirm(false);
    showSaved();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure your API keys and preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('api')}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'api'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Key className="w-4 h-4 inline mr-2" />
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            General
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Enter your own API keys to enable AI features. Keys are stored locally in your browser.
                    </p>
                  </div>
                </div>
              </div>

              <ApiKeyField
                provider="openai"
                label="OpenAI API Key"
                description="Required for GPT-5, GPT-4, and other OpenAI models"
                placeholder="sk-..."
                value={settings.apiKeys.openai || ''}
                onChange={(v) => handleApiKeyChange('openai', v)}
                onClear={() => handleClearApiKey('openai')}
                icon={<Sparkles className="w-4 h-4 text-blue-600" />}
              />

              <ApiKeyField
                provider="google"
                label="Google AI API Key"
                description="For Gemini models and Google AI features"
                placeholder="AIza..."
                value={settings.apiKeys.google || ''}
                onChange={(v) => handleApiKeyChange('google', v)}
                onClear={() => handleClearApiKey('google')}
                icon={<Brain className="w-4 h-4 text-green-600" />}
              />

              <ApiKeyField
                provider="anthropic"
                label="Anthropic API Key"
                description="For Claude and other Anthropic models"
                placeholder="sk-ant-..."
                value={settings.apiKeys.anthropic || ''}
                onChange={(v) => handleApiKeyChange('anthropic', v)}
                onClear={() => handleClearApiKey('anthropic')}
                icon={<Globe className="w-4 h-4 text-purple-600" />}
              />

              <ApiKeyField
                provider="supabase"
                label="Supabase Project URL"
                description="Your Supabase project URL (optional)"
                placeholder="https://your-project.supabase.co"
                value={settings.apiKeys.supabase || ''}
                onChange={(v) => handleApiKeyChange('supabase', v)}
                onClear={() => handleClearApiKey('supabase')}
                icon={<Database className="w-4 h-4 text-cyan-600" />}
              />
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Data Synchronization</h4>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dataSyncEnabled}
                    onChange={(e) => {
                      settingsService.setDataSyncEnabled(e.target.checked);
                      setSettings(settingsService.getSettings());
                      showSaved();
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Sync data with cloud database
                  </span>
                </label>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 ml-7">
                  When disabled, the app will only use local data.
                </p>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">AI Gateway URL</h4>
                <input
                  type="text"
                  value={settings.aiGatewayUrl}
                  onChange={(e) => {
                    settingsService.setAiGatewayUrl(e.target.value);
                    setSettings(settingsService.getSettings());
                    showSaved();
                  }}
                  placeholder="https://your-gateway.supabase.co"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Custom AI gateway URL for enterprise deployments (optional).
                </p>
              </div>

              <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-3">Danger Zone</h4>
                {showDangerConfirm ? (
                  <div className="space-y-2">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Are you sure? This will remove all your API keys and settings.
                    </p>
                    <div className="flex space-x-2">
                      <ModernButton
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDangerConfirm(false)}
                      >
                        Cancel
                      </ModernButton>
                      <ModernButton
                        variant="danger"
                        size="sm"
                        onClick={handleClearAll}
                      >
                        Yes, Clear All
                      </ModernButton>
                    </div>
                  </div>
                ) : (
                  <ModernButton
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDangerConfirm(true)}
                  >
                    Clear All Settings
                  </ModernButton>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {saved && (
              <span className="flex items-center text-green-600 dark:text-green-400">
                <Check className="w-4 h-4 mr-1" />
                Settings saved
              </span>
            )}
          </div>
          <ModernButton variant="primary" onClick={onClose}>
            Done
          </ModernButton>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;