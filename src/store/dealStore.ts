import { create } from 'zustand';
import { Deal } from '../types';
import { getSupabaseService } from '../services/supabaseService';
import { validateSchema, dealValidationSchema, sanitizeInput } from '../utils/validation';

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
  
  // Bulk operations
  importDeals: (deals: any[]) => Promise<void>;
  exportDeals: () => Promise<Deal[]>;
  
  // AI operations
  updateDealAIScore: (dealId: string, score: number, insights?: string[]) => Promise<void>;
  saveDealAnalysis: (dealId: string, analysis: any) => Promise<void>;
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
      const dealsArray = await supabase.getDeals();
      
      // Convert array to record for easier access
      const dealsRecord = dealsArray.reduce((acc, deal) => {
        acc[deal.id] = deal;
        return acc;
      }, {} as Record<string, Deal>);
      
      set({ deals: dealsRecord, isLoading: false, isConnectedToDatabase: true });
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
    // Validate deal data
    const validation = validateSchema(dealData, dealValidationSchema);
    if (!validation.isValid) {
      const errorMessage = `Validation failed: ${validation.firstError}`;
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }

    // Sanitize input data
    const sanitizedData = {
      ...dealData,
      title: dealData.title ? sanitizeInput(dealData.title) : undefined,
      company: sanitizeInput(dealData.company),
      contact: dealData.contact ? sanitizeInput(dealData.contact) : '',
      notes: dealData.notes ? sanitizeInput(dealData.notes) : undefined
    };

    set({ isLoading: true, error: null });
    try {
      const state = get();
      
      if (state.isConnectedToDatabase) {
        const supabase = getSupabaseService();
        const newDeal = await supabase.createDeal(sanitizedData);
        
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
    // Validate updates if they contain data
    if (Object.keys(updates).length > 0) {
      const validation = validateSchema(updates, dealValidationSchema);
      if (!validation.isValid) {
        const errorMessage = `Validation failed: ${validation.firstError}`;
        set({ error: errorMessage });
        throw new Error(errorMessage);
      }
    }

    // Sanitize updates
    const sanitizedUpdates: Partial<Deal> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (typeof value === 'string' && ['title', 'company', 'contact', 'notes'].includes(key)) {
        sanitizedUpdates[key as keyof Deal] = sanitizeInput(value) as any;
      } else {
        sanitizedUpdates[key as keyof Deal] = value as any;
      }
    });

    const state = get();
    const originalDeal = state.deals[id];

    // Optimistic update - immediately update UI
    const optimisticDeal = {
      ...originalDeal,
      ...sanitizedUpdates,
      updatedAt: new Date()
    };

    set(state => ({
      deals: { ...state.deals, [id]: optimisticDeal },
      isLoading: true,
      error: null
    }));

    try {
      if (state.isConnectedToDatabase) {
        const supabase = getSupabaseService();
        const updatedDeal = await supabase.updateDeal(id, sanitizedUpdates);

        // Update with server response
        set(state => ({
          deals: { ...state.deals, [id]: updatedDeal },
          isLoading: false
        }));

        return updatedDeal;
      } else {
        throw new Error('Database not connected - cannot update deal');
      }
    } catch (error) {
      // Revert optimistic update on error
      set(state => ({
        deals: { ...state.deals, [id]: originalDeal },
        error: 'Failed to update deal',
        isLoading: false
      }));
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
      
      // Remove from local state
      set(state => {
        const { [id]: removed, ...remainingDeals } = state.deals;
        return {
          deals: remainingDeals,
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

  importDeals: async (dealsData) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();
      
      if (state.isConnectedToDatabase) {
        const supabase = getSupabaseService();
        const importedDeals: Deal[] = [];
        
        for (const dealData of dealsData) {
          try {
            const newDeal = await supabase.createDeal(dealData);
            importedDeals.push(newDeal);
          } catch (error) {
            console.error('Failed to import deal:', dealData.title, error);
          }
        }
        
        // Update local state with imported deals
        const dealsRecord = importedDeals.reduce((acc, deal) => {
          acc[deal.id] = deal;
          return acc;
        }, {} as Record<string, Deal>);
        
        set(state => ({
          deals: { ...state.deals, ...dealsRecord },
          isLoading: false
        }));
      } else {
        throw new Error('Database not connected - cannot import deals');
      }
    } catch (error) {
      set({ error: 'Failed to import deals', isLoading: false });
      throw error;
    }
  },

  exportDeals: async () => {
    const state = get();
    return Object.values(state.deals);
  },

  updateDealAIScore: async (dealId, score, insights) => {
    const { updateDeal } = get();
    const deal = get().deals[dealId];
    
    if (deal) {
      const updates: Partial<Deal> = {
        aiScore: score
      };
      
      if (insights && insights.length > 0) {
        const aiInsights = insights.join('. ');
        updates.notes = deal.notes 
          ? `${deal.notes}\n\nAI Analysis: ${aiInsights}`
          : `AI Analysis: ${aiInsights}`;
      }
      
      await updateDeal(dealId, updates);
    }
  },

  saveDealAnalysis: async (dealId, analysis) => {
    const { updateDeal } = get();
    await updateDeal(dealId, {
      customFields: {
        ...get().deals[dealId]?.customFields,
        aiAnalysis: JSON.stringify(analysis),
        lastAnalyzed: new Date().toISOString()
      }
    });
  }
}));