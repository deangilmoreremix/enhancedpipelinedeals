/**
 * OpenAI Agents SDK Integration Service
 * Provides full agent lifecycle management and orchestration
 */

import { callAI } from './aiClient';
import { supabase } from '../lib/core/supabaseClient';
import { getModelById } from '../config/aiModels';

interface AgentConfig {
  id: string;
  name: string;
  instructions: string;
  tools: any[];
  model?: string;
  temperature?: number;
}

interface AgentThread {
  id: string;
  agentId: string;
  contactId: string;
  status: 'active' | 'completed' | 'failed';
  messages: any[];
  metadata: Record<string, any>;
}

class OpenAIAgentsService {
  private agents = new Map<string, AgentConfig>();
  private threads = new Map<string, AgentThread>();

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents() {
    // SDR Agents
    this.agents.set('cold_email_sdr', {
      id: 'cold_email_sdr',
      name: 'Cold Email SDR',
      instructions: `You are an expert cold email SDR. Your goal is to send compelling first-touch emails that:
      - Grab attention in the first 3 seconds
      - Clearly state the value proposition
      - Include social proof or data
      - End with a clear, low-pressure call-to-action
      - Personalize based on company research
      - Keep under 100 words`,
      tools: ['web_search', 'company_research'],
      model: 'gpt-6.1-sol',
      temperature: 0.7
    });

    this.agents.set('followup_sdr', {
      id: 'followup_sdr',
      name: 'Follow-Up SDR',
      instructions: `You are a follow-up SDR specialist. Your role is to:
      - Reference previous conversations or emails
      - Provide additional value or insights
      - Address specific pain points mentioned
      - Create urgency without pressure
      - Suggest next steps in the buying process
      - Personalize based on interaction history`,
      tools: ['crm_lookup', 'sequence_analysis'],
      model: 'gpt-6.1-sol',
      temperature: 0.6
    });

    // AE Agents
    this.agents.set('account_executive', {
      id: 'account_executive',
      name: 'Account Executive',
      instructions: `You are an experienced Account Executive handling qualified opportunities. Your focus is:
      - Building deep relationships with decision makers
      - Understanding complex buying processes
      - Negotiating terms and pricing
      - Coordinating with internal stakeholders
      - Managing contract and closing processes
      - Providing strategic consultation`,
      tools: ['contract_analysis', 'stakeholder_mapping', 'pricing_optimizer'],
      model: 'gpt-6.1-sol',
      temperature: 0.5
    });
  }

  async createThread(agentId: string, contactId: string, initialContext: any): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const thread: AgentThread = {
      id: threadId,
      agentId,
      contactId,
      status: 'active',
      messages: [{
        role: 'system',
        content: agent.instructions,
        timestamp: new Date().toISOString()
      }],
      metadata: {
        createdAt: new Date().toISOString(),
        initialContext,
        agentConfig: agent
      }
    };

