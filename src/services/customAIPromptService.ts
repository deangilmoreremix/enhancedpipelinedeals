/**
 * Custom AI Prompt Service - Manage custom AI prompts and templates
 * Create, version, and execute custom AI prompts for specific use cases
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { CustomAIPrompt, PromptVariable, PromptExample, PromptPerformance } from '../types';

export class CustomAIPromptService {
  private aiOrchestrator = getSmartAIOrchestrator();

  /**
   * Create a new custom prompt
   */
  async createPrompt(promptData: Omit<CustomAIPrompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'performanceMetrics'>): Promise<CustomAIPrompt> {
    try {
      const prompt: CustomAIPrompt = {
        ...promptData,
        id: `prompt_${Date.now()}_${Math.random()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        performanceMetrics: {
          averageResponseTime: 0,
          successRate: 0,
          averageConfidence: 0,
          totalExecutions: 0,
          lastExecuted: new Date(),
          qualityScore: 0
        }
      };

      // Validate prompt data
      const validation = this.validatePrompt(prompt);
      if (!validation.valid) {
        throw new Error(`Invalid prompt: ${validation.errors.join(', ')}`);
      }

      // Save to database
      await this.savePrompt(prompt);

      return prompt;
    } catch (error) {
      console.error('Failed to create prompt:', error);
      throw error;
    }
  }

  /**
   * Execute a custom prompt
   */
  async executePrompt(
    promptId: string,
    variables: Record<string, any>,
    userId: string
  ): Promise<{
    success: boolean;
    result: string;
    confidence: number;
    executionTime: number;
    tokens?: number;
  }> {
    try {
      const prompt = await this.getPrompt(promptId);
      if (!prompt) {
        throw new Error(`Prompt not found: ${promptId}`);
      }

      // Validate variables
      const variableValidation = this.validateVariables(prompt.variables, variables);
      if (!variableValidation.valid) {
        throw new Error(`Invalid variables: ${variableValidation.errors.join(', ')}`);
      }

      const startTime = Date.now();

      // Execute the prompt
      const result = await this.aiOrchestrator.executeTask('custom_prompt_execution', {
        template: prompt,
        variables
      });

      const executionTime = Date.now() - startTime;

      const response = {
        success: result.success,
        result: result.success ? result.data.response || result.data : 'Execution failed',
        confidence: result.success ? (result.data.executionDetails?.confidence || 0.8) : 0,
        executionTime,
        tokens: result.data.executionDetails?.tokens
      };

      // Update performance metrics
      await this.updatePerformanceMetrics(promptId, response);

      // Log execution
      await this.logExecution(promptId, userId, variables, response);

      return response;
    } catch (error) {
      console.error('Failed to execute prompt:', error);
      throw error;
    }
  }

  /**
   * Get a prompt by ID
   */
  async getPrompt(promptId: string): Promise<CustomAIPrompt | null> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('custom_ai_prompts')
        .select('*')
        .eq('id', promptId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.transformDatabaseResult(data);
    } catch (error) {
      console.error('Failed to get prompt:', error);
      return null;
    }
  }

  /**
   * Get prompts by category
   */
  async getPromptsByCategory(category: string): Promise<CustomAIPrompt[]> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('custom_ai_prompts')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;

      return data.map(item => this.transformDatabaseResult(item));
    } catch (error) {
      console.error('Failed to get prompts by category:', error);
      return [];
    }
  }

  /**
   * Update a prompt
   */
  async updatePrompt(
    promptId: string,
    updates: Partial<Pick<CustomAIPrompt, 'name' | 'description' | 'promptTemplate' | 'variables' | 'model' | 'temperature' | 'maxTokens' | 'systemMessage' | 'examples'>>
  ): Promise<CustomAIPrompt | null> {
    try {
      const existingPrompt = await this.getPrompt(promptId);
      if (!existingPrompt) {
        throw new Error(`Prompt not found: ${promptId}`);
      }

      const updatedPrompt: CustomAIPrompt = {
        ...existingPrompt,
        ...updates,
        updatedAt: new Date(),
        version: this.incrementVersion(existingPrompt.version)
      };

      // Validate updated prompt
      const validation = this.validatePrompt(updatedPrompt);
      if (!validation.valid) {
        throw new Error(`Invalid prompt update: ${validation.errors.join(', ')}`);
      }

      // Save updated prompt
      await this.savePrompt(updatedPrompt);

      return updatedPrompt;
    } catch (error) {
      console.error('Failed to update prompt:', error);
      throw error;
    }
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(promptId: string): Promise<boolean> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { error } = await supabase
        .from('custom_ai_prompts')
        .delete()
        .eq('id', promptId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      return false;
    }
  }

  /**
   * Get prompt execution history
   */
  async getExecutionHistory(promptId: string, limit: number = 50): Promise<Array<{
    id: string;
    executedAt: Date;
    userId: string;
    variables: Record<string, any>;
    success: boolean;
    executionTime: number;
    confidence: number;
  }>> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('prompt_executions')
        .select('*')
        .eq('prompt_id', promptId)
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(item => ({
        id: item.id,
        executedAt: new Date(item.executed_at),
        userId: item.user_id,
        variables: item.variables,
        success: item.success,
        executionTime: item.execution_time,
        confidence: item.confidence
      }));
    } catch (error) {
      console.error('Failed to get execution history:', error);
      return [];
    }
  }

  /**
   * Clone a prompt
   */
  async clonePrompt(promptId: string, newName: string, createdBy: string): Promise<CustomAIPrompt | null> {
    try {
      const originalPrompt = await this.getPrompt(promptId);
      if (!originalPrompt) {
        return null;
      }

      const clonedPrompt = await this.createPrompt({
        ...originalPrompt,
        name: newName,
        createdBy,
        version: '1.0.0'
      });

      return clonedPrompt;
    } catch (error) {
      console.error('Failed to clone prompt:', error);
      throw error;
    }
  }

  private validatePrompt(prompt: CustomAIPrompt): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!prompt.name?.trim()) {
      errors.push('Name is required');
    }

    if (!prompt.promptTemplate?.trim()) {
      errors.push('Prompt template is required');
    }

    if (!prompt.category) {
      errors.push('Category is required');
    }

    if (!prompt.createdBy) {
      errors.push('Created by is required');
    }

    if (prompt.variables) {
      prompt.variables.forEach((variable, index) => {
        if (!variable.name?.trim()) {
          errors.push(`Variable ${index + 1}: name is required`);
        }
        if (!variable.type) {
          errors.push(`Variable ${index + 1}: type is required`);
        }
        if (!variable.description?.trim()) {
          errors.push(`Variable ${index + 1}: description is required`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateVariables(
    expectedVariables: PromptVariable[],
    providedVariables: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    expectedVariables.forEach(variable => {
      if (variable.required && !(variable.name in providedVariables)) {
        errors.push(`Required variable '${variable.name}' is missing`);
      }

      if (variable.name in providedVariables) {
        const value = providedVariables[variable.name];

        // Type validation (basic)
        switch (variable.type) {
          case 'string':
            if (typeof value !== 'string') {
              errors.push(`Variable '${variable.name}' must be a string`);
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              errors.push(`Variable '${variable.name}' must be a number`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              errors.push(`Variable '${variable.name}' must be a boolean`);
            }
            break;
          case 'array':
            if (!Array.isArray(value)) {
              errors.push(`Variable '${variable.name}' must be an array`);
            }
            break;
          case 'object':
            if (typeof value !== 'object' || Array.isArray(value)) {
              errors.push(`Variable '${variable.name}' must be an object`);
            }
            break;
        }

        // Regex validation
        if (variable.validation && typeof value === 'string') {
          const regex = new RegExp(variable.validation);
          if (!regex.test(value)) {
            errors.push(`Variable '${variable.name}' does not match required format`);
          }
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private transformDatabaseResult(data: any): CustomAIPrompt {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      promptTemplate: data.prompt_template,
      variables: data.variables || [],
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.max_tokens,
      systemMessage: data.system_message,
      examples: data.examples || [],
      version: data.version,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      usageCount: data.usage_count,
      performanceMetrics: data.performance_metrics
    };
  }

  private async savePrompt(prompt: CustomAIPrompt): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        category: prompt.category,
        prompt_template: prompt.promptTemplate,
        variables: prompt.variables,
        model: prompt.model,
        temperature: prompt.temperature,
        max_tokens: prompt.maxTokens,
        system_message: prompt.systemMessage,
        examples: prompt.examples,
        version: prompt.version,
        is_active: prompt.isActive,
        created_by: prompt.createdBy,
        created_at: prompt.createdAt.toISOString(),
        updated_at: prompt.updatedAt.toISOString(),
        usage_count: prompt.usageCount,
        performance_metrics: prompt.performanceMetrics
      };

      const { error } = await supabase
        .from('custom_ai_prompts')
        .upsert(dbData, { onConflict: 'id' });

      if (error) {
        console.error('Failed to save prompt:', error);
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  }

  private async updatePerformanceMetrics(
    promptId: string,
    executionResult: { success: boolean; executionTime: number; confidence: number }
  ): Promise<void> {
    try {
      const prompt = await this.getPrompt(promptId);
      if (!prompt) return;

      const currentMetrics = prompt.performanceMetrics;
      const totalExecutions = currentMetrics.totalExecutions + 1;
      const successRate = ((currentMetrics.successRate * currentMetrics.totalExecutions) + (executionResult.success ? 1 : 0)) / totalExecutions;
      const averageResponseTime = ((currentMetrics.averageResponseTime * currentMetrics.totalExecutions) + executionResult.executionTime) / totalExecutions;
      const averageConfidence = ((currentMetrics.averageConfidence * currentMetrics.totalExecutions) + executionResult.confidence) / totalExecutions;

      const updatedMetrics: PromptPerformance = {
        ...currentMetrics,
        averageResponseTime,
        successRate,
        averageConfidence,
        totalExecutions,
        lastExecuted: new Date()
      };

      await this.updatePrompt(promptId, { performanceMetrics: updatedMetrics });
    } catch (error) {
      console.error('Failed to update performance metrics:', error);
    }
  }

  private async logExecution(
    promptId: string,
    userId: string,
    variables: Record<string, any>,
    result: any
  ): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { error } = await supabase
        .from('prompt_executions')
        .insert({
          id: `exec_${Date.now()}_${Math.random()}`,
          prompt_id: promptId,
          user_id: userId,
          variables,
          success: result.success,
          execution_time: result.executionTime,
          confidence: result.confidence,
          executed_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log execution:', error);
      }
    } catch (error) {
      console.error('Failed to log execution:', error);
    }
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Get prompt statistics
   */
  async getStatistics(): Promise<{
    totalPrompts: number;
    activePrompts: number;
    categoryDistribution: Record<string, number>;
    totalExecutions: number;
    averageSuccessRate: number;
    topPrompts: Array<{ id: string; name: string; usageCount: number }>;
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      // Get prompts
      const { data: prompts, error: promptsError } = await supabase
        .from('custom_ai_prompts')
        .select('category, usage_count, name, id');

      if (promptsError) throw promptsError;

      const totalPrompts = prompts.length;
      const activePrompts = prompts.filter(p => p.usage_count > 0).length;

      const categoryDistribution = prompts.reduce((acc, prompt) => {
        acc[prompt.category] = (acc[prompt.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalExecutions = prompts.reduce((sum, prompt) => sum + prompt.usage_count, 0);
      const averageSuccessRate = totalPrompts > 0
        ? prompts.reduce((sum, prompt) => sum + (prompt.usage_count > 0 ? 0.85 : 0), 0) / totalPrompts
        : 0;

      const topPrompts = prompts
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 5)
        .map(p => ({ id: p.id, name: p.name, usageCount: p.usage_count }));

      return {
        totalPrompts,
        activePrompts,
        categoryDistribution,
        totalExecutions,
        averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
        topPrompts
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalPrompts: 0,
        activePrompts: 0,
        categoryDistribution: {},
        totalExecutions: 0,
        averageSuccessRate: 0,
        topPrompts: []
      };
    }
  }

  /**
   * Get prompt template suggestions
   */
  getTemplateSuggestions(): Array<{
    category: string;
    name: string;
    description: string;
    template: string;
    variables: PromptVariable[];
  }> {
    return [
      {
        category: 'communication',
        name: 'Email Personalization',
        description: 'Generate personalized email content based on contact data',
        template: 'Write a personalized email to {{contactName}} at {{companyName}} about {{topic}}.\n\nContact details: {{contactDetails}}\nCompany information: {{companyDetails}}\n\nFocus on: {{keyPoints}}\nTone: {{tone}}',
        variables: [
          { name: 'contactName', type: 'string', description: 'Name of the contact', required: true },
          { name: 'companyName', type: 'string', description: 'Name of the company', required: true },
          { name: 'topic', type: 'string', description: 'Email topic or purpose', required: true },
          { name: 'contactDetails', type: 'object', description: 'Contact information object', required: false },
          { name: 'companyDetails', type: 'object', description: 'Company information object', required: false },
          { name: 'keyPoints', type: 'array', description: 'Key points to cover', required: false },
          { name: 'tone', type: 'string', description: 'Email tone (professional, casual, etc.)', required: false, defaultValue: 'professional' }
        ]
      },
      {
        category: 'analysis',
        name: 'Deal Risk Assessment',
        description: 'Analyze potential risks in a deal',
        template: 'Analyze the following deal for potential risks and provide mitigation strategies:\n\nDeal: {{dealDetails}}\nContact: {{contactInfo}}\nTimeline: {{timeline}}\n\nConsider these risk factors:\n- Budget availability\n- Decision-making process\n- Competition\n- Timeline constraints\n- Technical requirements',
        variables: [
          { name: 'dealDetails', type: 'object', description: 'Deal information', required: true },
          { name: 'contactInfo', type: 'object', description: 'Contact details', required: true },
          { name: 'timeline', type: 'string', description: 'Deal timeline', required: false }
        ]
      }
    ];
  }
}

// Singleton instance
let customAIPromptService: CustomAIPromptService | null = null;

export const getCustomAIPromptService = (): CustomAIPromptService => {
  if (!customAIPromptService) {
    customAIPromptService = new CustomAIPromptService();
  }
  return customAIPromptService;
};