export interface AIModel {
  id: string;
  name: string;
  provider: 'openai';
  family: string;
  /** Gateway tier this model backs (see netlify/functions/_openai.ts). */
  tier: 'fast' | 'default' | 'deep';
  /** Output-token cap used for requests (not a limit of the model). */
  maxTokens: number;
  capabilities: string[];
  isActive: boolean;
}

// OpenAI GPT-6 family, served through the Responses API.
export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-6-astra',
    name: 'GPT-6 Astra',
    provider: 'openai',
    family: 'GPT-6',
    tier: 'deep',
    maxTokens: 8192,
    capabilities: ['text-generation', 'analysis', 'reasoning', 'complex-reasoning', 'advanced-problem-solving', 'multimodal'],
    isActive: true,
  },
  {
    id: 'gpt-6.1-sol',
    name: 'GPT-6.1 Sol',
    provider: 'openai',
    family: 'GPT-6',
    tier: 'default',
    maxTokens: 4096,
    capabilities: ['text-generation', 'analysis', 'reasoning', 'creative-writing'],
    isActive: true,
  },
  {
    id: 'gpt-6.1-terra',
    name: 'GPT-6.1 Terra',
    provider: 'openai',
    family: 'GPT-6',
    tier: 'fast',
    maxTokens: 4096,
    capabilities: ['text-generation', 'analysis', 'multimodal', 'writing'],
    isActive: true,
  },
  {
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    provider: 'openai',
    family: 'GPT-6',
    tier: 'fast',
    maxTokens: 2048,
    capabilities: ['text-generation', 'basic-analysis'],
    isActive: true,
  },
];

export const DEFAULT_MODEL_ID = 'gpt-6.1-sol';

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find(model => model.id === id);
}

export function getModelsByProvider(provider: 'openai'): AIModel[] {
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
  'contact-analysis': ['gpt-6.1-sol', 'gpt-6-luna'],
  'email-generation': ['gpt-6.1-sol', 'gpt-6-luna'],
  'company-research': ['gpt-6.1-sol', 'gpt-6-luna'],
  'deal-summary': ['gpt-6.1-sol', 'gpt-6-luna'],
  'next-actions': ['gpt-6-luna', 'gpt-6.1-sol'],
  'insights': ['gpt-6.1-sol', 'gpt-6-luna'],
  'contact-research': ['gpt-6-luna', 'gpt-6.1-sol'],
  'social-media-discovery': ['gpt-6-luna', 'gpt-6.1-sol'],
  'app-enrichment': ['gpt-6.1-sol', 'gpt-6-luna'],
  'channel-identification': ['gpt-6-luna', 'gpt-6.1-sol'],
  'sales-coaching': ['gpt-6.1-sol', 'gpt-6-luna'],
  'objection-handling': ['gpt-6.1-sol', 'gpt-6-luna'],
  'dynamic-recommendations': ['gpt-6-luna', 'gpt-6.1-sol'],
  'real-time-coaching': ['gpt-6.1-sol', 'gpt-6-luna'],
  'conversation-analysis': ['gpt-6.1-sol', 'gpt-6-luna']
} as const;

export function getRecommendedModelForTask(task: keyof typeof TASK_MODEL_MAPPING): AIModel[] {
  const recommendedIds = TASK_MODEL_MAPPING[task];
  return recommendedIds.map(id => getModelById(id)).filter(Boolean) as AIModel[];
}