    this.threads.set(threadId, thread);
    return threadId;
  }

  async runAgent(threadId: string, userMessage: string, context: any = {}): Promise<any> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    const agent = this.agents.get(thread.agentId);
    if (!agent) throw new Error(`Agent ${thread.agentId} not found`);

    try {
      // Add user message to thread
      thread.messages.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
        context
      });

      // Instructions (+ CRM context); Responses API takes system guidance as `instructions`
      let instructions = agent.instructions;
      if (context.contact || context.company || context.deal) {
        instructions += `\n\nCONTEXT:\n${this.buildContextString(context)}`;
      }

      const tier = (agent.model && getModelById(agent.model)?.tier) || 'default';
      const tools = this.getAgentTools(agent.tools);
      const history = thread.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      // First turn, then a tool loop continued with previous_response_id + function_call_output items
      let response = await callAI('chat', {
        instructions,
        input: history,
        tools: tools.length ? tools : undefined,
        toolChoice: tools.length ? 'auto' : undefined,
        tier,
        maxOutputTokens: 1500,
        store: true,
      });

      for (let turn = 0; turn < 4 && response.tool_calls?.length; turn++) {
        const outputs = await this.executeTools(response.tool_calls, context);
        thread.messages.push({
          role: 'tool',
          content: JSON.stringify(outputs.map(o => ({ name: o.name, result: o.result }))),
          timestamp: new Date().toISOString()
        });
        response = await callAI('chat', {
          instructions,
          input: outputs.map(o => ({ type: 'function_call_output', call_id: o.call_id, output: JSON.stringify(o.result) })),
          previousResponseId: response.id,
          tools: tools.length ? tools : undefined,
          tier,
          maxOutputTokens: 1500,
        });
      }

      thread.messages.push({
        role: 'assistant',
        content: response.text || '',
        timestamp: new Date().toISOString()
      });

      return {
        threadId,
        response: thread.messages[thread.messages.length - 1].content,
        status: 'completed',
        metadata: thread.metadata
      };

    } catch (error) {
      console.error('Agent execution failed:', error);
      thread.status = 'failed';
      throw error;
    }
  }

  private buildContextString(context: any): string {
    let contextStr = '';

    if (context.contact) {
      contextStr += `Contact: ${context.contact.name} at ${context.contact.company}\n`;
      contextStr += `Title: ${context.contact.title || 'Unknown'}\n`;
      contextStr += `Industry: ${context.contact.industry || 'Unknown'}\n`;
    }

    if (context.deal) {
      contextStr += `Deal: ${context.deal.title}\n`;
      contextStr += `Value: $${context.deal.value?.toLocaleString()}\n`;
      contextStr += `Stage: ${context.deal.stage}\n`;
      contextStr += `Probability: ${context.deal.probability}%\n`;
    }

    if (context.company) {
      contextStr += `Company: ${context.company.name}\n`;
      contextStr += `Size: ${context.company.size || 'Unknown'}\n`;
      contextStr += `Industry: ${context.company.industry || 'Unknown'}\n`;
    }

    return contextStr;
  }

  private getAgentTools(toolNames: string[]): any[] {
    const tools = [];

    for (const toolName of toolNames) {
      switch (toolName) {
        case 'web_search':
          tools.push({
            type: 'function',
            name: 'web_search',
            description: 'Search the web for company or industry information',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                type: { type: 'string', enum: ['company', 'industry', 'news'] }
              },
              required: ['query']
            }
          });
          break;

        case 'crm_lookup':
          tools.push({
            type: 'function',
            name: 'crm_lookup',
            description: 'Look up contact or deal information from CRM',
            parameters: {
              type: 'object',
              properties: {
                entityType: { type: 'string', enum: ['contact', 'deal', 'company'] },
                entityId: { type: 'string' },
                fields: { type: 'array', items: { type: 'string' } }
              },
              required: ['entityType', 'entityId']
            }
          });
          break;

        case 'contract_analysis':
          tools.push({
            type: 'function',
            name: 'contract_analysis',
            description: 'Analyze contract terms and requirements',
            parameters: {
              type: 'object',
              properties: {
                dealValue: { type: 'number' },
                contractType: { type: 'string' },
                specialTerms: { type: 'array', items: { type: 'string' } }
              },
              required: ['dealValue']
            }
          });
          break;
      }
    }

    return tools;
  }

  private async executeTools(
    toolCalls: Array<{ call_id: string; name: string; arguments: any }>,
    _context: any
  ): Promise<Array<{ call_id: string; name: string; result: any }>> {
    const outputs: Array<{ call_id: string; name: string; result: any }> = [];

    for (const call of toolCalls) {
      const args = call.arguments || {};
      let result: any;
      try {
        switch (call.name) {
          case 'web_search':
            result = await this.performWebSearch(args.query, args.type);
            break;
          case 'crm_lookup':
            result = await this.performCRMLookup(args.entityType, args.entityId, args.fields);
            break;
          case 'contract_analysis':
            result = await this.performContractAnalysis(args);
            break;
          default:
            result = { error: `Unknown tool: ${call.name}` };
        }
      } catch (error) {
        result = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
      outputs.push({ call_id: call.call_id, name: call.name, result });
    }

    return outputs;
  }

  /** Real web search via the Responses API hosted `web_search` tool (server-side). */
  private async performWebSearch(query: string, type?: string): Promise<any> {
    const r = await callAI('chat', {
      instructions: 'Search the web and answer with concise, sourced findings (include source URLs).',
      input: `${type ? `[${type}] ` : ''}${query}`,
      tools: [{ type: 'web_search' }],
      tier: 'fast',
      maxOutputTokens: 1200,
    });
    return { query, type, summary: r.text };
  }

  private async performCRMLookup(entityType: string, entityId: string, fields?: string[]): Promise<any> {
    const table = ({ contact: 'contacts', deal: 'deals', company: 'companies' } as Record<string, string>)[entityType];
    if (!table) return { error: `Unsupported entity type: ${entityType}` };
    const columns = fields?.length ? fields.filter(f => /^[a-z_]+$/.test(f)).join(',') || '*' : '*';
    const { data, error } = await supabase.from(table).select(columns).eq('id', entityId).maybeSingle();
    if (error) return { error: error.message };
    return data ? { entityType, entityId, data } : { entityType, entityId, error: 'Not found' };
  }

  private async performContractAnalysis(args: any): Promise<any> {
    const r = await callAI('chat', {
      instructions: 'You are a contracts analyst for B2B sales. Respond with a single JSON object: {"recommendedTerms": string[], "riskAssessment": string, "negotiationPoints": string[]}.',
      input: JSON.stringify(args),
      json: true,
      tier: 'default',
      maxOutputTokens: 1200,
    } as any);
    return { dealValue: args.dealValue, ...(r.data ?? { error: 'Analysis unavailable' }) };
  }

  getAgent(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values());
  }

  getThread(threadId: string): AgentThread | undefined {
    return this.threads.get(threadId);
  }

  getActiveThreads(): AgentThread[] {
    return Array.from(this.threads.values()).filter(thread => thread.status === 'active');
  }
}

// Singleton instance
let openAIAgentsService: OpenAIAgentsService | null = null;

export const getOpenAIAgentsService = (): OpenAIAgentsService => {
  if (!openAIAgentsService) {
    openAIAgentsService = new OpenAIAgentsService();
  }
  return openAIAgentsService;
};

export { OpenAIAgentsService };
export type { AgentConfig, AgentThread };