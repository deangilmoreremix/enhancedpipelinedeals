/**
 * AI Agent Framework Service
 * Core infrastructure for managing AI agents that operate the CRM
 */

import {
  AIAgent,
  AgentType,
  AgentStatus,
  AgentPermissions,
  AgentPersonality,
  AgentCapability,
  AgentConfiguration,
  AgentMetrics,
  AgentMemory,
  AgentExecutionContext,
  TriggerEvent,
  AgentActionResult,
  AgentAction,
  ConversationContext,
  ConversationMessage,
  AgentAPIResponse,
  AgentStatusResponse,
  AgentChatResponse,
  AgentHistoryResponse,
  AgentWebSocketEvent,
  AgentLearningData,
  AgentError,
  AgentAuditLog,
  PermissionLevel,
  TriggerType
} from '../types/agent';

class AgentFramework {
  private agents = new Map<string, AIAgent>();
  private activeExecutions = new Map<string, Promise<AgentActionResult>>();
  private conversationContexts = new Map<string, ConversationContext>();
  private auditLogs: AgentAuditLog[] = [];
  private errors: AgentError[] = [];

  constructor() {
    this.initializeDefaultAgents();
  }

  // ============================================================================
  // AGENT MANAGEMENT
  // ============================================================================

  async createAgent(config: Partial<AIAgent>): Promise<AIAgent> {
    const agent: AIAgent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: config.name || 'New Agent',
      type: config.type || AgentType.SALES_ASSISTANT,
      description: config.description || '',
      capabilities: config.capabilities || [],
      personality: config.personality || this.getDefaultPersonality(),
      permissions: config.permissions || this.getDefaultPermissions(),
      configuration: config.configuration || this.getDefaultConfiguration(),
      status: AgentStatus.INACTIVE,
      metrics: this.getDefaultMetrics(),
      memory: this.getDefaultMemory(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      creatorId: config.creatorId || 'system',
      ...config
    };

    this.agents.set(agent.id, agent);
    await this.saveAgentToStorage(agent);

    this.logAudit({
      id: `audit_${Date.now()}`,
      agentId: agent.id,
      userId: agent.creatorId,
      action: 'agent_created',
      parameters: { agentType: agent.type, agentName: agent.name },
      result: 'success',
      timestamp: new Date()
    });

    return agent;
  }

  async getAgent(agentId: string): Promise<AIAgent | null> {
    return this.agents.get(agentId) || null;
  }

  async updateAgent(agentId: string, updates: Partial<AIAgent>): Promise<AIAgent | null> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    const updatedAgent = {
      ...agent,
      ...updates,
      updatedAt: new Date()
    };

    this.agents.set(agentId, updatedAgent);
    await this.saveAgentToStorage(updatedAgent);

    return updatedAgent;
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.agents.delete(agentId);
    await this.deleteAgentFromStorage(agentId);

    // Clean up conversations
    for (const [convId, context] of this.conversationContexts.entries()) {
      if (context.agentId === agentId) {
        this.conversationContexts.delete(convId);
      }
    }

