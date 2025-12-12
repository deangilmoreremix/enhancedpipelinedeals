/**
 * Persona Service - Custom SDR Persona Management
 * Allows users to create, customize, and manage SDR personas
 */

import { SDRPersona } from './smartAIOrchestrator';
import { getSupabaseService } from './supabaseService';
import { getMonitoringService } from './monitoringService';

export interface CustomPersona extends SDRPersona {
  userId: string;
  isDefault?: boolean;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaTemplate {
  id: string;
  name: string;
  description: string;
  basePersona: Partial<SDRPersona>;
  customizationOptions: {
    tone: string[];
    focus: string[];
    style: string[];
  };
}

class PersonaService {
  private monitoring = getMonitoringService();

  // Predefined persona templates for easy creation
  private readonly PERSONA_TEMPLATES: PersonaTemplate[] = [
    {
      id: 'hunter',
      name: 'The Hunter',
      description: 'Aggressive, competitive approach focused on closing deals quickly',
      basePersona: {
        tone: 'confident, direct, competitive',
        ideal_segments: ['enterprise', 'high-growth startups'],
        email_style: 'short with strong urgency',
        communication_focus: ['competitive advantage', 'limited time offers', 'ROI focus']
      },
      customizationOptions: {
        tone: ['confident', 'aggressive', 'competitive', 'urgent'],
        focus: ['closing', 'competition', 'urgency', 'ROI'],
        style: ['direct', 'challenging', 'value-driven', 'time-sensitive']
      }
    },
    {
      id: 'nurturer',
      name: 'The Nurturer',
      description: 'Relationship-focused approach emphasizing trust and long-term partnership',
      basePersona: {
        tone: 'empathetic, educational, relationship-focused',
        ideal_segments: ['B2B', 'professional services'],
        email_style: 'story-driven with value insights',
        communication_focus: ['pain points', 'success stories', 'long-term partnership']
      },
      customizationOptions: {
        tone: ['empathetic', 'educational', 'supportive', 'trust-building'],
        focus: ['relationships', 'education', 'success stories', 'partnership'],
        style: ['conversational', 'insightful', 'helpful', 'storytelling']
      }
    },
    {
      id: 'consultant',
      name: 'The Consultant',
      description: 'Expert advisory approach positioning as trusted industry consultant',
      basePersona: {
        tone: 'informative, consultative, thought-leadership',
        ideal_segments: ['technology', 'consulting', 'finance'],
        email_style: 'insight-driven with industry trends',
        communication_focus: ['industry insights', 'best practices', 'strategic guidance']
      },
      customizationOptions: {
        tone: ['informative', 'consultative', 'authoritative', 'insightful'],
        focus: ['expertise', 'insights', 'strategy', 'industry trends'],
        style: ['analytical', 'advisory', 'thought-leadership', 'data-driven']
      }
    }
  ];

  /**
   * Get all available persona templates
   */
  getPersonaTemplates(): PersonaTemplate[] {
    return this.PERSONA_TEMPLATES;
  }

  /**
   * Create a custom persona from a template
   */
  async createPersonaFromTemplate(
    templateId: string,
    customizations: Partial<SDRPersona>,
    userId: string
  ): Promise<CustomPersona> {
    const template = this.PERSONA_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error('Persona template not found');
    }

    const basePersona = template.basePersona;
    const customPersona: Omit<CustomPersona, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      name: customizations.name || `${template.name} (Custom)`,
      tone: customizations.tone || basePersona.tone || 'professional',
      ideal_segments: customizations.ideal_segments || basePersona.ideal_segments || [],
      email_style: customizations.email_style || basePersona.email_style || 'professional',
      communication_focus: customizations.communication_focus || basePersona.communication_focus || [],
      isDefault: false,
      usageCount: 0
    };

