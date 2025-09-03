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

  // Local storage for user-created data when database is not available
  private localContacts: Contact[] = [];
  private localDeals: Record<string, Deal> = {};

  /**
   * Get contacts - combines mock data with user-created data
   */
  async getContacts(): Promise<DataSyncResult<Contact[]>> {
    try {
      const supabase = getSupabaseService();
      const isConnected = supabase.isConnectedToDatabase();

      let databaseContacts: Contact[] = [];
      let isFromDatabase = false;

      // Try to get contacts from database
      if (isConnected) {
        try {
          databaseContacts = await supabase.getContacts();
          isFromDatabase = true;
          this.updateSyncStatus({ contactsConnected: true });
        } catch (dbError) {
          console.warn('⚠️ Database contacts failed, falling back to local data:', dbError);
          this.updateSyncStatus({ contactsConnected: false });
        }
      }

      // Combine mock data with database data and local user-created data
      const allContacts = [...mockContacts, ...databaseContacts, ...this.localContacts];

      // Remove duplicates based on ID
      const uniqueContacts = allContacts.filter((contact, index, self) =>
        index === self.findIndex(c => c.id === contact.id)
      );

      const totalCount = uniqueContacts.length;
      this.updateSyncStatus({ contactsCount: totalCount });

      return {
        data: uniqueContacts,
        isFromDatabase,
        error: !isConnected ? 'Database not connected - showing demo data with local changes' : undefined
      };

    } catch (error) {
      console.error('❌ Failed to load contacts:', error);

      // Fallback to mock + local data
      const fallbackContacts = [...mockContacts, ...this.localContacts];
      const uniqueContacts = fallbackContacts.filter((contact, index, self) =>
        index === self.findIndex(c => c.id === contact.id)
      );

      this.updateSyncStatus({ contactsConnected: false, contactsCount: uniqueContacts.length });
      return {
        data: uniqueContacts,
        isFromDatabase: false,
        error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'} - showing demo data`
      };
    }
  }

  /**
   * Get deals - combines mock data with user-created data
   */
  async getDeals(): Promise<DataSyncResult<Record<string, Deal>>> {
    try {
      const supabase = getSupabaseService();
      const isConnected = supabase.isConnectedToDatabase();

      let databaseDeals: Record<string, Deal> = {};
      let isFromDatabase = false;

      // Try to get deals from database
      if (isConnected) {
        try {
          const dealsArray = await supabase.getDeals();
          databaseDeals = dealsArray.reduce((acc, deal) => {
            acc[deal.id] = deal;
            return acc;
          }, {} as Record<string, Deal>);
          isFromDatabase = true;
          this.updateSyncStatus({ dealsConnected: true });
        } catch (dbError) {
          console.warn('⚠️ Database deals failed, falling back to local data:', dbError);
          this.updateSyncStatus({ dealsConnected: false });
        }
      }

      // Combine mock data with database data and local user-created data
      const allDeals = { ...mockDeals, ...databaseDeals, ...this.localDeals };

      const totalCount = Object.keys(allDeals).length;
      this.updateSyncStatus({ dealsCount: totalCount });

      return {
        data: allDeals,
        isFromDatabase,
        error: !isConnected ? 'Database not connected - showing demo data with local changes' : undefined
      };

    } catch (error) {
      console.error('❌ Failed to load deals:', error);

      // Fallback to mock + local data
      const fallbackDeals = { ...mockDeals, ...this.localDeals };
      const totalCount = Object.keys(fallbackDeals).length;

      this.updateSyncStatus({ dealsConnected: false, dealsCount: totalCount });
      return {
        data: fallbackDeals,
        isFromDatabase: false,
        error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'} - showing demo data`
      };
    }
  }

  /**
   * Create contact - tries database first, falls back to local storage
   */
  async createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    const supabase = getSupabaseService();
    const isConnected = supabase.isConnectedToDatabase();

    // Generate ID and timestamps
    const now = new Date();
    const newContact: Contact = {
      ...contact,
      id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    };

    if (isConnected) {
      try {
        // Try to save to database
        const dbContact = await supabase.createContact(contact);
        console.log('✅ Contact saved to database:', dbContact.name);
        this.updateSyncStatus({ contactsCount: this.syncStatus.contactsCount + 1 });
        return dbContact;
      } catch (dbError) {
        console.warn('⚠️ Database save failed, storing locally:', dbError);
        // Fall through to local storage
      }
    }

    // Store locally if database is not available or failed
    this.localContacts.push(newContact);
    console.log('💾 Contact stored locally:', newContact.name);
    this.updateSyncStatus({ contactsCount: this.syncStatus.contactsCount + 1 });

    return newContact;
  }

  /**
   * Update contact - handles both database and local storage
   */
  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    const supabase = getSupabaseService();
    const isConnected = supabase.isConnectedToDatabase();

    // Check if this is a local contact
    const localContactIndex = this.localContacts.findIndex(c => c.id === id);

    if (localContactIndex >= 0) {
      // Update local contact
      const updatedContact = {
        ...this.localContacts[localContactIndex],
        ...updates,
        updatedAt: new Date()
      };
      this.localContacts[localContactIndex] = updatedContact;
      console.log('💾 Local contact updated:', updatedContact.name);
      return updatedContact;
    }

    if (isConnected) {
      try {
        // Try to update in database
        const updatedContact = await supabase.updateContact(id, updates);
        console.log('✅ Database contact updated:', updatedContact.name);
        return updatedContact;
      } catch (dbError) {
        console.warn('⚠️ Database update failed:', dbError);
        throw new Error('Failed to update contact in database');
      }
    }

    throw new Error('Contact not found and database not connected');
  }

  /**
   * Delete contact - handles both database and local storage
   */
  async deleteContact(id: string): Promise<void> {
    const supabase = getSupabaseService();
    const isConnected = supabase.isConnectedToDatabase();

    // Check if this is a local contact
    const localContactIndex = this.localContacts.findIndex(c => c.id === id);

    if (localContactIndex >= 0) {
      // Delete local contact
      const deletedContact = this.localContacts.splice(localContactIndex, 1)[0];
      console.log('💾 Local contact deleted:', deletedContact.name);
      this.updateSyncStatus({ contactsCount: Math.max(0, this.syncStatus.contactsCount - 1) });
      return;
    }

    if (isConnected) {
      try {
        // Try to delete from database
        await supabase.deleteContact(id);
        console.log('✅ Database contact deleted:', id);
        this.updateSyncStatus({ contactsCount: Math.max(0, this.syncStatus.contactsCount - 1) });
        return;
      } catch (dbError) {
        console.warn('⚠️ Database delete failed:', dbError);
        throw new Error('Failed to delete contact from database');
      }
    }

    throw new Error('Contact not found and database not connected');
  }

  /**
   * Create deal - tries database first, falls back to local storage
   */
  async createDeal(deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    const supabase = getSupabaseService();
    const isConnected = supabase.isConnectedToDatabase();

    // Generate ID and timestamps
    const now = new Date();
    const newDeal: Deal = {
      ...deal,
      id: `deal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now
    };

    if (isConnected) {
      try {
        // Try to save to database
        const dbDeal = await supabase.createDeal(deal);
        console.log('✅ Deal saved to database:', dbDeal.title);
        this.updateSyncStatus({ dealsCount: this.syncStatus.dealsCount + 1 });
        return dbDeal;
      } catch (dbError) {
        console.warn('⚠️ Database save failed, storing locally:', dbError);
        // Fall through to local storage
      }
    }

    // Store locally if database is not available or failed
    this.localDeals[newDeal.id] = newDeal;
    console.log('💾 Deal stored locally:', newDeal.title);
    this.updateSyncStatus({ dealsCount: this.syncStatus.dealsCount + 1 });

    return newDeal;
  }

  /**
   * Update deal - handles both database and local storage
   */
  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    const supabase = getSupabaseService();
    const isConnected = supabase.isConnectedToDatabase();

    // Check if this is a local deal
    if (this.localDeals[id]) {
      // Update local deal
      const updatedDeal = {
        ...this.localDeals[id],
        ...updates,
        updatedAt: new Date()
      };
      this.localDeals[id] = updatedDeal;
      console.log('💾 Local deal updated:', updatedDeal.title);
      return updatedDeal;
    }

    if (isConnected) {
      try {
        // Try to update in database
        const updatedDeal = await supabase.updateDeal(id, updates);
        console.log('✅ Database deal updated:', updatedDeal.title);
        return updatedDeal;
      } catch (dbError) {
        console.warn('⚠️ Database update failed:', dbError);
        throw new Error('Failed to update deal in database');
      }
    }

    throw new Error('Deal not found and database not connected');
  }

  /**
   * Delete deal - handles both database and local storage
   */
  async deleteDeal(id: string): Promise<void> {
    const supabase = getSupabaseService();
    const isConnected = supabase.isConnectedToDatabase();

    // Check if this is a local deal
    if (this.localDeals[id]) {
      // Delete local deal
      const deletedDeal = this.localDeals[id];
      delete this.localDeals[id];
      console.log('💾 Local deal deleted:', deletedDeal.title);
      this.updateSyncStatus({ dealsCount: Math.max(0, this.syncStatus.dealsCount - 1) });
      return;
    }

    if (isConnected) {
      try {
        // Try to delete from database
        await supabase.deleteDeal(id);
        console.log('✅ Database deal deleted:', id);
        this.updateSyncStatus({ dealsCount: Math.max(0, this.syncStatus.dealsCount - 1) });
        return;
      } catch (dbError) {
        console.warn('⚠️ Database delete failed:', dbError);
        throw new Error('Failed to delete deal from database');
      }
    }

    throw new Error('Deal not found and database not connected');
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