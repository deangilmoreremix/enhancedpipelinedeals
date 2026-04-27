/**
 * Automated Note Taking Service - AI-powered communication summarization
 * Generates summaries, action items, and insights from deal communications
 */

import { getSmartAIOrchestrator } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { AutomatedNote } from '../types';

export class AutomatedNoteTakingService {
  private aiOrchestrator = getSmartAIOrchestrator();

  /**
   * Generate automated notes from a communication
   */
  async generateNotes(
    dealId: string,
    contactId: string,
    communicationId: string,
    communication: any
  ): Promise<AutomatedNote> {
    try {
      // Get deal and contact context
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      // Fetch deal data
      const { data: deal } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();

      // Fetch contact data
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      // Execute AI note generation
      const result = await this.aiOrchestrator.executeTask('automated_note_taking', {
        dealId,
        contactId,
        communicationId,
        communication,
        deal: deal || {},
        contact: contact || {}
      });

      if (!result.success) {
        throw new Error(`AI note generation failed: ${result.error}`);
      }

      // Transform and validate the response
      const notesData = this.transformNotesResponse(result.data, dealId, contactId, communicationId);

      // Save notes to database
      await this.saveNotes(notesData);

      // Process action items and follow-ups
      await this.processActionItems(notesData);
      await this.processFollowUps(notesData);

      return notesData;
    } catch (error) {
      console.error('Automated note taking failed:', error);
      throw error;
    }
  }

