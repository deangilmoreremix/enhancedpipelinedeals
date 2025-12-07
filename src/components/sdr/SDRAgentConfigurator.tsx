import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Settings, Mail, MessageCircle, Phone, Calendar, Zap, Target, Clock, Palette } from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';
import { SDRUserPreferences, SDRAgentPreferences, SDRTone, SDRStyle, SDRChannel, SDRTiming } from '../../types/sdr-config';
import { sdrPreferencesService } from '../../services/sdrPreferencesService';

interface SDRAgentConfiguratorProps {
  agentId: string;
  agentName: string;
  currentConfig?: SDRUserPreferences;
  onSave: (config: SDRAgentPreferences) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
}

export const SDRAgentConfigurator: React.FC<SDRAgentConfiguratorProps> = ({
  agentId,
  agentName,
  currentConfig,
  onSave,
  onClose,
  isOpen
}) => {
  const [config, setConfig] = useState<SDRAgentPreferences>(
    currentConfig?.preferences || sdrPreferencesService.getDefaultPreferences(agentId)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'content' | 'channels' | 'advanced'>('basic');

  useEffect(() => {
    if (currentConfig?.preferences) {
      setConfig(currentConfig.preferences);
    } else {
      setConfig(sdrPreferencesService.getDefaultPreferences(agentId));
    }
  }, [currentConfig, agentId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(sdrPreferencesService.getDefaultPreferences(agentId));
  };

  const updateConfig = (updates: Partial<SDRAgentPreferences>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateBranding = (updates: Partial<SDRAgentPreferences['branding']>) => {
    setConfig(prev => ({
      ...prev,
      branding: { ...prev.branding, ...updates }
    }));
  };

  const updateChannels = (updates: Partial<SDRAgentPreferences['channels']>) => {
    setConfig(prev => ({
      ...prev,
      channels: { ...prev.channels, ...updates }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Configure {agentName}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize agent behavior and preferences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'basic', label: 'Basic Settings', icon: Zap },
            { id: 'content', label: 'Content & Style', icon: Palette },
            { id: 'channels', label: 'Channels', icon: Mail },
            { id: 'advanced', label: 'Advanced', icon: Target }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'basic' && (
            <BasicSettingsTab config={config} onUpdate={updateConfig} />
          )}

          {activeTab === 'content' && (
            <ContentSettingsTab config={config} onUpdate={updateConfig} onUpdateBranding={updateBranding} />
          )}

          {activeTab === 'channels' && (
            <ChannelSettingsTab config={config} onUpdateChannels={updateChannels} />
          )}

          {activeTab === 'advanced' && (
            <AdvancedSettingsTab config={config} onUpdate={updateConfig} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <ModernButton
            variant="outline"
            onClick={handleReset}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Reset to Defaults
          </ModernButton>

          <ModernButton
            variant="primary"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Configuration
          </ModernButton>
        </div>
      </div>
    </div>
  );
};

// Basic Settings Tab Component
const BasicSettingsTab: React.FC<{
  config: SDRAgentPreferences;
  onUpdate: (updates: Partial<SDRAgentPreferences>) => void;
}> = ({ config, onUpdate }) => (
  <div className="space-y-6">
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Campaign Length
      </label>
      <select
        value={config.campaignLength}
        onChange={(e) => onUpdate({ campaignLength: parseInt(e.target.value) })}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        <option value={3}>Short (3 messages)</option>
        <option value={5}>Medium (5 messages)</option>
        <option value={7}>Long (7 messages)</option>
        <option value={10}>Extended (10 messages)</option>
      </select>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Timing Between Messages
      </label>
      <select
        value={config.timing}
        onChange={(e) => onUpdate({ timing: e.target.value as SDRTiming })}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        <option value="immediate">Send immediately</option>
        <option value="business-hours">Next business day</option>
        <option value="daily">Daily follow-ups</option>
        <option value="weekly">Weekly follow-ups</option>
        <option value="custom">Custom schedule</option>
      </select>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Personalization Level
      </label>
      <select
        value={config.personalizationLevel}
        onChange={(e) => onUpdate({ personalizationLevel: e.target.value as 'low' | 'medium' | 'high' })}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        <option value="low">Low - Generic messaging</option>
        <option value="medium">Medium - Basic personalization</option>
        <option value="high">High - Deep personalization</option>
      </select>
    </div>
  </div>
);

// Content Settings Tab Component
const ContentSettingsTab: React.FC<{
  config: SDRAgentPreferences;
  onUpdate: (updates: Partial<SDRAgentPreferences>) => void;
  onUpdateBranding: (updates: Partial<SDRAgentPreferences['branding']>) => void;
}> = ({ config, onUpdate, onUpdateBranding }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tone
        </label>
        <select
          value={config.tone}
          onChange={(e) => onUpdate({ tone: e.target.value as SDRTone })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="professional">Professional</option>
          <option value="conversational">Conversational</option>
          <option value="enthusiastic">Enthusiastic</option>
          <option value="formal">Formal</option>
          <option value="casual">Casual</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Style
        </label>
        <select
          value={config.style}
          onChange={(e) => onUpdate({ style: e.target.value as SDRStyle })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="brief">Brief</option>
          <option value="detailed">Detailed</option>
          <option value="comprehensive">Comprehensive</option>
        </select>
      </div>
    </div>

    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Branding</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Company Name
          </label>
          <input
            type="text"
            value={config.branding.companyName}
            onChange={(e) => onUpdateBranding({ companyName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Your Company Name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Website
          </label>
          <input
            type="url"
            value={config.branding.website || ''}
            onChange={(e) => onUpdateBranding({ website: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="https://yourcompany.com"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Email Signature
        </label>
        <textarea
          value={config.branding.signature}
          onChange={(e) => onUpdateBranding({ signature: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Best regards,&#10;Your Sales Team"
        />
      </div>
    </div>
  </div>
);

// Channel Settings Tab Component
const ChannelSettingsTab: React.FC<{
  config: SDRAgentPreferences;
  onUpdateChannels: (updates: Partial<SDRAgentPreferences['channels']>) => void;
}> = ({ config, onUpdateChannels }) => {
  const channels: { id: SDRChannel; label: string; icon: any }[] = [
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'linkedin', label: 'LinkedIn', icon: MessageCircle },
    { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
    { id: 'phone', label: 'Phone', icon: Phone }
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Primary Channel
        </label>
        <select
          value={config.channels.primary}
          onChange={(e) => onUpdateChannels({ primary: e.target.value as SDRChannel })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {channels.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Channel Limits
        </label>
        <div className="grid grid-cols-2 gap-4">
          {channels.map(({ id, label, icon: Icon }) => (
            <div key={id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white">{label}</span>
              </div>
              <input
                type="number"
                min="0"
                max="10"
                value={config.channels.limits[id]}
                onChange={(e) => onUpdateChannels({
                  limits: { ...config.channels.limits, [id]: parseInt(e.target.value) || 0 }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Max messages"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Advanced Settings Tab Component
const AdvancedSettingsTab: React.FC<{
  config: SDRAgentPreferences;
  onUpdate: (updates: Partial<SDRAgentPreferences>) => void;
}> = ({ config, onUpdate }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          AI Model
        </label>
        <select
          value={config.aiModel || 'gpt-4'}
          onChange={(e) => onUpdate({ aiModel: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="gpt-4">GPT-4 (Recommended)</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="claude-3">Claude 3</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Temperature (Creativity)
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.temperature || 0.7}
          onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Current: {config.temperature || 0.7}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Max Tokens
        </label>
        <input
          type="number"
          min="100"
          max="2000"
          value={config.maxTokens || 1000}
          onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Max Retries
        </label>
        <input
          type="number"
          min="1"
          max="5"
          value={config.performanceSettings?.maxRetries || 3}
          onChange={(e) => onUpdate({
            performanceSettings: {
              ...config.performanceSettings,
              maxRetries: parseInt(e.target.value)
            }
          })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  </div>
);