export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'gemini' | 'gemma';
  family: string;
  contextWindow: number;
  maxTokens: number;
  pricing?: {
    input: number;
    output: number;
  };
  capabilities: string[];
  isActive: boolean;
  endpoint?: string;
}

export const AI_MODELS: AIModel[] = [
  // OpenAI Models - Updated with ChatGPT-5 models
  {
    id: 'gpt-4o',
    name: 'GPT-5',
    provider: 'openai',
    family: 'GPT-5',
    contextWindow: 256000,
    maxTokens: 8192,
    pricing: {
      input: 0.005,
      output: 0.015
    },
    capabilities: ['text-generation', 'analysis', 'reasoning', 'creative-writing', 'advanced-problem-solving', 'multimodal', 'complex-reasoning'],
    isActive: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    family: 'GPT-5',
    contextWindow: 128000,
    maxTokens: 4096,
    pricing: {
      input: 0.0003,
      output: 0.0012
    },
    capabilities: ['text-generation', 'analysis', 'reasoning'],
    isActive: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-5 Nano',
    provider: 'openai',
    family: 'GPT-5',
    contextWindow: 8192,
    maxTokens: 4096,
    pricing: {
      input: 0.00005,
      output: 0.0002
    },
    capabilities: ['text-generation', 'basic-analysis'],
    isActive: true
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    family: 'GPT-4',
    contextWindow: 128000,
    maxTokens: 4096,
    pricing: {
      input: 0.0025,
      output: 0.01
    },
    capabilities: ['text-generation', 'analysis', 'reasoning', 'creative-writing'],
    isActive: true
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    family: 'GPT-4',
    contextWindow: 128000,
    maxTokens: 16384,
    pricing: {
      input: 0.00015,
      output: 0.0006
    },
    capabilities: ['text-generation', 'analysis', 'reasoning'],
    isActive: true
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    family: 'GPT-3.5',
    contextWindow: 16385,
    maxTokens: 4096,
    pricing: {
      input: 0.0005,
      output: 0.0015
    },
    capabilities: ['text-generation', 'analysis'],
    isActive: true
  },

  // Gemini Models
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash Experimental',
    provider: 'gemini',
    family: 'Gemini 2.0',
    contextWindow: 1000000,
    maxTokens: 8192,
    capabilities: ['text-generation', 'analysis', 'reasoning', 'multimodal'],
    isActive: true,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    family: 'Gemini 1.5',
    contextWindow: 1000000,
    maxTokens: 8192,
    capabilities: ['text-generation', 'analysis', 'reasoning', 'multimodal'],
    isActive: true,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    family: 'Gemini 1.5',
    contextWindow: 2000000,
    maxTokens: 8192,
    capabilities: ['text-generation', 'analysis', 'reasoning', 'multimodal', 'complex-reasoning'],
    isActive: true,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent'
  },

];

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find(model => model.id === id);
}

export function getModelsByProvider(provider: 'openai' | 'gemini' | 'gemma'): AIModel[] {
  return AI_MODELS.filter(model => model.provider === provider && model.isActive);
}

export function getModelsByCapability(capability: string): AIModel[] {
  return AI_MODELS.filter(model => model.capabilities.includes(capability) && model.isActive);
}

export function getActiveModels(): AIModel[] {
  return AI_MODELS.filter(model => model.isActive);
}

// Task-specific model recommendations - OpenAI only
export const TASK_MODEL_MAPPING = {
  'contact-analysis': ['gpt-4o', 'gpt-4o-mini'],
  'email-generation': ['gpt-4o', 'gpt-4o-mini'],
  'company-research': ['gpt-4o', 'gpt-4o-mini'],
  'deal-summary': ['gpt-4o', 'gpt-4o-mini'],
  'next-actions': ['gpt-4o-mini', 'gpt-4o'],
  'insights': ['gpt-4o', 'gpt-4o-mini'],
  'contact-research': ['gpt-4o-mini', 'gpt-4o'],
  'social-media-discovery': ['gpt-4o-mini', 'gpt-4o'],
  'app-enrichment': ['gpt-4o', 'gpt-4o-mini'],
  'channel-identification': ['gpt-4o-mini', 'gpt-4o'],
  'sales-coaching': ['gpt-4o', 'gpt-4o-mini'],
  'objection-handling': ['gpt-4o', 'gpt-4o-mini'],
  'dynamic-recommendations': ['gpt-4o-mini', 'gpt-4o'],
  'real-time-coaching': ['gpt-4o', 'gpt-4o-mini'],
  'conversation-analysis': ['gpt-4o', 'gpt-4o-mini']
} as const;

export function getRecommendedModelForTask(task: keyof typeof TASK_MODEL_MAPPING): AIModel[] {
  const recommendedIds = TASK_MODEL_MAPPING[task];
  return recommendedIds.map(id => getModelById(id)).filter(Boolean) as AIModel[];
}