    return await this.saveCustomPersona(customPersona);
  }

  /**
   * Create a completely custom persona
   */
  async createCustomPersona(
    personaData: Omit<CustomPersona, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<CustomPersona> {
    const customPersona = {
      ...personaData,
      userId,
      isDefault: false,
      usageCount: 0
    };

    return await this.saveCustomPersona(customPersona);
  }

  /**
   * Save a custom persona to the database
   */
  private async saveCustomPersona(
    personaData: Omit<CustomPersona, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomPersona> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('custom_personas')
      .insert({
        ...personaData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save custom persona:', error);
      throw new Error('Failed to save persona');
    }

    this.monitoring.trackUserAction(
      'persona_created',
      'PersonaService',
      { personaId: data.id, templateUsed: personaData.name?.includes('Custom') },
      personaData.userId
    );

    return data as CustomPersona;
  }

  /**
   * Get all custom personas for a user
   */
  async getUserPersonas(userId: string): Promise<CustomPersona[]> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('custom_personas')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user personas:', error);
      return [];
    }

    return (data || []) as CustomPersona[];
  }

  /**
   * Update a custom persona
   */
  async updatePersona(
    personaId: string,
    updates: Partial<Omit<CustomPersona, 'id' | 'userId' | 'createdAt'>>
  ): Promise<CustomPersona> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('custom_personas')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', personaId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update persona:', error);
      throw new Error('Failed to update persona');
    }

    return data as CustomPersona;
  }

  /**
   * Delete a custom persona
   */
  async deletePersona(personaId: string, userId: string): Promise<void> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const { error } = await supabase
      .from('custom_personas')
      .delete()
      .eq('id', personaId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to delete persona:', error);
      throw new Error('Failed to delete persona');
    }

    this.monitoring.trackUserAction(
      'persona_deleted',
      'PersonaService',
      { personaId },
      userId
    );
  }

  /**
   * Set a persona as default for the user
   */
  async setDefaultPersona(personaId: string, userId: string): Promise<void> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    // First, unset all default personas for this user
    await supabase
      .from('custom_personas')
      .update({ is_default: false })
      .eq('user_id', userId);

    // Then set the selected persona as default
    const { error } = await supabase
      .from('custom_personas')
      .update({ is_default: true })
      .eq('id', personaId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to set default persona:', error);
      throw new Error('Failed to set default persona');
    }
  }

  /**
   * Get the default persona for a user
   */
  async getDefaultPersona(userId: string): Promise<CustomPersona | null> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('custom_personas')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data as CustomPersona;
  }

  /**
   * Track persona usage for analytics
   */
  async trackPersonaUsage(personaId: string, userId: string, task: string): Promise<void> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    // Increment usage count
    await supabase.rpc('increment_persona_usage', { persona_id: personaId });

    // Log usage event
    this.monitoring.trackUserAction(
      'persona_used',
      'PersonaService',
      { personaId, task },
      userId
    );
  }

  /**
   * Get persona usage analytics
   */
  async getPersonaAnalytics(userId: string): Promise<any> {
    const personas = await this.getUserPersonas(userId);

    const analytics = {
      totalPersonas: personas.length,
      mostUsed: personas.reduce((prev, current) =>
        (prev.usageCount || 0) > (current.usageCount || 0) ? prev : current
      ),
      defaultPersona: personas.find(p => p.isDefault),
      usageByPersona: personas.map(p => ({
        id: p.id,
        name: p.name,
        usageCount: p.usageCount || 0
      }))
    };

    return analytics;
  }

  /**
   * Clone an existing persona for customization
   */
  async clonePersona(personaId: string, userId: string, newName: string): Promise<CustomPersona> {
    const supabaseService = getSupabaseService();
    const supabase = (supabaseService as any).supabase;

    // Get the original persona
    const { data: original, error: fetchError } = await supabase
      .from('custom_personas')
      .select('*')
      .eq('id', personaId)
      .single();

    if (fetchError || !original) {
      throw new Error('Original persona not found');
    }

    // Create the clone
    const cloneData = {
      ...original,
      name: newName,
      user_id: userId,
      is_default: false,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    delete cloneData.id;

    const { data, error } = await supabase
      .from('custom_personas')
      .insert(cloneData)
      .select()
      .single();

    if (error) {
      console.error('Failed to clone persona:', error);
      throw new Error('Failed to clone persona');
    }

    return data as CustomPersona;
  }
}

// Singleton instance
let personaServiceInstance: PersonaService | null = null;

export const getPersonaService = (): PersonaService => {
  if (!personaServiceInstance) {
    personaServiceInstance = new PersonaService();
  }
  return personaServiceInstance;
};

// Types are exported inline with their declarations