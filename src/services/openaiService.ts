import { Contact, AIContactAnalysis } from '../types/contact';
import { useRealOpenAI } from './realOpenAIService';

export interface OpenAIService {
  analyzeContact: (contact: Contact, modelId?: string) => Promise<AIContactAnalysis>;
  generateEmail: (contact: Contact, context?: string, modelId?: string) => Promise<string>;
  getInsights: (contact: Contact, modelId?: string) => Promise<string[]>;
  generateDealSummary: (dealData: any, modelId?: string) => Promise<string>;
  suggestNextActions: (dealData: any, modelId?: string) => Promise<string[]>;
}

/**
 * Returns the OpenAI-backed service. Requests go through the server-side
 * Responses API gateway (netlify/functions/ai-gateway.ts); there is no mock fallback.
 */
export const useOpenAI = (): OpenAIService => useRealOpenAI();
