/**
 * AI Chatbot Service - Conversational assistant with full CRM data access
 * Provides natural language interface to CRM operations with context awareness
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { AIChatbotSession, ChatbotMessage, PageContext, ActiveEntity } from '../types';

export class AIChatbotService {
  private aiOrchestrator = getSmartAIOrchestrator();
  private sessions = new Map<string, AIChatbotSession>();

  /**
   * Start a new chatbot session
   */
  async startSession(userId: string, workspaceId: string): Promise<AIChatbotSession> {
    const session: AIChatbotSession = {
      id: `session_${Date.now()}_${Math.random()}`,
      userId,
      context: {
        workspaceId,
        userRole: 'user', // Would be determined from user permissions
        recentActivity: [],
        activeWorkflows: [],
        availableActions: this.getAvailableActions(),
        dataScope: {}
      },
      messages: [],
      activeEntities: [],
      sessionState: 'active',
      createdAt: new Date(),
      lastActivity: new Date(),
      preferences: {
        responseStyle: 'conversational',
        dataFormat: 'summary',
        notificationLevel: 'standard',
        autoActions: false,
        language: 'en'
      }
    };

    this.sessions.set(session.id, session);

    // Add welcome message
    await this.addMessage(session.id, {
      role: 'assistant',
      content: "Hello! I'm your AI assistant for the CRM system. I can help you find deals, analyze data, create tasks, and answer questions about your pipeline. What would you like to know?",
      timestamp: new Date(),
      metadata: {
        intent: 'greeting',
        confidence: 1.0
      }
    });

    return session;
  }

  /**
   * Process a user message in a session
   */
  async processMessage(sessionId: string, message: string, pageContext?: PageContext): Promise<ChatbotMessage> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Update session context
      if (pageContext) {
        session.currentPage = pageContext;
        this.updateActiveEntities(session, pageContext);
      }

      // Add user message
      await this.addMessage(sessionId, {
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // Analyze intent and context
      const intentAnalysis = await this.analyzeIntent(message, session);

      // Execute appropriate actions based on intent
      const response = await this.generateResponse(intentAnalysis, session);

      // Add assistant response
      const assistantMessage = await this.addMessage(sessionId, {
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: {
          intent: intentAnalysis.intent,
          confidence: intentAnalysis.confidence,
          entities: intentAnalysis.entities,
          actions: response.actions,
          dataQueries: response.dataQueries
        }
      });

      // Execute suggested actions if auto-actions enabled
      if (session.preferences.autoActions && response.actions) {
        await this.executeActions(response.actions, session);
      }

      // Update session last activity
      session.lastActivity = new Date();

      return assistantMessage;
    } catch (error) {
      console.error('Failed to process message:', error);

      // Add error message
      return await this.addMessage(sessionId, {
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your message. Please try again or contact support if the issue persists.",
        timestamp: new Date(),
        metadata: {
          intent: 'error',
          confidence: 0.0
        }
      });
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AIChatbotSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.sessionState = 'completed';
      // In production, save session to database
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Update session preferences
   */
  updatePreferences(sessionId: string, preferences: Partial<AIChatbotSession['preferences']>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.preferences = { ...session.preferences, ...preferences };
    }
  }

  private async analyzeIntent(message: string, session: AIChatbotSession): Promise<{
    intent: string;
    confidence: number;
    entities: any[];
    context: any;
  }> {
    // Use AI to analyze the user's intent
    const context = {
      query: message,
      context: {
        currentPage: session.currentPage,
        activeEntities: session.activeEntities,
        userPreferences: session.preferences,
        recentQueries: session.messages.slice(-5).map(m => m.content),
        sessionHistory: session.messages.map(m => ({
          query: m.content,
          timestamp: m.timestamp
        }))
      },
      availableData: {
        entities: ['deals', 'contacts', 'companies', 'tasks'],
        actions: this.getAvailableActions()
      }
    };

    const result = await this.aiOrchestrator.executeTask('natural_language_query', {
      query: message,
      context,
      availableData: context.availableData
    });

    if (!result.success) {
      return {
        intent: 'unknown',
        confidence: 0.0,
        entities: [],
        context: {}
      };
    }

    return {
      intent: result.data.parsedIntent?.action || 'unknown',
      confidence: 0.8, // Placeholder
      entities: result.data.parsedIntent?.filters ? [result.data.parsedIntent] : [],
      context: result.data
    };
  }

  private async generateResponse(
    intentAnalysis: any,
    session: AIChatbotSession
  ): Promise<{
    content: string;
    actions?: any[];
    dataQueries?: any[];
  }> {
    const { intent, context } = intentAnalysis;

    switch (intent) {
      case 'find':
      case 'count':
      case 'analyze':
        return await this.handleDataQuery(context, session);

      case 'create':
        return await this.handleCreateAction(context, session);

      case 'update':
        return await this.handleUpdateAction(context, session);

      case 'delete':
        return await this.handleDeleteAction(context, session);

      default:
        return {
          content: await this.generateConversationalResponse(intentAnalysis, session)
        };
    }
  }

  private async handleDataQuery(context: any, session: AIChatbotSession): Promise<{
    content: string;
    dataQueries?: any[];
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { parsedIntent, results } = context;

      // Execute the query based on parsed intent
      let data: any = [];
      let summary = '';

      if (parsedIntent.action === 'find' || parsedIntent.action === 'count') {
        const entityType = parsedIntent.entityType;

        let query = supabase.from(entityType + 's'); // Add 's' for table name

        // Apply filters
        if (parsedIntent.filters) {
          Object.entries(parsedIntent.filters).forEach(([key, value]) => {
            if (value !== undefined) {
              query = query.eq(key, value);
            }
          });
        }

        // Apply sorting
        if (parsedIntent.sorting) {
          Object.entries(parsedIntent.sorting).forEach(([field, direction]) => {
            query = query.order(field, { ascending: direction === 'asc' });
          });
        }

        // Apply limit
        if (parsedIntent.limit) {
          query = query.limit(parsedIntent.limit);
        }

        const { data: queryData, error } = await query.select('*');

        if (error) throw error;
        data = queryData;

        if (parsedIntent.action === 'count') {
          summary = `Found ${data.length} ${entityType}${data.length !== 1 ? 's' : ''} matching your criteria.`;
        } else {
          summary = `Found ${data.length} ${entityType}${data.length !== 1 ? 's' : ''}:`;
        }
      }

      // Format response based on user preferences
      const formattedData = this.formatData(data, session.preferences.dataFormat, parsedIntent.entityType);

      return {
        content: summary + '\n\n' + formattedData,
        dataQueries: [{
          id: `query_${Date.now()}`,
          type: parsedIntent.action,
          entityType: parsedIntent.entityType,
          filters: parsedIntent.filters || {},
          fields: ['*'],
          limit: parsedIntent.limit
        }]
      };
    } catch (error) {
      console.error('Data query failed:', error);
      return {
        content: "I'm sorry, I encountered an error while querying the data. Please try rephrasing your question."
      };
    }
  }

  private async handleCreateAction(context: any, session: AIChatbotSession): Promise<{
    content: string;
    actions?: any[];
  }> {
    // Placeholder for create actions
    return {
      content: "I understand you'd like to create something. This feature is coming soon!",
      actions: [{
        type: 'create',
        description: 'Create new entity',
        priority: 'medium',
        requiresConfirmation: true
      }]
    };
  }

  private async handleUpdateAction(context: any, session: AIChatbotSession): Promise<{
    content: string;
    actions?: any[];
  }> {
    // Placeholder for update actions
    return {
      content: "I understand you'd like to update something. This feature is coming soon!",
      actions: [{
        type: 'update',
        description: 'Update entity',
        priority: 'medium',
        requiresConfirmation: true
      }]
    };
  }

  private async handleDeleteAction(context: any, session: AIChatbotSession): Promise<{
    content: string;
    actions?: any[];
  }> {
    // Placeholder for delete actions
    return {
      content: "I understand you'd like to delete something. Please be careful with delete operations - this feature requires confirmation.",
      actions: [{
        type: 'delete',
        description: 'Delete entity',
        priority: 'high',
        requiresConfirmation: true
      }]
    };
  }

  private async generateConversationalResponse(intentAnalysis: any, session: AIChatbotSession): Promise<string> {
    // Generate conversational response for unknown intents or general chat
    const responses = [
      "I'd be happy to help with that. Could you provide more details about what you're looking for?",
      "I'm here to assist with your CRM data and operations. What specific information do you need?",
      "Let me help you with that. You can ask me about deals, contacts, analytics, or any CRM-related tasks.",
      "I can help you find information, analyze data, or perform actions in your CRM. What would you like to do?"
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  private formatData(data: any[], format: string, entityType: string): string {
    if (!data || data.length === 0) {
      return "No data found.";
    }

    switch (format) {
      case 'table':
        return this.formatAsTable(data, entityType);

      case 'cards':
        return this.formatAsCards(data, entityType);

      case 'summary':
      default:
        return this.formatAsSummary(data, entityType);
    }
  }

  private formatAsTable(data: any[], entityType: string): string {
    if (data.length === 0) return '';

    const keys = Object.keys(data[0]);
    const headers = keys.join(' | ');
    const separator = keys.map(() => '---').join(' | ');
    const rows = data.map(item =>
      keys.map(key => String(item[key] || '')).join(' | ')
    );

    return [headers, separator, ...rows].join('\n');
  }

  private formatAsCards(data: any[], entityType: string): string {
    return data.map((item, index) => {
      const card = Object.entries(item)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      return `**${entityType.toUpperCase()} ${index + 1}**\n${card}`;
    }).join('\n\n');
  }

  private formatAsSummary(data: any[], entityType: string): string {
    if (data.length === 1) {
      const item = data[0];
      const keyValue = Object.entries(item)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      return `Found 1 ${entityType}: ${keyValue}`;
    } else {
      return `Found ${data.length} ${entityType}s. Here are the key details:\n` +
        data.map((item, index) => {
          const primaryField = this.getPrimaryField(entityType, item);
          return `${index + 1}. ${primaryField}`;
        }).join('\n');
    }
  }

  private getPrimaryField(entityType: string, item: any): string {
    const primaryFields: Record<string, string[]> = {
      deal: ['title', 'company', 'value'],
      contact: ['name', 'company', 'title'],
      company: ['name', 'industry'],
      task: ['title', 'description']
    };

    const fields = primaryFields[entityType] || ['id'];
    return fields.map(field => item[field]).filter(Boolean).join(' - ');
  }

  private getAvailableActions(): string[] {
    return [
      'find_deals', 'create_deal', 'update_deal',
      'find_contacts', 'create_contact', 'update_contact',
      'find_companies', 'create_company', 'update_company',
      'run_analytics', 'generate_report', 'schedule_task'
    ];
  }

  private updateActiveEntities(session: AIChatbotSession, pageContext: PageContext): void {
    // Update active entities based on current page context
    if (pageContext.entityId && pageContext.entityType) {
      const existingEntity = session.activeEntities.find(
        e => e.type === pageContext.entityType && e.id === pageContext.entityId
      );

      if (!existingEntity) {
        session.activeEntities.unshift({
          id: pageContext.entityId,
          type: pageContext.entityType as 'deal' | 'contact' | 'company',
          name: `Current ${pageContext.entityType}`,
          relevance: 1.0,
          lastReferenced: new Date()
        });

        // Keep only top 5 most relevant entities
        session.activeEntities = session.activeEntities.slice(0, 5);
      }
    }
  }

  private async executeActions(actions: any[], session: AIChatbotSession): Promise<void> {
    // Placeholder for action execution
    // In production, this would execute the suggested actions
    console.log('Auto-executing actions:', actions);
  }

  private async addMessage(sessionId: string, message: ChatbotMessage): Promise<ChatbotMessage> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);
      // Keep only last 50 messages to manage memory
      if (session.messages.length > 50) {
        session.messages = session.messages.slice(-50);
      }
    }
    return message;
  }

  /**
   * Get chatbot usage statistics
   */
  async getStatistics(): Promise<{
    activeSessions: number;
    totalMessages: number;
    averageSessionLength: number;
    popularIntents: Record<string, number>;
  }> {
    const activeSessions = Array.from(this.sessions.values()).filter(
      s => s.sessionState === 'active'
    ).length;

    const totalMessages = Array.from(this.sessions.values()).reduce(
      (sum, session) => sum + session.messages.length, 0
    );

    const completedSessions = Array.from(this.sessions.values()).filter(
      s => s.sessionState === 'completed'
    );

    const averageSessionLength = completedSessions.length > 0
      ? completedSessions.reduce((sum, session) => {
          const duration = session.lastActivity.getTime() - session.createdAt.getTime();
          return sum + duration;
        }, 0) / completedSessions.length / (1000 * 60) // Convert to minutes
      : 0;

    // Count intents (placeholder - would analyze actual messages)
    const popularIntents: Record<string, number> = {
      'find': 45,
      'analyze': 23,
      'create': 12,
      'update': 8,
      'other': 12
    };

    return {
      activeSessions,
      totalMessages,
      averageSessionLength: Math.round(averageSessionLength * 100) / 100,
      popularIntents
    };
  }
}

// Singleton instance
let aiChatbotService: AIChatbotService | null = null;

export const getAIChatbotService = (): AIChatbotService => {
  if (!aiChatbotService) {
    aiChatbotService = new AIChatbotService();
  }
  return aiChatbotService;
};