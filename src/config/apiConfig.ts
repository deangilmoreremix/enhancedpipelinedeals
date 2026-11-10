/**
 * Client-side configuration. The stack is Netlify + Supabase + OpenAI only:
 * - OpenAI is called server-side (Netlify functions); the key never reaches the browser.
 * - Supabase URL / anon key are the only public credentials.
 */
interface APIConfiguration {
  openai: {
    /** Browser requests go to the Netlify AI gateway, not api.openai.com. */
    gatewayUrl: string;
    /** Gateway tiers; concrete model ids are configured server-side (OPENAI_MODEL_*). */
    tiers: { fast: string; default: string; deep: string };
  };
  supabase: {
    url: string;
    anonKey: string;
  };
}

export const getAPIConfig = (): APIConfiguration => ({
  openai: {
    gatewayUrl: import.meta.env.VITE_AI_GATEWAY_URL || '/.netlify/functions/ai-gateway',
    tiers: { fast: 'gpt-6-luna', default: 'gpt-6.1-sol', deep: 'gpt-6-astra' },
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
});

/** Which client-visible services are configured. (The OpenAI key is verified by the gateway health check.) */
export const validateAPIConfig = (): { configured: string[]; missing: string[] } => {
  const config = getAPIConfig();
  const configured: string[] = [];
  const missing: string[] = [];
  if (config.supabase.url && config.supabase.anonKey) configured.push('Supabase');
  else missing.push('Supabase');
  return { configured, missing };
};

/** AI always goes through the gateway; whether it is usable is decided by the server. */
export const shouldUseRealAPIs = (): boolean => true;

export default getAPIConfig;
