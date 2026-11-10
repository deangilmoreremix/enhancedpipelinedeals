/**
 * AI Gateway Service - thin compatibility layer over the server-side Responses API gateway
 * (netlify/functions/ai-gateway.ts). Keeps the legacy request/response shapes used by
 * older callers, but everything goes through `callAI` (OpenAI Responses API on the server).
 */
import { callAI, AIGatewayError } from './aiClient';

export interface AIGatewayRequest {
  provider: 'openai';
  model: string;
  taskType: string;
  aiRequestData: any;
}

export interface AIGatewayResponse {
  error?: string;
  fallbackMode?: boolean;
  provider?: string;
  status?: number;
  text?: string;
  output_text?: string;
  data?: any;
  /** Compatibility shim for parsers that still read choices[0].message.content. */
  choices?: Array<{ message: { role: 'assistant'; content: string } }>;
  [key: string]: any;
}

/** Map any legacy model hint to a tier; the server owns concrete model ids. */
function tierFor(model?: string): 'fast' | 'default' | 'deep' {
  if (!model) return 'default';
  if (/mini|nano|luna|flash|fast/i.test(model)) return 'fast';
  if (/astra|pro|deep|thinking/i.test(model)) return 'deep';
  return 'default';
}

class AIGatewayService {
  async makeRequest(request: AIGatewayRequest): Promise<AIGatewayResponse> {
    try {
      const d = request.aiRequestData || {};
      let messages: Array<{ role: string; content: string }> | undefined = d.messages;
      if (!messages && Array.isArray(d.contents)) {
        messages = [{ role: 'user', content: d.contents.map((c: any) => c.parts?.map((p: any) => p.text).join('')).join('\n') }];
      }
      const task = request.taskType && /^[a-z_]+$/.test(request.taskType) ? request.taskType : 'chat';
      const result = await callAI(task, {
        messages,
        tier: tierFor(request.model),
        maxOutputTokens: d.max_output_tokens || d.max_completion_tokens || d.generationConfig?.maxOutputTokens,
      });
      return {
        provider: 'openai',
        model: result.model,
        text: result.text,
        output_text: result.text,
        data: result.data,
        choices: [{ message: { role: 'assistant', content: result.text } }],
      };
    } catch (error: any) {
      const status = error instanceof AIGatewayError ? error.status : undefined;
      console.error('AI Gateway error:', error);
      return { error: `Failed to communicate with AI gateway: ${error?.message}`, fallbackMode: true, status };
    }
  }

  /** Build a request for the gateway (messages are sent as Responses `input`). */
  createOpenAIRequest(
    messages: Array<{ role: string; content: string }>,
    model: string = 'default',
    taskType: string = 'chat',
    options: any = {}
  ): AIGatewayRequest {
    const { maxTokens, ...rest } = options;
    return {
      provider: 'openai',
      model,
      taskType,
      aiRequestData: { messages, max_output_tokens: maxTokens || 1000, ...rest },
    };
  }

  /** Real health check: tiny `fast` request through the gateway. */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; providers: string[]; error?: string }> {
    try {
      await callAI('chat', { input: 'ping', tier: 'fast', maxOutputTokens: 16 });
      return { status: 'healthy', providers: ['openai'] };
    } catch (error: any) {
      const status = error instanceof AIGatewayError ? error.status : undefined;
      if (status === 401) return { status: 'down', providers: [], error: 'Gateway rejected credentials (401)' };
      return { status: 'degraded', providers: [], error: error?.message || 'Gateway unavailable' };
    }
  }
}

export { AIGatewayService };

let aiGatewayService: AIGatewayService | null = null;

export const getAIGatewayService = (): AIGatewayService => {
  if (!aiGatewayService) aiGatewayService = new AIGatewayService();
  return aiGatewayService;
};
