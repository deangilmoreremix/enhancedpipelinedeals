/**
 * API Key Provider
 * Utilities for getting API keys from user settings or environment
 */

import { getSettingsService } from './settingsService';

export type ApiProvider = 'openai' | 'google' | 'anthropic' | 'supabase';

/**
 * Get API key for a provider
 * Checks user settings first, then falls back to environment variables
 */
export const getApiKey = (provider: ApiProvider): string | undefined => {
  const settingsService = getSettingsService();

  // First check user-provided key
  const userKey = settingsService.getApiKey(provider);
  if (userKey && !userKey.includes('placeholder') && userKey.length > 0) {
    return userKey;
  }

  // Fall back to environment variable
  const envKeyMap: Record<ApiProvider, string> = {
    openai: import.meta.env.VITE_OPENAI_API_KEY,
    google: import.meta.env.VITE_GOOGLE_API_KEY,
    anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
    supabase: import.meta.env.VITE_SUPABASE_URL
  };

  const envKey = envKeyMap[provider];
  if (envKey && !envKey.includes('placeholder') && envKey.length > 0) {
    return envKey;
  }

  return undefined;
};

/**
 * Check if an API key is configured (either user or env)
 */
export const hasApiKey = (provider: ApiProvider): boolean => {
  const key = getApiKey(provider);
  return !!key && key.length > 0 && !key.includes('placeholder');
};

/**
 * Get OpenAI API key with user priority
 */
export const getOpenAIApiKey = (): string | undefined => {
  return getApiKey('openai');
};

/**
 * Get Google API key with user priority
 */
export const getGoogleApiKey = (): string | undefined => {
  return getApiKey('google');
};

/**
 * Get Anthropic API key with user priority
 */
export const getAnthropicApiKey = (): string | undefined => {
  return getApiKey('anthropic');
};

/**
 * Get configured providers (those with valid keys)
 */
export const getConfiguredProviders = (): ApiProvider[] => {
  const providers: ApiProvider[] = ['openai', 'google', 'anthropic', 'supabase'];
  return providers.filter(p => hasApiKey(p));
};