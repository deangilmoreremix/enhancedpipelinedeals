import { create } from 'zustand';
import { Contact } from '../types/contact';
import { getSupabaseService } from '../services/supabaseService';
import { getDataSyncService } from '../services/dataSyncService';
import { validateSchema, contactValidationSchema, sanitizeInput, normalizeEmail, normalizePhoneNumber } from '../utils/validation';

interface ContactStore {
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  selectedContact: Contact | null;
  isConnectedToDatabase: boolean;
  
  // Actions
  fetchContacts: () => Promise<void>;
  createContact: (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Contact>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  selectContact: (contact: Contact | null) => void;
  
  // Team management
  addTeamMember: (contactId: string, role?: Contact['role']) => Promise<void>;
  removeTeamMember: (contactId: string) => Promise<void>;
  updateTeamMemberStats: (contactId: string, stats: Partial<Contact['gamificationStats']>) => Promise<void>;
  
  // New methods for enhanced features
  toggleFavorite: (contactId: string) => Promise<void>;
  findNewImage: (contactId: string) => Promise<string>;
  aiEnrichContact: (contactId: string, enrichmentData: any) => Promise<Contact>;
  importContacts: (contacts: any[]) => Promise<void>;
}

export const useContactStore = create<ContactStore>((set, get) => ({
  contacts: [],
  isLoading: false,
  error: null,
  selectedContact: null,
  isConnectedToDatabase: false,

  fetchContacts: async () => {
    set({ isLoading: true, error: null });
    try {
      const dataSyncService = getDataSyncService();
      const contactsResult = await dataSyncService.getContacts();

      set({
        contacts: contactsResult.data,
        isLoading: false,
        isConnectedToDatabase: contactsResult.isFromDatabase,
        error: contactsResult.error || null
      });
    } catch (error) {
      console.error('Failed to load contacts:', error);
      set({
        contacts: [],
        isLoading: false,
        isConnectedToDatabase: false,
        error: 'Failed to load contacts - please check your database configuration'
      });
    }
  },

  createContact: async (contactData) => {
    // Validate contact data
    const validation = validateSchema(contactData, contactValidationSchema);
    if (!validation.isValid) {
      const errorMessage = `Validation failed: ${validation.firstError}`;
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }

    // Sanitize input data
    const sanitizedData = {
      ...contactData,
      firstName: sanitizeInput(contactData.firstName),
      lastName: sanitizeInput(contactData.lastName),
      email: normalizeEmail(contactData.email),
      phone: contactData.phone ? normalizePhoneNumber(contactData.phone) : undefined,
      company: sanitizeInput(contactData.company),
      title: sanitizeInput(contactData.title),
      industry: contactData.industry ? sanitizeInput(contactData.industry) : undefined,
      notes: contactData.notes ? sanitizeInput(contactData.notes) : undefined
    };

    set({ isLoading: true, error: null });
    try {
      const dataSyncService = getDataSyncService();
      const newContact = await dataSyncService.createContact(sanitizedData);

      set(state => ({
        contacts: [...state.contacts, newContact],
        isLoading: false
      }));

      return newContact;
    } catch (error) {
      set({ error: 'Failed to create contact', isLoading: false });
      throw error;
    }
  },

  updateContact: async (id, updates) => {
    // Validate updates if they contain data
    if (Object.keys(updates).length > 0) {
      const validation = validateSchema(updates, contactValidationSchema);
      if (!validation.isValid) {
        const errorMessage = `Validation failed: ${validation.firstError}`;
        set({ error: errorMessage });
        throw new Error(errorMessage);
      }
    }

    // Sanitize updates
    const sanitizedUpdates: Partial<Contact> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (typeof value === 'string') {
        if (key === 'email') {
          (sanitizedUpdates as any)[key] = normalizeEmail(value);
        } else if (key === 'phone') {
          (sanitizedUpdates as any)[key] = normalizePhoneNumber(value);
        } else {
          (sanitizedUpdates as any)[key] = sanitizeInput(value);
        }
      } else {
        (sanitizedUpdates as any)[key] = value;
      }
    });

    set({ isLoading: true, error: null });
    try {
      const dataSyncService = getDataSyncService();
      const updatedContact = await dataSyncService.updateContact(id, sanitizedUpdates);

      set(state => ({
        contacts: state.contacts.map(contact =>
          contact.id === id ? updatedContact : contact
        ),
        isLoading: false
      }));

      return updatedContact;
    } catch (error) {
      set({ error: 'Failed to update contact', isLoading: false });
      throw error;
    }
  },

  deleteContact: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();
      
      if (state.isConnectedToDatabase) {
        const supabase = getSupabaseService();
        await supabase.deleteContact(id);
      }
      
      // Remove from local state
      set(state => ({
        contacts: state.contacts.filter(contact => contact.id !== id),
        isLoading: false
      }));
    } catch (error) {
      set({ error: 'Failed to delete contact', isLoading: false });
      throw error;
    }
  },

  selectContact: (contact) => {
    set({ selectedContact: contact });
  },

  // Team management functions
  addTeamMember: async (contactId, role = 'sales-rep') => {
    const { updateContact } = get();
    await updateContact(contactId, {
      isTeamMember: true,
      role,
      gamificationStats: {
        totalDeals: 0,
        totalRevenue: 0,
        winRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        points: 0,
        achievements: [],
        monthlyGoal: role === 'sales-rep' ? 50000 : role === 'manager' ? 100000 : 200000,
        monthlyProgress: 0
      }
    });
  },

  removeTeamMember: async (contactId) => {
    const { updateContact } = get();
    await updateContact(contactId, {
      isTeamMember: false,
      role: undefined,
      gamificationStats: undefined
    });
  },

  updateTeamMemberStats: async (contactId, stats) => {
    const contact = get().contacts.find(c => c.id === contactId);
    if (contact && contact.gamificationStats) {
      const { updateContact } = get();
      await updateContact(contactId, {
        gamificationStats: {
          ...contact.gamificationStats,
          ...stats
        }
      });
    }
  },
  
  // New methods for enhanced features
  toggleFavorite: async (contactId) => {
    const { updateContact } = get();
    const contact = get().contacts.find(c => c.id === contactId);
    if (contact) {
      await updateContact(contactId, {
        isFavorite: !contact.isFavorite
      });
    }
  },

  findNewImage: async (contactId) => {
    const { updateContact } = get();
    const contact = get().contacts.find(c => c.id === contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    // Simulate API call to find new image
    await new Promise(resolve => setTimeout(resolve, 800));
    // Generate a new avatar with a different seed
    const newSeed = Date.now().toString();
    const newAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`;

    await updateContact(contactId, {
      avatarSrc: newAvatarUrl
    });

    return newAvatarUrl;
  },

  aiEnrichContact: async (contactId, enrichmentData) => {
    const { updateContact } = get();
    const contact = get().contacts.find(c => c.id === contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const updates: Partial<Contact> = {
      lastEnrichment: {
        confidence: enrichmentData.confidence || 75,
        aiProvider: enrichmentData.aiProvider || 'AI Assistant',
        timestamp: new Date()
      }
    };

    // Apply other updates from enrichment data
    if (enrichmentData.phone) updates.phone = enrichmentData.phone;
    if (enrichmentData.industry) updates.industry = enrichmentData.industry;
    if (enrichmentData.title) updates.title = enrichmentData.title;
    if (enrichmentData.notes) {
      updates.notes = contact.notes
        ? `${contact.notes}\n\nAI Research: ${enrichmentData.notes}`
        : `AI Research: ${enrichmentData.notes}`;
    }

    const updatedContact = await updateContact(contactId, updates);
    return updatedContact;
  },

  importContacts: async (contacts) => {
    set({ isLoading: true, error: null });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newContacts: Contact[] = contacts.map((contactData, index) => ({
        id: `imported-contact-${Date.now()}-${index}`,
        name: contactData.name || `${contactData.firstName} ${contactData.lastName}`,
        firstName: contactData.firstName || contactData.name?.split(' ')[0] || '',
        lastName: contactData.lastName || contactData.name?.split(' ').slice(1).join(' ') || '',
        email: contactData.email,
        phone: contactData.phone,
        title: contactData.title,
        company: contactData.company,
        industry: contactData.industry,
        avatarSrc: contactData.avatarSrc,
        status: contactData.status as Contact['status'],
        interestLevel: contactData.interestLevel as Contact['interestLevel'],
        sources: contactData.sources || ['Manual Import'],
        notes: contactData.notes,
        tags: contactData.tags,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      set(state => ({
        contacts: [...state.contacts, ...newContacts],
        isLoading: false
      }));
    } catch (error) {
      set({ error: 'Failed to import contacts', isLoading: false });
      throw error;
    }
  }
}));