  /**
   * Get notes for a communication
   */
  async getNotes(communicationId: string): Promise<AutomatedNote | null> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('automated_notes')
        .select('*')
        .eq('communication_id', communicationId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.transformDatabaseResult(data);
    } catch (error) {
      console.error('Failed to get notes:', error);
      return null;
    }
  }

  /**
   * Get all notes for a deal
   */
  async getDealNotes(dealId: string): Promise<AutomatedNote[]> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('automated_notes')
        .select('*')
        .eq('deal_id', dealId)
        .order('generated_at', { ascending: false });

      if (error) throw error;

      return data.map(item => this.transformDatabaseResult(item));
    } catch (error) {
      console.error('Failed to get deal notes:', error);
      return [];
    }
  }

  /**
   * Update action item status
   */
  async updateActionItem(actionItemId: string, status: string, notes?: string): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('action_items')
        .update(updateData)
        .eq('id', actionItemId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update action item:', error);
      throw error;
    }
  }

  /**
   * Update follow-up status
   */
  async updateFollowUp(followUpId: string, completed: boolean, notes?: string): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const updateData: any = {
        completed,
        updated_at: new Date().toISOString()
      };

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('follow_ups')
        .update(updateData)
        .eq('id', followUpId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update follow-up:', error);
      throw error;
    }
  }

  private transformNotesResponse(data: any, dealId: string, contactId: string, communicationId: string): AutomatedNote {
    return {
      id: `note_${Date.now()}_${Math.random()}`,
      dealId,
      contactId,
      communicationId,
      summary: data.summary || '',
      keyPoints: data.keyPoints || [],
      sentiment: this.validateSentiment(data.sentiment),
      actionItems: (data.actionItems || []).map((item: any) => ({
        id: item.id || `action_${Date.now()}_${Math.random()}`,
        description: item.description || '',
        priority: this.validatePriority(item.priority),
        assignee: item.assignee,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        status: 'pending' as const
      })),
      followUps: (data.followUps || []).map((follow: any) => ({
        id: follow.id || `follow_${Date.now()}_${Math.random()}`,
        type: this.validateFollowUpType(follow.type),
        description: follow.description || '',
        timing: follow.timing || '',
        priority: this.validatePriority(follow.priority)
      })),
      tags: data.tags || [],
      generatedAt: new Date(),
      confidence: Math.max(0, Math.min(100, data.confidence || 50)),
      aiProvider: 'openai'
    };
  }

  private validateSentiment(sentiment: string): AutomatedNote['sentiment'] {
    const validSentiments: AutomatedNote['sentiment'][] = ['positive', 'neutral', 'negative', 'mixed'];
    return validSentiments.includes(sentiment as any) ? sentiment as AutomatedNote['sentiment'] : 'neutral';
  }

  private validatePriority(priority: string): 'low' | 'medium' | 'high' {
    const validPriorities = ['low', 'medium', 'high'];
    return validPriorities.includes(priority) ? priority as 'low' | 'medium' | 'high' : 'medium';
  }

  private validateFollowUpType(type: string): 'email' | 'call' | 'meeting' | 'task' {
    const validTypes = ['email', 'call', 'meeting', 'task'];
    return validTypes.includes(type) ? type as 'email' | 'call' | 'meeting' | 'task' : 'email';
  }

  private transformDatabaseResult(data: any): AutomatedNote {
    return {
      id: data.id,
      dealId: data.deal_id,
      contactId: data.contact_id,
      communicationId: data.communication_id,
      summary: data.summary,
      keyPoints: data.key_points || [],
      sentiment: data.sentiment,
      actionItems: data.action_items || [],
      followUps: data.follow_ups || [],
      tags: data.tags || [],
      generatedAt: new Date(data.generated_at),
      confidence: data.confidence,
      aiProvider: data.ai_provider
    };
  }

  private async saveNotes(notes: AutomatedNote): Promise<void> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const dbData = {
        id: notes.id,
        deal_id: notes.dealId,
        contact_id: notes.contactId,
        communication_id: notes.communicationId,
        summary: notes.summary,
        key_points: notes.keyPoints,
        sentiment: notes.sentiment,
        action_items: notes.actionItems,
        follow_ups: notes.followUps,
        tags: notes.tags,
        generated_at: notes.generatedAt.toISOString(),
        confidence: notes.confidence,
        ai_provider: notes.aiProvider
      };

      const { error } = await supabase
        .from('automated_notes')
        .upsert(dbData, { onConflict: 'communication_id' });

      if (error) {
        console.error('Failed to save notes:', error);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }

  private async processActionItems(notes: AutomatedNote): Promise<void> {
    if (!notes.actionItems.length) return;

    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const actionItems = notes.actionItems.map(item => ({
        id: item.id,
        deal_id: notes.dealId,
        communication_id: notes.communicationId,
        description: item.description,
        priority: item.priority,
        assignee: item.assignee,
        due_date: item.dueDate?.toISOString(),
        status: item.status,
        created_at: notes.generatedAt.toISOString(),
        updated_at: notes.generatedAt.toISOString()
      }));

      const { error } = await supabase
        .from('action_items')
        .insert(actionItems);

      if (error) {
        console.error('Failed to save action items:', error);
      }
    } catch (error) {
      console.error('Failed to process action items:', error);
    }
  }

  private async processFollowUps(notes: AutomatedNote): Promise<void> {
    if (!notes.followUps.length) return;

    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      const followUps = notes.followUps.map(follow => ({
        id: follow.id,
        deal_id: notes.dealId,
        communication_id: notes.communicationId,
        type: follow.type,
        description: follow.description,
        timing: follow.timing,
        priority: follow.priority,
        completed: false,
        created_at: notes.generatedAt.toISOString(),
        updated_at: notes.generatedAt.toISOString()
      }));

      const { error } = await supabase
        .from('follow_ups')
        .insert(followUps);

      if (error) {
        console.error('Failed to save follow-ups:', error);
      }
    } catch (error) {
      console.error('Failed to process follow-ups:', error);
    }
  }

  /**
   * Get note taking statistics
   */
  async getStatistics(): Promise<{
    totalNotes: number;
    averageConfidence: number;
    sentimentDistribution: Record<string, number>;
    pendingActionItems: number;
    completedActionItems: number;
    pendingFollowUps: number;
  }> {
    try {
      const supabaseService = getSupabaseService();
      const supabase = (supabaseService as any).supabase;

      // Get notes stats
      const { data: notes, error: notesError } = await supabase
        .from('automated_notes')
        .select('sentiment, confidence');

      if (notesError) throw notesError;

      const totalNotes = notes.length;
      const averageConfidence = totalNotes > 0
        ? notes.reduce((sum, item) => sum + item.confidence, 0) / totalNotes
        : 0;

      const sentimentDistribution = notes.reduce((acc, item) => {
        acc[item.sentiment] = (acc[item.sentiment] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get action items stats
      const { data: actionItems, error: actionError } = await supabase
        .from('action_items')
        .select('status');

      if (actionError) throw actionError;

      const pendingActionItems = actionItems.filter(item => item.status === 'pending').length;
      const completedActionItems = actionItems.filter(item => item.status === 'completed').length;

      // Get follow-ups stats
      const { data: followUps, error: followError } = await supabase
        .from('follow_ups')
        .select('completed');

      if (followError) throw followError;

      const pendingFollowUps = followUps.filter(item => !item.completed).length;

      return {
        totalNotes,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        sentimentDistribution,
        pendingActionItems,
        completedActionItems,
        pendingFollowUps
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalNotes: 0,
        averageConfidence: 0,
        sentimentDistribution: {},
        pendingActionItems: 0,
        completedActionItems: 0,
        pendingFollowUps: 0
      };
    }
  }
}

// Singleton instance
let automatedNoteTakingService: AutomatedNoteTakingService | null = null;

export const getAutomatedNoteTakingService = (): AutomatedNoteTakingService => {
  if (!automatedNoteTakingService) {
    automatedNoteTakingService = new AutomatedNoteTakingService();
  }
  return automatedNoteTakingService;
};