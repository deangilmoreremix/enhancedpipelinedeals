interface APIConfiguration {
  openai: {
    apiKey: string;
    model: string;
    baseUrl: string;
    gpt5: {
      model: string;
      reasoningEffort: 'low' | 'medium' | 'high';
      fallbackModels: string[];
    };
  };
  gemini: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  sendgrid: {
    apiKey: string;
    fromEmail: string;
  };
  crm?: {
    baseUrl: string;
    apiKey: string;
  };
  webSearch?: {
    enabled: boolean;
    provider: 'serpapi' | 'google' | 'bing';
    apiKey: string;
  };
}

export const getAPIConfig = (): APIConfiguration => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV;
  
  if (isDevelopment) {
    console.warn('⚠️ Development mode: Some API keys may be missing. Add them to your .env file for full functionality.');
  }

  return {
    openai: {
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      gpt5: {
        model: import.meta.env.VITE_GPT5_MODEL || 'gpt-4o',
        reasoningEffort: (import.meta.env.VITE_GPT5_REASONING_EFFORT as 'low' | 'medium' | 'high') || 'medium',
        fallbackModels: ['gpt-4o-mini', 'gpt-4o'],
      },
    },
    gemini: {
      apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
      model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    sendgrid: {
      apiKey: import.meta.env.VITE_SENDGRID_API_KEY || '',
      fromEmail: import.meta.env.VITE_FROM_EMAIL || 'noreply@yourcrm.com',
    },
    ...(import.meta.env.VITE_CRM_API_URL && {
      crm: {
        baseUrl: import.meta.env.VITE_CRM_API_URL,
        apiKey: import.meta.env.VITE_CRM_API_KEY || '',
      },
    }),
    ...(import.meta.env.VITE_WEB_SEARCH_API_KEY && {
      webSearch: {
        enabled: true,
        provider: (import.meta.env.VITE_WEB_SEARCH_PROVIDER as 'serpapi' | 'google' | 'bing') || 'serpapi',
        apiKey: import.meta.env.VITE_WEB_SEARCH_API_KEY,
      },
    }),
  };
};

// Validation function to check which APIs are properly configured
export const validateAPIConfig = (): { configured: string[]; missing: string[] } => {
  const config = getAPIConfig();
  const configured: string[] = [];
  const missing: string[] = [];

  if (config.openai.apiKey) configured.push('OpenAI GPT');
  else missing.push('OpenAI GPT');

  if (config.gemini.apiKey) configured.push('Gemini AI');
  else missing.push('Gemini AI');

  if (config.supabase.url && config.supabase.anonKey) configured.push('Supabase');
  else missing.push('Supabase');

  if (config.sendgrid.apiKey) configured.push('SendGrid');
  else missing.push('SendGrid');

  if (config.crm?.apiKey) configured.push('CRM API');
  else missing.push('CRM API');

  return { configured, missing };
};

// Helper to check if production APIs should be used.
// AI features require their own provider key; Supabase connectivity is handled separately.
export const shouldUseRealAPIs = (): boolean => {
  const config = getAPIConfig();
  return !!(config.openai.apiKey || config.gemini.apiKey);
};

export default getAPIConfig;