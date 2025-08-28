interface APIConfiguration {
  openai: {
    apiKey: string;
    model: string;
    baseUrl: string;
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
      model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-5',
      baseUrl: 'https://api.openai.com/v1',
    },
    gemini: {
      apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
      model: import.meta.env.VITE_GEMINI_MODEL || 'gemma-2-27b-it',
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

// Helper to check if production APIs should be used
export const shouldUseRealAPIs = (): boolean => {
  const config = getAPIConfig();
  return !!(config.openai.apiKey || config.gemma.apiKey || config.supabase.url);
};

export default getAPIConfig;