import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Contact } from '../types/contact';
import { Deal } from '../types';

interface Database {
  public: {
    Tables: {
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<Contact, 'id' | 'createdAt'>>;
      };
      deals: {
        Row: Deal;
        Insert: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>;
        Update: Partial<Omit<Deal, 'id' | 'createdAt'>>;
      };
      activities: {
        Row: {
          id: string;
          type: string;
          entity_type: 'contact' | 'deal';
          entity_id: string;
          description: string;
          metadata: any;
          created_at: string;
          user_id: string;
        };
        Insert: Omit<Database['public']['Tables']['activities']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['activities']['Row']>;
      };
      communication_records: {
        Row: {
          id: string;
          contact_id: string;
          deal_id: string | null;
          type: 'message' | 'call' | 'email' | 'meeting';
          direction: 'incoming' | 'outgoing';
          content: string | null;
          subject: string | null;
          duration: string | null;
          timestamp: string;
          status: string;
          metadata: any;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: Omit<Database['public']['Tables']['communication_records']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['communication_records']['Row']>;
      };
      communication_logs: {
        Row: {
          id: string;
          contact_id: string;
          deal_id: string | null;
          type: string;
          action: string;
          details: any;
          timestamp: string;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['communication_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['communication_logs']['Row']>;
      };
    };
  };
}

class SupabaseService {
  private supabase: SupabaseClient<Database>;
  private isConnected: boolean = false;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase configuration missing. Using demo mode.');
      this.isConnected = false;
      return;
    }

    try {
      this.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
      this.isConnected = true;
      console.log('✅ Supabase client initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize Supabase client:', error);
      this.isConnected = false;
    }
  }

  private async testConnection(): Promise<boolean> {
    if (!this.isConnected || !this.supabase) return false;
    
    try {
      // Test connection with a simple query
      const { error } = await this.supabase.from('contacts').select('id').limit(1);
      return !error;
    } catch (error) {
      console.warn('Database connection test failed:', error);
      return false;
    }
  }

  // Contact methods
  async getContacts(): Promise<Contact[]> {
    if (!this.isConnected || !this.supabase) {
      throw new Error('Supabase not configured - please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment');
    }

    try {
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed - please check your Supabase configuration');
      }

      const { data, error } = await this.supabase
        .from('contacts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }
      
      // Transform data to handle gamification_stats deserialization
      const contacts = (data || []).map(contact => ({
        ...contact,
        gamificationStats: contact.gamification_stats || undefined,
        isTeamMember: contact.is_team_member || false
      }));
      
      console.log(`✅ Loaded ${contacts.length} contacts from database`);
      return contacts;
    } catch (error) {
      console.error('Error loading contacts:', error);
      throw error;
    }
  }

  async createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    if (!this.isConnected || !this.supabase) {
      throw new Error('Supabase not configured - cannot create contact');
    }

    try {
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed - cannot create contact');
      }

      // Handle gamification_stats serialization
      const contactData: any = { ...contact };
      if (contact.gamificationStats) {
        contactData.gamification_stats = contact.gamificationStats;
        delete contactData.gamificationStats;
      }
      
