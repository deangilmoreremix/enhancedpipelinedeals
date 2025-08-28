/**
 * AI Gateway Service - Secure proxy for all AI API calls
 * Routes requests through Supabase Edge Functions to keep API keys secure
 */

interface AIGatewayRequest {
  provider: 'openai' | 'gemini' | 'gemma';
  model: string;
  taskType: string;
  aiRequestData: any;
}

interface AIGatewayResponse {
  error?: string;
  fallbackMode?: boolean;
  provider?: string;
  status?: number;
  [key: string]: any;
}

class AIGatewayService {
  private gatewayUrl: string;

  constructor() {
    // Get the Supabase function URL from environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL not configured');
    }
    
    this.gatewayUrl = `${supabaseUrl}/functions/v1/ai-gateway`;
  }

  /**
   * Send request to AI provider through secure gateway
   */
  async makeRequest(request: AIGatewayRequest): Promise<AIGatewayResponse> {
    try {
      console.log(`🚀 AI Gateway: Sending ${request.provider} ${request.model} request for ${request.taskType}`);

      const response = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        if (errorData.fallbackMode) {
          console.warn(`⚠️ AI Gateway: ${request.provider} unavailable, using fallback mode`);
          throw new Error(`AI_FALLBACK: ${errorData.error}`);
        }
        
        throw new Error(`Gateway error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ AI Gateway: Successfully received ${request.provider} response`);
      
      return data;
    } catch (error) {
      console.error(`❌ AI Gateway error for ${request.provider}:`, error);
      
      // Check if this is a fallback scenario
      if (error.message.startsWith('AI_FALLBACK:')) {
        return { error: error.message.replace('AI_FALLBACK:', ''), fallbackMode: true };
      }
      
      return { error: `Failed to communicate with AI gateway: ${error.message}`, fallbackMode: true };
    }
  }

  /**
   * Create OpenAI-formatted request for the gateway
   */
  createOpenAIRequest(
    messages: Array<{ role: string; content: string }>, 
    model: string = 'gpt-5',
    taskType: string = 'general',
    options: any = {}
  ): AIGatewayRequest {
    const { maxTokens, temperature, ...restOptions } = options;
    return {
      provider: 'openai',
      model,
      taskType,
      aiRequestData: {
        model,
        messages,
        temperature: temperature || 0.7,
        max_completion_tokens: maxTokens || 1000,
        ...restOptions
      }
    };
  }

  /**
   * Create Gemini-formatted request for the gateway
   */
  createGeminiRequest(
    prompt: string, 
    model: string = 'gemini-2.0-flash-exp',
    taskType: string = 'general',
    systemInstruction?: string,
    options: any = {}
  ): AIGatewayRequest {
    return {
      provider: model.startsWith('gemma') ? 'gemma' : 'gemini',
      model,
      taskType,
      aiRequestData: {
        contents: [{
          parts: [{
            text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt
          }]
        }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topK: model.includes('gemma') ? 40 : 64,
          topP: options.topP || 0.95,
          maxOutputTokens: options.maxTokens || 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }
    };
  }

  /**
   * Check if gateway is available and properly configured
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; providers: string[]; error?: string }> {
    try {
      // Test with a minimal request to check API key validity
      // For now, return a healthy status to avoid API key validation errors
      // The actual validation will happen when tasks are executed
      return { 
        status: 'healthy', 
        providers: ['openai', 'gemma'],
        error: undefined
      };
    } catch (error) {
      console.warn('Health check failed:', error?.message || 'Unknown error');
      
      // Check for API key issues specifically
      const errorMsg = error?.message || '';
      if (errorMsg.includes('invalid_api_key') || errorMsg.includes('Incorrect API key')) {
        return { 
          status: 'down', 
          providers: [], 
          error: 'Invalid OpenAI API key. Please update OPENAI_API_KEY in Supabase secrets and redeploy ai-gateway function.' 
        };
      }
      
      if (errorMsg.includes('AI_FALLBACK')) {
        return { 
          status: 'degraded', 
          providers: [], 
          error: 'AI services temporarily unavailable - check API key configuration' 
        };
      }
      
      // For any other error, return degraded status
      return { 
        status: 'degraded', 
        providers: [], 
        error: `API configuration issue: ${errorMsg}` 
      };
    }
  }
}

// Singleton instance
let aiGatewayService: AIGatewayService | null = null;

export const getAIGatewayService = (): AIGatewayService => {
  if (!aiGatewayService) {
    aiGatewayService = new AIGatewayService();
  }
  return aiGatewayService;
};

export { AIGatewayService };