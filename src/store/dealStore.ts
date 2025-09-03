import { create } from 'zustand';
import { Deal } from '../types';
import { getSupabaseService } from '../services/supabaseService';

interface DealStore {
  deals: Record<string, Deal>;
  isLoading: boolean;
  error: string | null;
  selectedDeal: Deal | null;
  isConnectedToDatabase: boolean;

  // Actions
  fetchDeals: () => Promise<void>;
  createDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Deal>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<Deal>;
  deleteDeal: (id: string) => Promise<void>;
  selectDeal: (deal: Deal | null) => void;

  // Enhanced features
  toggleFavorite: (dealId: string) => Promise<void>;
  findNewImage: (dealId: string) => Promise<string>;
  aiEnrichDeal: (dealId: string, enrichmentData: any) => Promise<Deal>;
  importDeals: (deals: any[]) => Promise<void>;
}

export const useDealStore = create<DealStore>((set, get) => ({
  deals: {},
  isLoading: false,
  error: null,
  selectedDeal: null,
  isConnectedToDatabase: false,

  fetchDeals: async () => {
    set({ isLoading: true, error: null });
    try {
      const supabase = getSupabaseService();
      const deals = await supabase.getDeals();
      const dealsMap = deals.reduce((acc, deal) => {
        acc[deal.id] = deal;
        return acc;
      }, {} as Record<string, Deal>);
      set({ deals: dealsMap, isLoading: false, isConnectedToDatabase: true });
    } catch (error) {
      console.error('Failed to load deals:', error);
      set({
        deals: {},
        isLoading: false,
        isConnectedToDatabase: false,
        error: 'Failed to load deals - please check your database configuration'
      });
    }
  },

  createDeal: async (dealData) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();

      if (state.isConnectedToDatabase) {
        const supabase = getSupabaseService();
        const newDeal = await supabase.createDeal(dealData);

        set(state => ({
          deals: { ...state.deals, [newDeal.id]: newDeal },
          isLoading: false
        }));

        return newDeal;
      } else {
        throw new Error('Database not connected - cannot create deal');
      }
    } catch (error) {
      set({ error: 'Failed to create deal', isLoading: false });
      throw error;
    }
  },

  updateDeal: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();

      if (state.isConnectedToDatabase) {
        const supabase = getSupabaseService();
        const updatedDeal = await supabase.updateDeal(id, updates);

        set(state => ({
          deals: { ...state.deals, [id]: updatedDeal },
          isLoading: false
        }));

        return updatedDeal;
      } else {
        throw new Error('Database not connected - cannot update deal');
      }
    } catch (error) {
      set({ error: 'Failed to update deal', isLoading: false });
      throw error;
    }
  },

  deleteDeal: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();

      if (state.isConnectedToDatabase) {
        const supabase = getSupabaseService();
        await supabase.deleteDeal(id);
      }

      set(state => {
        const newDeals = { ...state.deals };
        delete newDeals[id];
        return {
          deals: newDeals,
          isLoading: false
        };
      });
    } catch (error) {
      set({ error: 'Failed to delete deal', isLoading: false });
      throw error;
    }
  },

  selectDeal: (deal) => {
    set({ selectedDeal: deal });
  },

  toggleFavorite: async (dealId) => {
    const { updateDeal } = get();
    const deal = get().deals[dealId];
    if (deal) {
      await updateDeal(dealId, {
        isFavorite: !deal.isFavorite
      });
    }
  },

  findNewImage: async (dealId) => {
    const { updateDeal } = get();
    const deal = get().deals[dealId];
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Simulate API call to find new image
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate a new avatar with a different seed
    const newSeed = Date.now().toString();
    const newAvatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${newSeed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444&textColor=ffffff`;

    await updateDeal(dealId, {
      companyAvatar: newAvatarUrl
    });

    return newAvatarUrl;
  },

  aiEnrichDeal: async (dealId, enrichmentData) => {
    const { updateDeal } = get();
    const deal = get().deals[dealId];
    if (!deal) {
      throw new Error('Deal not found');
    }

    const updates: Partial<Deal> = {
      lastEnrichment: {
        confidence: enrichmentData.confidence || 75,
        aiProvider: enrichmentData.aiProvider || 'AI Assistant',
        timestamp: new Date()
      }
    };

    // Apply other updates from enrichment data
    if (enrichmentData.value) updates.value = enrichmentData.value;
    if (enrichmentData.probability) updates.probability = enrichmentData.probability;
    if (enrichmentData.notes) {
      updates.notes = deal.notes
        ? `${deal.notes}\n\nAI Research: ${enrichmentData.notes}`
        : `AI Research: ${enrichmentData.notes}`;
    }

    const updatedDeal = await updateDeal(dealId, updates);
    return updatedDeal;
  },

  importDeals: async (deals) => {
    set({ isLoading: true, error: null });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newDealsMap: Record<string, Deal> = {};
      deals.forEach((dealData, index) => {
        const newDeal: Deal = {
          id: `imported-deal-${Date.now()}-${index}`,
          title: dealData.title || 'Imported Deal',
          company: dealData.company || 'Unknown Company',
          contact: dealData.contact || dealData.contactName || '',
          contactId: dealData.contactId,
          value: dealData.value || 0,
          stage: dealData.stage || 'qualification',
          probability: dealData.probability || 30,
          priority: dealData.priority || 'medium',
          dueDate: dealData.dueDate ? new Date(dealData.dueDate) : undefined,
          notes: dealData.notes,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: dealData.tags || [],
          customFields: dealData.customFields || {}
        };
        newDealsMap[newDeal.id] = newDeal;
      });

      set(state => ({
        deals: { ...state.deals, ...newDealsMap },
        isLoading: false
      }));
    } catch (error) {
      set({ error: 'Failed to import deals', isLoading: false });
      throw error;
    }
  }
}));