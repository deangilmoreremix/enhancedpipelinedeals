/**
 * OpenAI Agents SDK Integration Service
 * Provides full agent lifecycle management and orchestration
 */

import OpenAI from 'openai';

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
  private openai: OpenAI;
  private agents = new Map<string, AgentConfig>();
  private threads = new Map<string, AgentThread>();

  constructor() {
    this.openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    });

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
      model: 'gpt-4o',
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
      model: 'gpt-4o',
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
      model: 'gpt-4o',
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

      // Prepare messages for OpenAI
      const messages = thread.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add context to system message
      if (context.contact || context.company || context.deal) {
        const contextStr = this.buildContextString(context);
        messages[0].content += `\n\nCONTEXT:\n${contextStr}`;
      }

      const completion = await this.openai.chat.completions.create({
        model: agent.model || 'gpt-4o',
        messages,
        temperature: agent.temperature || 0.7,
        max_tokens: 1000,
        tools: this.getAgentTools(agent.tools)
      });

      const assistantMessage = completion.choices[0].message;

      // Add assistant response to thread
      thread.messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        timestamp: new Date().toISOString(),
        toolCalls: assistantMessage.tool_calls
      });

      // Handle tool calls if any
      if (assistantMessage.tool_calls) {
        const toolResults = await this.executeTools(assistantMessage.tool_calls, context);
        thread.messages.push({
          role: 'tool',
          content: JSON.stringify(toolResults),
          timestamp: new Date().toISOString()
        });

        // Get final response after tool execution
        const finalCompletion = await this.openai.chat.completions.create({
          model: agent.model || 'gpt-4o',
          messages: thread.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: agent.temperature || 0.7,
          max_tokens: 500
        });

        thread.messages.push({
          role: 'assistant',
          content: finalCompletion.choices[0].message.content || '',
          timestamp: new Date().toISOString()
        });
      }

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
            function: {
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
            }
          });
          break;

        case 'crm_lookup':
          tools.push({
            type: 'function',
            function: {
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
            }
          });
          break;

        case 'contract_analysis':
          tools.push({
            type: 'function',
            function: {
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
            }
          });
          break;
      }
    }

    return tools;
  }

  private async executeTools(toolCalls: any[], context: any): Promise<any> {
    const results = {};

    for (const toolCall of toolCalls) {
      const { name, arguments: args } = toolCall.function;

      try {
        switch (name) {
          case 'web_search':
            const searchArgs = JSON.parse(args);
            results[name] = await this.performWebSearch(searchArgs.query, searchArgs.type);
            break;

          case 'crm_lookup':
            const lookupArgs = JSON.parse(args);
            results[name] = await this.performCRMLookup(lookupArgs.entityType, lookupArgs.entityId, lookupArgs.fields);
            break;

          case 'contract_analysis':
            const contractArgs = JSON.parse(args);
            results[name] = await this.performContractAnalysis(contractArgs);
            break;

          default:
            results[name] = { error: `Unknown tool: ${name}` };
        }
      } catch (error) {
        results[name] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return results;
  }

  private async performWebSearch(query: string, type: string): Promise<any> {
    // Placeholder - integrate with web search service
    return {
      query,
      type,
      results: [
        {
          title: `Search result for ${query}`,
          snippet: `Relevant information about ${query} in ${type} context`,
          url: `https://example.com/search/${query}`,
          credibility: 85
        }
      ]
    };
  }

  private async performCRMLookup(entityType: string, entityId: string, fields: string[]): Promise<any> {
    // Placeholder - integrate with CRM service
    return {
      entityType,
      entityId,
      data: {
        name: 'Sample Entity',
        status: 'active',
        lastActivity: new Date().toISOString()
      }
    };
  }

  private async performContractAnalysis(args: any): Promise<any> {
    // Placeholder - implement contract analysis logic
    return {
      dealValue: args.dealValue,
      recommendedTerms: ['Standard SLA', '30-day payment terms', 'Annual renewal'],
      riskAssessment: 'Low',
      negotiationPoints: ['Volume discount consideration', 'Implementation timeline']
    };
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