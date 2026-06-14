/**
 * User Settings Service
 * Manages user-configured API keys and preferences
 * Keys are stored in localStorage for browser-based persistence
 */

interface UserApiKeys {
  openai?: string;
  google?: string;
  anthropic?: string;
  supabase?: string;
}

interface UserSettings {
  apiKeys: UserApiKeys;
  theme: 'light' | 'dark' | 'system';
  dataSyncEnabled: boolean;
  aiGatewayUrl: string;
}

const STORAGE_KEY = 'crm_user_settings';

const DEFAULT_SETTINGS: UserSettings = {
  apiKeys: {},
  theme: 'system',
  dataSyncEnabled: true,
  aiGatewayUrl: ''
};

class SettingsService {
  private settings: UserSettings;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current settings
   */
  getSettings(): UserSettings {
    return { ...this.settings };
  }

  /**
   * Get a specific API key
   */
  getApiKey(provider: keyof UserApiKeys): string | undefined {
    return this.settings.apiKeys[provider];
  }

  /**
   * Set an API key for a provider
   */
  setApiKey(provider: keyof UserApiKeys, key: string): void {
    if (!key.trim()) {
      // Remove key if empty
      const { [provider]: _, ...rest } = this.settings.apiKeys;
      this.settings.apiKeys = rest;
    } else {
      this.settings.apiKeys = {
        ...this.settings.apiKeys,
        [provider]: key.trim()
      };
    }
    this.saveSettings();
  }

  /**
   * Remove an API key
   */
  removeApiKey(provider: keyof UserApiKeys): void {
    const { [provider]: _, ...rest } = this.settings.apiKeys;
    this.settings.apiKeys = rest;
    this.saveSettings();
  }

  /**
   * Check if a provider has an API key configured
   */
  hasApiKey(provider: keyof UserApiKeys): boolean {
    const key = this.settings.apiKeys[provider];
    return !!key && key.length > 0 && !key.includes('placeholder');
  }

  /**
   * Get all configured API key providers
   */
  getConfiguredProviders(): (keyof UserApiKeys)[] {
    return Object.entries(this.settings.apiKeys)
      .filter(([_, value]) => value && !value.includes('placeholder'))
      .map(([key]) => key as keyof UserApiKeys);
  }

  /**
   * Update theme preference
   */
  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.settings.theme = theme;
    this.saveSettings();
  }

  /**
   * Toggle data sync
   */
  setDataSyncEnabled(enabled: boolean): void {
    this.settings.dataSyncEnabled = enabled;
    this.saveSettings();
  }

  /**
   * Set AI Gateway URL
   */
  setAiGatewayUrl(url: string): void {
    this.settings.aiGatewayUrl = url;
    this.saveSettings();
  }

  /**
   * Clear all settings
   */
  clearAll(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
  }
}

// Singleton instance
let settingsServiceInstance: SettingsService | null = null;

export const getSettingsService = (): SettingsService => {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new SettingsService();
  }
  return settingsServiceInstance;
};

export type { UserApiKeys, UserSettings };
export const SETTINGS_SERVICE_KEY = 'crm_user_settings';