    return true;
  }

  async listAgents(type?: AgentType): Promise<AIAgent[]> {
    const agents = Array.from(this.agents.values());
    return type ? agents.filter(agent => agent.type === type) : agents;
  }

  // ============================================================================
  // AGENT EXECUTION
  // ============================================================================

  async executeAgentAction(
    agentId: string,
    context: AgentExecutionContext
  ): Promise<AgentActionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Validate permissions
    if (!this.validatePermissions(agent.permissions, context)) {
      throw new Error('Insufficient permissions for agent action');
    }

    // Check rate limits
    if (!this.checkRateLimits(agent, context)) {
      throw new Error('Rate limit exceeded');
    }

    // Update agent status
    agent.status = AgentStatus.ACTIVE;
    agent.metrics.lastActive = new Date();

    const executionId = `${agentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const executionPromise = this.performAgentExecution(agent, context, executionId);

    this.activeExecutions.set(executionId, executionPromise);

    try {
      const result = await executionPromise;

      // Update metrics
      this.updateAgentMetrics(agent, result);

      // Log audit
      this.logAudit({
        id: `audit_${Date.now()}`,
        agentId,
        userId: context.userId,
        action: 'agent_execution',
        entityType: context.trigger.entityType,
        entityId: context.trigger.entityId,
        parameters: { trigger: context.trigger.type, action: result.action },
        result: result.success ? 'success' : 'failure',
        timestamp: new Date()
      });

      return result;
    } finally {
      this.activeExecutions.delete(executionId);
      agent.status = AgentStatus.ACTIVE; // Keep active unless explicitly stopped
    }
  }

  private async performAgentExecution(
    agent: AIAgent,
    context: AgentExecutionContext,
    executionId: string
  ): Promise<AgentActionResult> {
    const startTime = Date.now();

    try {
      // Get relevant capability for the trigger
      const capability = this.findCapabilityForTrigger(agent, context.trigger);
      if (!capability) {
        return {
          success: false,
          action: 'no_capability_found',
          result: null,
          confidence: 0,
          executionTime: Date.now() - startTime,
          error: 'No suitable capability found for trigger',
          metadata: {}
        };
      }

      // Execute the capability function
      const result = await this.executeCapability(capability, context);

      return {
        success: result.success,
        action: capability.functionName,
        result: result.data,
        confidence: result.confidence || 0.8,
        executionTime: Date.now() - startTime,
        cost: result.metadata?.cost,
        tokens: result.metadata?.tokens,
        error: result.error,
        suggestions: result.suggestions,
        nextActions: result.nextActions,
        metadata: result.metadata || {}
      };

    } catch (error) {
      this.logError({
        id: `error_${Date.now()}`,
        agentId: agent.id,
        errorType: 'execution',
        message: error instanceof Error ? error.message : 'Unknown execution error',
        stack: error instanceof Error ? error.stack : undefined,
        context: { executionId, trigger: context.trigger },
        timestamp: new Date(),
        resolved: false
      });

      return {
        success: false,
        action: 'execution_failed',
        result: null,
        confidence: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Execution failed',
        metadata: {}
      };
    }
  }

  private findCapabilityForTrigger(agent: AIAgent, trigger: TriggerEvent): AgentCapability | null {
    return agent.capabilities.find(capability =>
      capability.triggers.some(triggerCondition =>
        triggerCondition.type === trigger.type
      )
    ) || null;
  }

  private async executeCapability(
    capability: AgentCapability,
    context: AgentExecutionContext
  ): Promise<any> {
    // Import the AI function orchestrator
    const { getAIFunctionOrchestrator } = await import('./aiFunctionOrchestrator');
    const orchestrator = getAIFunctionOrchestrator();

    // Execute the function
    const result = await orchestrator.executeFunction(
      capability.functionName,
      {
        trigger: context.trigger,
        userId: context.userId,
        agentId: context.agentId,
        ...context.trigger.data
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        entityType: context.trigger.entityType,
        entityId: context.trigger.entityId,
        timestamp: Date.now()
      }
    );

    return result;
  }

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  async startConversation(agentId: string, userId: string): Promise<ConversationContext> {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const context: ConversationContext = {
      id: conversationId,
      userId,
      agentId,
      messages: [],
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };

    this.conversationContexts.set(conversationId, context);
    return context;
  }

  async sendMessage(
    conversationId: string,
    message: string,
    userId: string
  ): Promise<AgentChatResponse> {
    const context = this.conversationContexts.get(conversationId);
    if (!context) {
      throw new Error('Conversation not found');
    }

    const agent = this.agents.get(context.agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Add user message
    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    context.messages.push(userMessage);
    context.updatedAt = new Date();

    // Process with AI
    const startTime = Date.now();
    const response = await this.generateAgentResponse(agent, context, message);

    // Add agent response
    const agentMessage: ConversationMessage = {
      id: `msg_${Date.now()}_agent`,
      role: 'agent',
      content: response.response,
      timestamp: new Date(),
      metadata: {
        confidence: response.confidence,
        processingTime: response.processingTime
      }
    };

    context.messages.push(agentMessage);

    return {
      messageId: agentMessage.id,
      agentId: agent.id,
      response: response.response,
      actions: response.actions,
      confidence: response.confidence,
      processingTime: Date.now() - startTime
    };
  }

  private async generateAgentResponse(
    agent: AIAgent,
    context: ConversationContext,
    userMessage: string
  ): Promise<{ response: string; actions?: AgentAction[]; confidence: number; processingTime: number }> {
    const startTime = Date.now();

    try {
      // Use AI to generate response based on agent personality and capabilities
      const { getAIFunctionOrchestrator } = await import('./aiFunctionOrchestrator');
      const orchestrator = getAIFunctionOrchestrator();

      // Create a conversation analysis function call
      const conversationData = {
        messages: context.messages.slice(-10), // Last 10 messages
        agentPersonality: agent.personality,
        agentCapabilities: agent.capabilities.map(c => c.name),
        userMessage,
        context: context.context
      };

      const result = await orchestrator.executeFunction(
        'generate_agent_response',
        conversationData,
        {
          userId: context.userId,
          sessionId: context.id,
          timestamp: Date.now()
        }
      );

      if (result.success) {
        return {
          response: result.data.response || 'I understand. How can I help you further?',
          actions: result.data.actions,
          confidence: result.metadata?.confidence || 0.8,
          processingTime: Date.now() - startTime
        };
      } else {
        return {
          response: "I'm sorry, I'm having trouble processing your request right now. Please try again.",
          confidence: 0.3,
          processingTime: Date.now() - startTime
        };
      }

    } catch (error) {
      console.error('Agent response generation failed:', error);
      return {
        response: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
        confidence: 0.1,
        processingTime: Date.now() - startTime
      };
    }
  }

  async getConversationHistory(conversationId: string): Promise<AgentHistoryResponse | null> {
    const context = this.conversationContexts.get(conversationId);
    if (!context) return null;

    const duration = context.updatedAt.getTime() - context.createdAt.getTime();
    const actionCount = context.messages.filter(m => m.metadata?.actionTaken).length;

    return {
      conversationId,
      messages: context.messages,
      summary: this.generateConversationSummary(context),
      duration,
      actionCount
    };
  }

  private generateConversationSummary(context: ConversationContext): string {
    const messageCount = context.messages.length;
    const userMessages = context.messages.filter(m => m.role === 'user').length;
    const agentMessages = context.messages.filter(m => m.role === 'agent').length;

    return `Conversation with ${messageCount} messages (${userMessages} user, ${agentMessages} agent)`;
  }

  // ============================================================================
  // LEARNING AND ADAPTATION
  // ============================================================================

  async learnFromInteraction(
    agentId: string,
    learningData: AgentLearningData
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Update agent memory with learning data
    this.updateAgentMemory(agent, learningData);

    // Update success metrics
    if (learningData.outcome === 'success') {
      agent.metrics.successfulActions++;
    } else {
      agent.metrics.failedActions++;
    }

    agent.metrics.totalInteractions++;
    agent.metrics.learningProgress = Math.min(100, agent.metrics.learningProgress + 0.1);

    await this.saveAgentToStorage(agent);
  }

  private updateAgentMemory(agent: AIAgent, learningData: AgentLearningData): void {
    // Add to long-term memory if it's a successful pattern
    if (learningData.outcome === 'success' && learningData.confidence && learningData.confidence > 0.8) {
      const pattern: any = {
        id: `pattern_${Date.now()}`,
        pattern: learningData.input,
        confidence: learningData.confidence,
        successfulOutcomes: 1,
        totalOccurrences: 1,
        lastUsed: new Date(),
        category: 'successful_interaction'
      };

      agent.memory.longTerm.push(pattern);
    }

    // Update user preferences if inferred
    if (learningData.context.userPreferences) {
      Object.entries(learningData.context.userPreferences).forEach(([key, value]) => {
        const existing = agent.memory.userPreferences.find(p => p.key === key);
        if (existing) {
          existing.value = value;
          existing.lastUpdated = new Date();
          existing.confidence = Math.min(1, existing.confidence + 0.1);
        } else {
          agent.memory.userPreferences.push({
            key,
            value,
            confidence: 0.5,
            lastUpdated: new Date(),
            source: 'inferred'
          });
        }
      });
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getDefaultPersonality(): AgentPersonality {
    return {
      tone: 'professional',
      communicationStyle: 'conversational',
      initiativeLevel: 'proactive',
      riskTolerance: 'moderate',
      responseLength: 'normal'
    };
  }

  private getDefaultPermissions(): AgentPermissions {
    return {
      level: PermissionLevel.READ_ONLY,
      allowedEntities: ['contacts', 'deals'],
      restrictedActions: ['delete'],
      dataScope: 'owned',
      rateLimits: {
        actionsPerHour: 100,
        apiCallsPerMinute: 10
      },
      allowedTriggers: [TriggerType.MANUAL]
    };
  }

  private getDefaultConfiguration(): AgentConfiguration {
    return {
      autoStart: false,
      workingHours: {
        enabled: false,
        timezone: 'UTC',
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
      },
      notificationPreferences: {
        email: false,
        inApp: true
      },
      performanceTargets: {
        responseTime: 3,
        successRate: 85,
        dailyActions: 50
      }
    };
  }

  private getDefaultMetrics(): AgentMetrics {
    return {
      totalInteractions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageResponseTime: 0,
      userSatisfaction: 0,
      costEfficiency: 0,
      learningProgress: 0,
      lastActive: new Date(),
      uptime: 100
    };
  }

  private getDefaultMemory(): AgentMemory {
    return {
      shortTerm: [],
      longTerm: [],
      userPreferences: [],
      successPatterns: [],
      failurePatterns: []
    };
  }

  private validatePermissions(permissions: AgentPermissions, context: AgentExecutionContext): boolean {
    // Implement permission validation logic
    return true; // Simplified for now
  }

  private checkRateLimits(agent: AIAgent, context: AgentExecutionContext): boolean {
    // Implement rate limiting logic
    return true; // Simplified for now
  }

  private updateAgentMetrics(agent: AIAgent, result: AgentActionResult): void {
    const metrics = agent.metrics;

    if (result.success) {
      metrics.successfulActions++;
    } else {
      metrics.failedActions++;
    }

    metrics.totalInteractions++;
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (metrics.totalInteractions - 1) + result.executionTime) / metrics.totalInteractions;

    if (result.cost) {
      metrics.costEfficiency = metrics.successfulActions / (result.cost / 100); // actions per dollar
    }
  }

  private async saveAgentToStorage(agent: AIAgent): Promise<void> {
    try {
      const agents = JSON.parse(localStorage.getItem('crm_agents') || '{}');
      agents[agent.id] = agent;
      localStorage.setItem('crm_agents', JSON.stringify(agents));
    } catch (error) {
      console.error('Failed to save agent to storage:', error);
    }
  }

  private async deleteAgentFromStorage(agentId: string): Promise<void> {
    try {
      const agents = JSON.parse(localStorage.getItem('crm_agents') || '{}');
      delete agents[agentId];
      localStorage.setItem('crm_agents', JSON.stringify(agents));
    } catch (error) {
      console.error('Failed to delete agent from storage:', error);
    }
  }

  private logAudit(log: AgentAuditLog): void {
    this.auditLogs.push(log);
    // Keep only last 1000 entries
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }
  }

  private logError(error: AgentError): void {
    this.errors.push(error);
    console.error(`Agent Error [${error.agentId}]:`, error.message);
  }

  // ============================================================================
  // DEFAULT AGENTS INITIALIZATION
  // ============================================================================

  private initializeDefaultAgents(): void {
    // 1. Sales Assistant Agent
    this.createAgent({
      name: 'Sales Assistant',
      type: AgentType.SALES_ASSISTANT,
      description: 'Automates sales pipeline management and follow-ups',
      capabilities: [
        {
          id: 'analyze_pipeline',
          name: 'Pipeline Analysis',
          description: 'Monitor deal progress and suggest next actions',
          functionName: 'comprehensive_deal_analysis',
          triggers: [{ type: TriggerType.DEAL_STAGE_CHANGE, conditions: {} }],
          cooldown: 60,
          priority: 'high',
          requiresConfirmation: false
        },
        {
          id: 'generate_followup',
          name: 'Follow-up Email Generation',
          description: 'Create personalized follow-up emails',
          functionName: 'generate_personalized_email',
          triggers: [{ type: TriggerType.TIME_BASED, conditions: { daysSinceLastContact: 7 } }],
          cooldown: 1440, // 24 hours
          priority: 'medium',
          requiresConfirmation: true
        }
      ],
      personality: {
        tone: 'professional',
        communicationStyle: 'conversational',
        initiativeLevel: 'proactive',
        riskTolerance: 'moderate',
        responseLength: 'normal'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['contacts', 'deals', 'companies'],
        restrictedActions: ['delete'],
        dataScope: 'team',
        rateLimits: { actionsPerHour: 200, apiCallsPerMinute: 20 },
        allowedTriggers: [TriggerType.DEAL_STAGE_CHANGE, TriggerType.TIME_BASED, TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 2, successRate: 90, dailyActions: 100 }
      },
      creatorId: 'system'
    });

    // 2. Lead Qualifier Agent
    this.createAgent({
      name: 'Lead Qualifier',
      type: AgentType.LEAD_QUALIFIER,
      description: 'Automatically qualifies and enriches leads',
      capabilities: [
        {
          id: 'score_lead',
          name: 'Lead Scoring',
          description: 'Analyze inbound leads for quality scoring',
          functionName: 'analyze_contact_profile',
          triggers: [{ type: TriggerType.LEAD_CREATION, conditions: {} }],
          cooldown: 30,
          priority: 'high',
          requiresConfirmation: false
        },
        {
          id: 'research_company',
          name: 'Company Research',
          description: 'Research company background and industry',
          functionName: 'enrich_contact_data',
          triggers: [{ type: TriggerType.LEAD_CREATION, conditions: {} }],
          cooldown: 300, // 5 hours
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'analytical',
        communicationStyle: 'detailed',
        initiativeLevel: 'reactive',
        riskTolerance: 'conservative',
        responseLength: 'detailed'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['contacts', 'companies'],
        restrictedActions: [],
        dataScope: 'all',
        rateLimits: { actionsPerHour: 150, apiCallsPerMinute: 15 },
        allowedTriggers: [TriggerType.LEAD_CREATION, TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '08:00',
          endTime: '18:00',
          daysOfWeek: [1, 2, 3, 4, 5, 6] // Mon-Sat
        },
        notificationPreferences: { email: false, inApp: true },
        performanceTargets: { responseTime: 5, successRate: 85, dailyActions: 75 }
      },
      creatorId: 'system'
    });

    // 3. Deal Detail Analysis Agent
    this.createAgent({
      name: 'Deal Analyst',
      type: AgentType.DEAL_ANALYST,
      description: 'Provides deep analysis of individual deals and opportunities',
      capabilities: [
        {
          id: 'deal_deep_analysis',
          name: 'Deep Deal Analysis',
          description: 'Comprehensive analysis of deal details, risks, and opportunities',
          functionName: 'analyze_deal_details',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 30,
          priority: 'high',
          requiresConfirmation: false
        },
        {
          id: 'competitor_analysis',
          name: 'Competitor Analysis',
          description: 'Analyze competitive landscape for deals',
          functionName: 'analyze_competition',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 300,
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'analytical',
        communicationStyle: 'detailed',
        initiativeLevel: 'reactive',
        riskTolerance: 'conservative',
        responseLength: 'detailed'
      },
      permissions: {
        level: PermissionLevel.READ_ONLY,
        allowedEntities: ['deals', 'contacts', 'companies'],
        restrictedActions: ['delete', 'create'],
        dataScope: 'all',
        rateLimits: { actionsPerHour: 100, apiCallsPerMinute: 10 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '09:00',
          endTime: '18:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: false, inApp: true },
        performanceTargets: { responseTime: 10, successRate: 95, dailyActions: 50 }
      },
      creatorId: 'system'
    });

    // 4. Contact Intelligence Agent
    this.createAgent({
      name: 'Contact Intelligence',
      type: AgentType.CONTACT_INTELLIGENCE,
      description: 'Provides AI-powered insights about contacts and relationships',
      capabilities: [
        {
          id: 'contact_insights',
          name: 'Contact Insights',
          description: 'Generate detailed insights about contact behavior and preferences',
          functionName: 'generate_contact_insights',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 60,
          priority: 'medium',
          requiresConfirmation: false
        },
        {
          id: 'relationship_mapping',
          name: 'Relationship Mapping',
          description: 'Map contact relationships and influence networks',
          functionName: 'map_relationships',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 180,
          priority: 'low',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'insightful',
        communicationStyle: 'detailed',
        initiativeLevel: 'reactive',
        riskTolerance: 'moderate',
        responseLength: 'detailed'
      },
      permissions: {
        level: PermissionLevel.READ_ONLY,
        allowedEntities: ['contacts', 'deals'],
        restrictedActions: ['delete', 'update'],
        dataScope: 'all',
        rateLimits: { actionsPerHour: 80, apiCallsPerMinute: 8 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '08:00',
          endTime: '20:00',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7]
        },
        notificationPreferences: { email: false, inApp: true },
        performanceTargets: { responseTime: 8, successRate: 90, dailyActions: 40 }
      },
      creatorId: 'system'
    });

    // 5. Communication Hub Agent
    this.createAgent({
      name: 'Communication Manager',
      type: AgentType.COMMUNICATION_MANAGER,
      description: 'Manages all communication channels and messaging',
      capabilities: [
        {
          id: 'email_composition',
          name: 'Email Composition',
          description: 'Compose professional emails with AI assistance',
          functionName: 'compose_professional_email',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 10,
          priority: 'high',
          requiresConfirmation: true
        },
        {
          id: 'communication_tracking',
          name: 'Communication Tracking',
          description: 'Track all communications and follow-ups',
          functionName: 'track_communications',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 30,
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'professional',
        communicationStyle: 'concise',
        initiativeLevel: 'reactive',
        riskTolerance: 'low',
        responseLength: 'normal'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['contacts', 'deals', 'communications'],
        restrictedActions: ['delete'],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 120, apiCallsPerMinute: 12 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '08:00',
          endTime: '18:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 3, successRate: 95, dailyActions: 60 }
      },
      creatorId: 'system'
    });

    // 6. Analytics & Reporting Agent
    this.createAgent({
      name: 'Analytics Expert',
      type: AgentType.ANALYTICS_EXPERT,
      description: 'Provides comprehensive analytics and business intelligence',
      capabilities: [
        {
          id: 'performance_analysis',
          name: 'Performance Analysis',
          description: 'Analyze sales performance and KPIs',
          functionName: 'analyze_performance',
          triggers: [{ type: TriggerType.TIME_BASED, conditions: { frequency: 'daily' } }],
          cooldown: 1440, // Daily
          priority: 'medium',
          requiresConfirmation: false
        },
        {
          id: 'forecasting',
          name: 'Sales Forecasting',
          description: 'Generate sales forecasts and predictions',
          functionName: 'generate_forecast',
          triggers: [{ type: TriggerType.TIME_BASED, conditions: { frequency: 'weekly' } }],
          cooldown: 10080, // Weekly
          priority: 'high',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'analytical',
        communicationStyle: 'detailed',
        initiativeLevel: 'proactive',
        riskTolerance: 'moderate',
        responseLength: 'detailed'
      },
      permissions: {
        level: PermissionLevel.READ_ONLY,
        allowedEntities: ['deals', 'contacts', 'analytics'],
        restrictedActions: ['create', 'update', 'delete'],
        dataScope: 'all',
        rateLimits: { actionsPerHour: 50, apiCallsPerMinute: 5 },
        allowedTriggers: [TriggerType.TIME_BASED, TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '06:00',
          endTime: '08:00',
          daysOfWeek: [1, 2, 3, 4, 5] // Business intelligence early morning
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 15, successRate: 98, dailyActions: 20 }
      },
      creatorId: 'system'
    });

    // 7. Calendar & Scheduling Agent
    this.createAgent({
      name: 'Calendar Assistant',
      type: AgentType.CALENDAR_ASSISTANT,
      description: 'Manages scheduling, meetings, and calendar optimization',
      capabilities: [
        {
          id: 'meeting_scheduling',
          name: 'Meeting Scheduling',
          description: 'Schedule optimal meeting times with contacts',
          functionName: 'schedule_meeting',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 15,
          priority: 'high',
          requiresConfirmation: true
        },
        {
          id: 'calendar_optimization',
          name: 'Calendar Optimization',
          description: 'Optimize calendar for productivity and deal closing',
          functionName: 'optimize_calendar',
          triggers: [{ type: TriggerType.TIME_BASED, conditions: { frequency: 'daily' } }],
          cooldown: 1440,
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'organized',
        communicationStyle: 'concise',
        initiativeLevel: 'proactive',
        riskTolerance: 'low',
        responseLength: 'brief'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['calendar', 'contacts', 'deals'],
        restrictedActions: ['delete'],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 100, apiCallsPerMinute: 10 },
        allowedTriggers: [TriggerType.TIME_BASED, TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '07:00',
          endTime: '19:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 5, successRate: 92, dailyActions: 30 }
      },
      creatorId: 'system'
    });

    // 8. Video Content Agent
    this.createAgent({
      name: 'Video Creator',
      type: AgentType.VIDEO_CREATOR,
      description: 'Creates video content for deals and marketing',
      capabilities: [
        {
          id: 'video_scripting',
          name: 'Video Scripting',
          description: 'Generate video scripts for deal presentations',
          functionName: 'create_video_script',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 60,
          priority: 'medium',
          requiresConfirmation: false
        },
        {
          id: 'video_production',
          name: 'Video Production',
          description: 'Produce videos for marketing and sales',
          functionName: 'produce_video',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 300,
          priority: 'high',
          requiresConfirmation: true
        }
      ],
      personality: {
        tone: 'creative',
        communicationStyle: 'detailed',
        initiativeLevel: 'reactive',
        riskTolerance: 'moderate',
        responseLength: 'normal'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['videos', 'deals', 'marketing'],
        restrictedActions: [],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 20, apiCallsPerMinute: 2 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 30, successRate: 85, dailyActions: 10 }
      },
      creatorId: 'system'
    });

    // 9. Voice Communication Agent
    this.createAgent({
      name: 'Voice Assistant',
      type: AgentType.VOICE_ASSISTANT,
      description: 'Handles voice communications and messaging',
      capabilities: [
        {
          id: 'voice_message_creation',
          name: 'Voice Message Creation',
          description: 'Create personalized voice messages',
          functionName: 'create_voice_message',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 30,
          priority: 'medium',
          requiresConfirmation: true
        },
        {
          id: 'voice_transcription',
          name: 'Voice Transcription',
          description: 'Transcribe voice messages and calls',
          functionName: 'transcribe_audio',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 10,
          priority: 'high',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'friendly',
        communicationStyle: 'conversational',
        initiativeLevel: 'reactive',
        riskTolerance: 'low',
        responseLength: 'brief'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['voice', 'contacts', 'communications'],
        restrictedActions: ['delete'],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 60, apiCallsPerMinute: 6 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '08:00',
          endTime: '20:00',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7]
        },
        notificationPreferences: { email: false, inApp: true },
        performanceTargets: { responseTime: 10, successRate: 90, dailyActions: 25 }
      },
      creatorId: 'system'
    });

    // 10. Risk Assessment Agent
    this.createAgent({
      name: 'Risk Assessor',
      type: AgentType.RISK_ASSESSOR,
      description: 'Assesses deal risks and provides mitigation strategies',
      capabilities: [
        {
          id: 'risk_analysis',
          name: 'Risk Analysis',
          description: 'Analyze deal risks and probability factors',
          functionName: 'compute_deal_risk',
          triggers: [{ type: TriggerType.DEAL_STAGE_CHANGE, conditions: {} }],
          cooldown: 60,
          priority: 'high',
          requiresConfirmation: false
        },
        {
          id: 'risk_mitigation',
          name: 'Risk Mitigation',
          description: 'Suggest strategies to reduce deal risks',
          functionName: 'suggest_risk_mitigation',
          triggers: [{ type: TriggerType.METRIC_THRESHOLD, conditions: { riskLevel: 'high' } }],
          cooldown: 180,
          priority: 'high',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'cautious',
        communicationStyle: 'detailed',
        initiativeLevel: 'proactive',
        riskTolerance: 'low',
        responseLength: 'detailed'
      },
      permissions: {
        level: PermissionLevel.READ_ONLY,
        allowedEntities: ['deals', 'contacts', 'analytics'],
        restrictedActions: ['create', 'update', 'delete'],
        dataScope: 'all',
        rateLimits: { actionsPerHour: 80, apiCallsPerMinute: 8 },
        allowedTriggers: [TriggerType.DEAL_STAGE_CHANGE, TriggerType.METRIC_THRESHOLD, TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '08:00',
          endTime: '18:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 8, successRate: 95, dailyActions: 40 }
      },
      creatorId: 'system'
    });

    // 11. Data Management Agent
    this.createAgent({
      name: 'Data Manager',
      type: AgentType.DATA_MANAGER,
      description: 'Handles data import, export, and management operations',
      capabilities: [
        {
          id: 'data_import',
          name: 'Data Import',
          description: 'Import data from various sources',
          functionName: 'import_data',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 60,
          priority: 'medium',
          requiresConfirmation: true
        },
        {
          id: 'data_export',
          name: 'Data Export',
          description: 'Export data in various formats',
          functionName: 'export_data',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 30,
          priority: 'medium',
          requiresConfirmation: true
        }
      ],
      personality: {
        tone: 'methodical',
        communicationStyle: 'concise',
        initiativeLevel: 'reactive',
        riskTolerance: 'low',
        responseLength: 'brief'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['contacts', 'deals', 'data'],
        restrictedActions: [],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 40, apiCallsPerMinute: 4 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 20, successRate: 98, dailyActions: 15 }
      },
      creatorId: 'system'
    });

    // 12. Gamification Coach Agent
    this.createAgent({
      name: 'Achievement Coach',
      type: AgentType.ACHIEVEMENT_COACH,
      description: 'Helps users maximize gamification rewards and achievements',
      capabilities: [
        {
          id: 'achievement_tracking',
          name: 'Achievement Tracking',
          description: 'Track progress toward achievements',
          functionName: 'track_achievements',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 60,
          priority: 'low',
          requiresConfirmation: false
        },
        {
          id: 'goal_setting',
          name: 'Goal Setting',
          description: 'Help set and achieve sales goals',
          functionName: 'set_goals',
          triggers: [{ type: TriggerType.TIME_BASED, conditions: { frequency: 'weekly' } }],
          cooldown: 10080,
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'motivational',
        communicationStyle: 'encouraging',
        initiativeLevel: 'proactive',
        riskTolerance: 'moderate',
        responseLength: 'normal'
      },
      permissions: {
        level: PermissionLevel.READ_ONLY,
        allowedEntities: ['achievements', 'goals', 'performance'],
        restrictedActions: ['create', 'update', 'delete'],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 60, apiCallsPerMinute: 6 },
        allowedTriggers: [TriggerType.TIME_BASED, TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '08:00',
          endTime: '20:00',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7]
        },
        notificationPreferences: { email: false, inApp: true },
        performanceTargets: { responseTime: 5, successRate: 90, dailyActions: 25 }
      },
      creatorId: 'system'
    });

    // 13. SDR Campaign Agent
    this.createAgent({
      name: 'SDR Campaign Manager',
      type: AgentType.SDR_CAMPAIGN_MANAGER,
      description: 'Manages SDR campaigns and outreach sequences',
      capabilities: [
        {
          id: 'campaign_creation',
          name: 'Campaign Creation',
          description: 'Create and optimize SDR campaigns',
          functionName: 'create_sdr_campaign',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 60,
          priority: 'high',
          requiresConfirmation: true
        },
        {
          id: 'sequence_optimization',
          name: 'Sequence Optimization',
          description: 'Optimize email and call sequences',
          functionName: 'optimize_sequence',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 180,
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'strategic',
        communicationStyle: 'detailed',
        initiativeLevel: 'reactive',
        riskTolerance: 'moderate',
        responseLength: 'detailed'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['campaigns', 'contacts', 'sequences'],
        restrictedActions: ['delete'],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 100, apiCallsPerMinute: 10 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [1, 2, 3, 4, 5]
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 10, successRate: 88, dailyActions: 50 }
      },
      creatorId: 'system'
    });

    // 14. Memory & Context Agent
    this.createAgent({
      name: 'Memory Keeper',
      type: AgentType.MEMORY_KEEPER,
      description: 'Manages memory, context, and learning from interactions',
      capabilities: [
        {
          id: 'memory_retrieval',
          name: 'Memory Retrieval',
          description: 'Retrieve relevant context from past interactions',
          functionName: 'load_memory',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 5,
          priority: 'high',
          requiresConfirmation: false
        },
        {
          id: 'context_analysis',
          name: 'Context Analysis',
          description: 'Analyze conversation context and patterns',
          functionName: 'analyze_context',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 10,
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'wise',
        communicationStyle: 'reflective',
        initiativeLevel: 'reactive',
        riskTolerance: 'low',
        responseLength: 'normal'
      },
      permissions: {
        level: PermissionLevel.READ_ONLY,
        allowedEntities: ['memory', 'context', 'conversations'],
        restrictedActions: ['create', 'update', 'delete'],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 200, apiCallsPerMinute: 20 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '00:00',
          endTime: '23:59',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7] // Always available
        },
        notificationPreferences: { email: false, inApp: false },
        performanceTargets: { responseTime: 2, successRate: 99, dailyActions: 100 }
      },
      creatorId: 'system'
    });

    // 15. Error Monitoring Agent
    this.createAgent({
      name: 'System Monitor',
      type: AgentType.SYSTEM_MONITOR,
      description: 'Monitors system health and handles error reporting',
      capabilities: [
        {
          id: 'error_detection',
          name: 'Error Detection',
          description: 'Detect and categorize system errors',
          functionName: 'detect_errors',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 5,
          priority: 'high',
          requiresConfirmation: false
        },
        {
          id: 'system_health',
          name: 'System Health Check',
          description: 'Monitor overall system health and performance',
          functionName: 'check_system_health',
          triggers: [{ type: TriggerType.TIME_BASED, conditions: { frequency: 'hourly' } }],
          cooldown: 3600, // Hourly
          priority: 'medium',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'alert',
        communicationStyle: 'concise',
        initiativeLevel: 'proactive',
        riskTolerance: 'low',
        responseLength: 'brief'
      },
      permissions: {
        level: PermissionLevel.READ_ONLY,
        allowedEntities: ['system', 'errors', 'logs'],
        restrictedActions: ['create', 'update', 'delete'],
        dataScope: 'all',
        rateLimits: { actionsPerHour: 120, apiCallsPerMinute: 12 },
        allowedTriggers: [TriggerType.TIME_BASED, TriggerType.MANUAL]
      },
      configuration: {
        autoStart: true,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '00:00',
          endTime: '23:59',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7] // 24/7 monitoring
        },
        notificationPreferences: { email: true, inApp: true },
        performanceTargets: { responseTime: 1, successRate: 100, dailyActions: 50 }
      },
      creatorId: 'system'
    });

    // 16. Personalization Agent
    this.createAgent({
      name: 'Personalization Assistant',
      type: AgentType.PERSONALIZATION_ASSISTANT,
      description: 'Manages themes, preferences, and user personalization',
      capabilities: [
        {
          id: 'theme_optimization',
          name: 'Theme Optimization',
          description: 'Optimize themes and UI for user preferences',
          functionName: 'optimize_theme',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 60,
          priority: 'low',
          requiresConfirmation: false
        },
        {
          id: 'preference_learning',
          name: 'Preference Learning',
          description: 'Learn and adapt to user preferences',
          functionName: 'learn_preferences',
          triggers: [{ type: TriggerType.MANUAL, conditions: {} }],
          cooldown: 300,
          priority: 'low',
          requiresConfirmation: false
        }
      ],
      personality: {
        tone: 'helpful',
        communicationStyle: 'friendly',
        initiativeLevel: 'reactive',
        riskTolerance: 'low',
        responseLength: 'brief'
      },
      permissions: {
        level: PermissionLevel.READ_WRITE,
        allowedEntities: ['preferences', 'themes', 'ui'],
        restrictedActions: ['delete'],
        dataScope: 'owned',
        rateLimits: { actionsPerHour: 40, apiCallsPerMinute: 4 },
        allowedTriggers: [TriggerType.MANUAL]
      },
      configuration: {
        autoStart: false,
        workingHours: {
          enabled: true,
          timezone: 'UTC',
          startTime: '08:00',
          endTime: '20:00',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7]
        },
        notificationPreferences: { email: false, inApp: true },
        performanceTargets: { responseTime: 5, successRate: 95, dailyActions: 20 }
      },
      creatorId: 'system'
    });
  }
}

// Singleton instance
let agentFrameworkInstance: AgentFramework | null = null;

export const getAgentFramework = (): AgentFramework => {
  if (!agentFrameworkInstance) {
    agentFrameworkInstance = new AgentFramework();
  }
  return agentFrameworkInstance;
};

export { AgentFramework };