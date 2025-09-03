import { Contact } from '../types/contact';
import { Deal } from '../types';
import { getSupabaseService } from './supabaseService';
import { mockContacts } from '../data/mockContacts';
import { mockDeals } from '../data/mockDeals';

export interface DataSyncResult<T> {
  data: T;
  isFromDatabase: boolean;
  error?: string;
}

export interface SyncStatus {
  contactsConnected: boolean;
  dealsConnected: boolean;
  contactsCount: number;
  dealsCount: number;
  lastSync: Date | null;
}

class DataSyncService {
  private syncStatus: SyncStatus = {
    contactsConnected: false,
    dealsConnected: false,
    contactsCount: 0,
    dealsCount: 0,
    lastSync: null
  };

  /**
   * Get contacts with fallback to mock data
   */
  async getContacts(): Promise<DataSyncResult<Contact[]>> {
    try {
      const supabase = getSupabaseService();

      // Check if Supabase is connected
      const isConnected = supabase.isConnectedToDatabase();

      if (isConnected) {
        const contacts = await supabase.getContacts();
        this.updateSyncStatus({ contactsConnected: true, contactsCount: contacts.length });
        return {
          data: contacts,
          isFromDatabase: true
        };
      } else {
        console.log('🔄 Using mock contacts data (Supabase not connected)');
        this.updateSyncStatus({ contactsConnected: false, contactsCount: mockContacts.length });
        return {
          data: mockContacts,
          isFromDatabase: false,
          error: 'Database not connected - showing demo data'
        };
      }
    } catch (error) {
      console.error('❌ Failed to load contacts:', error);
      this.updateSyncStatus({ contactsConnected: false, contactsCount: mockContacts.length });
      return {
        data: mockContacts,
        isFromDatabase: false,
        error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'} - showing demo data`
      };
    }
  }

  /**
   * Get deals with fallback to mock data
   */
  async getDeals(): Promise<DataSyncResult<Record<string, Deal>>> {
    try {
      const supabase = getSupabaseService();

      // Check if Supabase is connected
      const isConnected = supabase.isConnectedToDatabase();

      if (isConnected) {
        const deals = await supabase.getDeals();
        const dealsMap = deals.reduce((acc, deal) => {
          acc[deal.id] = deal;
          return acc;
        }, {} as Record<string, Deal>);

        this.updateSyncStatus({ dealsConnected: true, dealsCount: deals.length });
        return {
          data: dealsMap,
          isFromDatabase: true
        };
      } else {
        console.log('🔄 Using mock deals data (Supabase not connected)');
        this.updateSyncStatus({ dealsConnected: false, dealsCount: Object.keys(mockDeals).length });
        return {
          data: mockDeals,
          isFromDatabase: false,
          error: 'Database not connected - showing demo data'
        };
      }
    } catch (error) {
      console.error('❌ Failed to load deals:', error);
      this.updateSyncStatus({ dealsConnected: false, dealsCount: Object.keys(mockDeals).length });
      return {
        data: mockDeals,
        isFromDatabase: false,
        error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'} - showing demo data`
      };
    }
  }

  /**
   * Create contact - only if database is connected
   */
  async createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    const supabase = getSupabaseService();

    if (!supabase.isConnectedToDatabase()) {
      throw new Error('Cannot create contact - database not connected. Please configure Supabase first.');
    }

    const newContact = await supabase.createContact(contact);
    this.updateSyncStatus({ contactsCount: this.syncStatus.contactsCount + 1 });
    return newContact;
  }

  /**
   * Update contact - only if database is connected
   */
  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    const supabase = getSupabaseService();

    if (!supabase.isConnectedToDatabase()) {
      throw new Error('Cannot update contact - database not connected. Please configure Supabase first.');
    }

    return await supabase.updateContact(id, updates);
  }

  /**
   * Delete contact - only if database is connected
   */
  async deleteContact(id: string): Promise<void> {
    const supabase = getSupabaseService();

    if (!supabase.isConnectedToDatabase()) {
      throw new Error('Cannot delete contact - database not connected. Please configure Supabase first.');
    }

    await supabase.deleteContact(id);
    this.updateSyncStatus({ contactsCount: Math.max(0, this.syncStatus.contactsCount - 1) });
  }

  /**
   * Create deal - only if database is connected
   */
  async createDeal(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    const supabase = getSupabaseService();

    if (!supabase.isConnectedToDatabase()) {
      throw new Error('Cannot create deal - database not connected. Please configure Supabase first.');
    }

    const newDeal = await supabase.createDeal(deal);
    this.updateSyncStatus({ dealsCount: this.syncStatus.dealsCount + 1 });
    return newDeal;
  }

  /**
   * Update deal - only if database is connected
   */
  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    const supabase = getSupabaseService();

    if (!supabase.isConnectedToDatabase()) {
      throw new Error('Cannot update deal - database not connected. Please configure Supabase first.');
    }

    return await supabase.updateDeal(id, updates);
  }

  /**
   * Delete deal - only if database is connected
   */
  async deleteDeal(id: string): Promise<void> {
    const supabase = getSupabaseService();

    if (!supabase.isConnectedToDatabase()) {
      throw new Error('Cannot delete deal - database not connected. Please configure Supabase first.');
    }

    await supabase.deleteDeal(id);
    this.updateSyncStatus({ dealsCount: Math.max(0, this.syncStatus.dealsCount - 1) });
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Check if database is connected
   */
  isDatabaseConnected(): boolean {
    const supabase = getSupabaseService();
    return supabase.isConnectedToDatabase();
  }

  /**
   * Force refresh data from database
   */
  async refreshData(): Promise<void> {
    this.syncStatus.lastSync = new Date();

    // Refresh contacts
    try {
      await this.getContacts();
    } catch (error) {
      console.error('Failed to refresh contacts:', error);
    }

    // Refresh deals
    try {
      await this.getDeals();
    } catch (error) {
      console.error('Failed to refresh deals:', error);
    }
  }

  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    this.syncStatus = {
      ...this.syncStatus,
      ...updates,
      lastSync: new Date()
    };
  }
}

// Singleton instance
let dataSyncService: DataSyncService | null = null;

export const getDataSyncService = (): DataSyncService => {
  if (!dataSyncService) {
    dataSyncService = new DataSyncService();
  }
  return dataSyncService;
};

export { DataSyncService };