      const { data, error } = await this.supabase
        .from('contacts')
        .insert({
          ...contactData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Created contact in database:', data.name);
      return data;
    } catch (error) {
      console.error('Failed to create contact in database:', error);
      throw error;
    }
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    if (!this.isConnected || !this.supabase) {
      throw new Error('Supabase not configured - cannot update contact');
    }

    try {
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed - cannot update contact');
      }

      // Handle gamification_stats serialization
      const updateData: any = { ...updates };
      if (updates.gamificationStats) {
        updateData.gamification_stats = updates.gamificationStats;
        delete updateData.gamificationStats;
      }
      
      const { data, error } = await this.supabase
        .from('contacts')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Updated contact in database:', data.name);
      return data;
    } catch (error) {
      console.error('Failed to update contact in database:', error);
      throw error;
    }
  }

  async deleteContact(id: string): Promise<void> {
    if (!this.isConnected || !this.supabase) {
      throw new Error('Supabase not configured - cannot delete contact');
    }

    try {
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed - cannot delete contact');
      }

      const { error } = await this.supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('✅ Deleted contact from database:', id);
    } catch (error) {
      console.error('Failed to delete contact from database:', error);
      throw error;
    }
  }

  async searchContacts(query: string): Promise<Contact[]> {
    if (!this.isConnected || !this.supabase) {
      throw new Error('Supabase not configured - cannot search contacts');
    }

    try {
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed - cannot search contacts');
      }

      const { data, error } = await this.supabase
        .from('contacts')
        .select('*')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Database search failed: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  // Deal methods
  async getDeals(): Promise<Deal[]> {
    if (!this.isConnected || !this.supabase) {
      throw new Error('Supabase not configured - cannot load deals');
    }

    try {
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed - cannot load deals');
      }

      const { data, error } = await this.supabase
        .from('deals')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }
      
      console.log(`✅ Loaded ${data?.length || 0} deals from database`);
      return data || [];
    } catch (error) {
      console.error('Error loading deals:', error);
      throw error;
    }
  }

  async createDeal(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    if (!this.isConnected || !this.supabase) {
      throw new Error('Supabase not configured - cannot create deal');
    }

    try {
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed - cannot create deal');
      }

      const { data, error } = await this.supabase
        .from('deals')
        .insert({
          ...deal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Created deal in database:', data.title);
      return data;
    } catch (error) {
      console.error('Failed to create deal in database:', error);
      throw error;
    }
  }

  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    const { data, error } = await this.supabase
      .from('deals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteDeal(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Activity tracking
  async logActivity(activity: {
    type: string;
    entity_type: 'contact' | 'deal';
    entity_id: string;
    description: string;
    metadata?: any;
    user_id: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('activities')
      .insert(activity);

    if (error) throw error;
  }

  async getActivities(entityType: 'contact' | 'deal', entityId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Real-time subscriptions
  subscribeToContacts(callback: (payload: any) => void) {
    return this.supabase
      .channel('contacts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, callback)
      .subscribe();
  }

  subscribeToDeals(callback: (payload: any) => void) {
    return this.supabase
      .channel('deals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, callback)
      .subscribe();
  }

  // Authentication helpers
  async getCurrentUser() {
    if (!this.isConnected || !this.supabase) {
      return null;
    }

    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  async signOut() {
    if (!this.isConnected || !this.supabase) {
      return;
    }

    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  // Utility methods
  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  async checkConnection(): Promise<boolean> {
    return await this.testConnection();
  }

  // App Settings methods
  async getSetting(key: string, userId?: string): Promise<any> {
    if (!this.isConnected || !this.supabase) {
      // Return defaults when not connected
      const defaults: Record<string, any> = {
        'default_deal_view': 'kanban',
        'table_columns': ['title', 'company', 'value', 'stage', 'probability'],
        'list_sort_by': 'updated',
        'list_sort_order': 'desc'
      };
      return defaults[key] || null;
    }

    try {
      let query = this.supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', key)
       .limit(1);

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

     return (data && data.length > 0) ? data[0].setting_value : null;
    } catch (error) {
      console.error('Failed to get setting:', error);
      return null;
    }
  }

  async saveSetting(key: string, value: any, userId?: string): Promise<void> {
    if (!this.isConnected || !this.supabase) {
      console.warn('Cannot save setting - Supabase not connected');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('app_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          user_id: userId || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: userId ? 'user_id,setting_key' : 'setting_key'
        });

      if (error) throw error;
      console.log('✅ Saved setting:', key, value);
    } catch (error) {
      console.error('Failed to save setting:', error);
      throw error;
    }
  }

  async deleteSetting(key: string, userId?: string): Promise<void> {
    if (!this.isConnected || !this.supabase) {
      console.warn('Cannot delete setting - Supabase not connected');
      return;
    }

    try {
      let query = this.supabase
        .from('app_settings')
        .delete()
        .eq('setting_key', key);

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }

      const { error } = await query;
      if (error) throw error;
      console.log('✅ Deleted setting:', key);
    } catch (error) {
      console.error('Failed to delete setting:', error);
      throw error;
    }
  }
}

// Singleton instance
let supabaseService: SupabaseService | null = null;

export const getSupabaseService = (): SupabaseService => {
  if (!supabaseService) {
    supabaseService = new SupabaseService();
  }
  return supabaseService;
};

export { SupabaseService };