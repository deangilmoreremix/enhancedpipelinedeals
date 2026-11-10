import { create } from 'zustand';
import { Deal, PipelineStage } from '../types';
import { getSupabaseService } from '../services/supabaseService';
import { getDataSyncService } from '../services/dataSyncService';
import { getStages, subscribe as subscribeStages, DEFAULT_STAGES } from '../services/pipelineStageService';
import { isDemoMode } from '../config/demoMode';
import { validateSchema, dealValidationSchema, sanitizeInput } from '../utils/validation';

interface DealStore {
  deals: Record<string, Deal>;
  /** Soft-deleted deals kept so they can be restored (undo). Not part of `deals`. */
  trash: Record<string, Deal>;
  stages: PipelineStage[];
  isLoading: boolean;
  error: string | null;
  selectedDeal: Deal | null;
  isConnectedToDatabase: boolean;
  
  // Actions
  fetchDeals: () => Promise<void>;
  fetchStages: () => Promise<void>;
  getDeal: (id: string) => Deal | undefined;
  /** Optimistically move a deal to `stageKey` at fractional `position`; rolls back and returns false on failure. */
  moveDeal: (id: string, stageKey: string, position: number) => Promise<boolean>;
  softDeleteDeal: (id: string) => Promise<void>;
  restoreDeal: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  /** Subscribe to realtime deal + stage changes; returns an unsubscribe function. */
  subscribeRealtime: () => () => void;
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

/** Whether writes should hit the database (connected and not in demo mode). */
const shouldPersist = (connected: boolean) => connected && !isDemoMode();

const newLocalId = () => `deal-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/**
 * Fractional position for inserting at `index` within `stageKey` (ignoring `excludeId`).
 * Midpoint between neighbours; +1 after the last; first minus 1 at the front.
 */
export function positionForIndex(deals: Record<string, Deal>, stageKey: string, index: number, excludeId?: string): number {
  const col = Object.values(deals)
    .filter(d => d.stage === stageKey && d.id !== excludeId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (col.length === 0) return 1;
  if (index <= 0) return (col[0].position ?? 0) - 1;
  if (index >= col.length) return (col[col.length - 1].position ?? 0) + 1;
  return ((col[index - 1].position ?? 0) + (col[index].position ?? 0)) / 2;
}

/** Fractional position between two neighbours (either may be missing = list edge). */
export function positionBetween(before?: Deal, after?: Deal): number {
  const b = before?.position;
  const a = after?.position;
  if (before && after) return ((b ?? 0) + (a ?? 0)) / 2 === (b ?? 0) ? (b ?? 0) + 0.5 : ((b ?? 0) + (a ?? 0)) / 2;
  if (before) return (b ?? 0) + 1;
  if (after) return (a ?? 0) - 1;
  return 1;
}

const maxPosition = (deals: Record<string, Deal>, stageKey: string): number =>
  Object.values(deals).filter(d => d.stage === stageKey).reduce((m, d) => Math.max(m, d.position ?? 0), 0);

export const useDealStore = create<DealStore>((set, get) => ({
  deals: {},
  trash: {},
  stages: DEFAULT_STAGES,
  isLoading: false,
  error: null,
  selectedDeal: null,
  isConnectedToDatabase: false,

  fetchDeals: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await getDataSyncService().getDeals();
      const active: Record<string, Deal> = {};
      Object.values(result.data).forEach(d => { if (!d.deletedAt) active[d.id] = d; });
      set({
        deals: active,
        isLoading: false,
        isConnectedToDatabase: result.isFromDatabase,
        error: result.error ?? null
      });
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

  fetchStages: async () => {
    try {
      set({ stages: await getStages() });
    } catch (error) {
      console.warn('Failed to load stages, keeping current:', error);
    }
  },

  getDeal: (id) => get().deals[id],

  createDeal: async (dealData) => {
    // Validate deal data
    const validation = validateSchema(dealData, dealValidationSchema);
    if (!validation.isValid) {
      const errorMessage = `Validation failed: ${validation.error}`;
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
      const withPosition = {
        ...sanitizedData,
        position: sanitizedData.position ?? maxPosition(state.deals, sanitizedData.stage) + 1
      };

      let newDeal: Deal;
      if (shouldPersist(state.isConnectedToDatabase)) {
        newDeal = await getDataSyncService().createDeal(withPosition);
      } else {
        const now = new Date();
        newDeal = { ...withPosition, id: newLocalId(), createdAt: now, updatedAt: now } as Deal;
      }

      set(st => ({ deals: { ...st.deals, [newDeal.id]: newDeal }, isLoading: false }));
      return newDeal;
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
        const errorMessage = `Validation failed: ${validation.error}`;
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
      error: null
    }));

    try {
      if (shouldPersist(state.isConnectedToDatabase)) {
        const updatedDeal = await getDataSyncService().updateDeal(id, sanitizedUpdates);
        // Merge server response over the optimistic copy (server rows may omit unselected fields)
        const merged = { ...optimisticDeal, ...updatedDeal };
        set(state => ({ deals: { ...state.deals, [id]: merged } }));
        return merged;
      }
      return optimisticDeal;
    } catch (error) {
      // Revert optimistic update on error
      set(state => ({
        deals: originalDeal
          ? { ...state.deals, [id]: originalDeal }
          : (({ [id]: _removed, ...rest }) => rest)(state.deals),
        error: 'Failed to update deal'
      }));
      throw error;
    }
  },

  moveDeal: async (id, stageKey, position) => {
    const state = get();
    const original = state.deals[id];
    if (!original) return false;

    set(st => ({
      deals: { ...st.deals, [id]: { ...original, stage: stageKey, position, updatedAt: new Date() } },
      error: null
    }));

    try {
      if (shouldPersist(state.isConnectedToDatabase)) {
        await getDataSyncService().updateDeal(id, { stage: stageKey, position });
      }
      return true;
    } catch (error) {
      console.error('Failed to move deal, rolling back:', error);
      set(st => ({ deals: { ...st.deals, [id]: original }, error: 'Failed to move deal' }));
      return false;
    }
  },

  softDeleteDeal: async (id) => {
    const state = get();
    const original = state.deals[id];
    if (!original) return;
    const deletedAt = new Date();
    set(st => {
      const { [id]: _removed, ...rest } = st.deals;
      return { deals: rest, trash: { ...st.trash, [id]: { ...original, deletedAt } }, error: null };
    });
    try {
      if (shouldPersist(state.isConnectedToDatabase)) {
        await getDataSyncService().updateDeal(id, { deletedAt });
      }
    } catch (error) {
      set(st => {
        const { [id]: _t, ...restTrash } = st.trash;
        return { deals: { ...st.deals, [id]: original }, trash: restTrash, error: 'Failed to delete deal' };
      });
      throw error;
    }
  },

  restoreDeal: async (id) => {
    const state = get();
    const trashed = state.trash[id];
    if (!trashed) return;
    const { deletedAt: _d, ...rest } = trashed;
    const restored: Deal = { ...rest, deletedAt: null };
    set(st => {
      const { [id]: _t, ...restTrash } = st.trash;
      return { deals: { ...st.deals, [id]: restored }, trash: restTrash, error: null };
    });
    try {
      if (shouldPersist(state.isConnectedToDatabase)) {
        await getDataSyncService().updateDeal(id, { deletedAt: null });
      }
    } catch (error) {
      set(st => {
        const { [id]: _r, ...restDeals } = st.deals;
        return { deals: restDeals, trash: { ...st.trash, [id]: trashed }, error: 'Failed to restore deal' };
      });
      throw error;
    }
  },

  toggleFavorite: async (id) => {
    const deal = get().deals[id];
    if (!deal) return;
    await get().updateDeal(id, { isFavorite: !deal.isFavorite });
  },

  subscribeRealtime: () => {
    if (!getDataSyncService().isDatabaseConnected() || isDemoMode()) return () => {};
    const sub = getSupabaseService().subscribeToDeals((payload: any) => {
      const { eventType, new: next, old } = payload;
      if (eventType === 'DELETE') {
        set(st => {
          const { [old.id]: _x, ...rest } = st.deals;
          return { deals: rest };
        });
      } else if (next?.id) {
        const deal = next as Deal;
        set(st => {
          if (deal.deletedAt) {
            const { [deal.id]: _x, ...rest } = st.deals;
            return { deals: rest, trash: { ...st.trash, [deal.id]: deal } };
          }
          return { deals: { ...st.deals, [deal.id]: deal } };
        });
      }
    });
    const unsubStages = subscribeStages(() => { void get().fetchStages(); });
    return () => {
      sub?.unsubscribe?.();
      unsubStages();
    };
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