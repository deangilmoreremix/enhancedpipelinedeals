import { create } from 'zustand';
import { Deal, PipelineStage } from '../types';
import { getSupabaseService } from '../services/supabaseService';
import { getDataSyncService } from '../services/dataSyncService';
import {
  getStages,
  subscribe as subscribeStages,
  DEFAULT_STAGES,
  createStage as createStageRow,
  updateStage as updateStageRow,
  reorderStages as reorderStageRows,
  deleteStage as deleteStageRow
} from '../services/pipelineStageService';
import { computeDropPosition, needsRebalance, rebalance } from '../utils/boardPositions';
import { isDemoMode } from '../config/demoMode';
import { validateSchema, dealValidationSchema, sanitizeInput } from '../utils/validation';
import { emitDealEvent } from '../services/dealEvents';

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
  /** Move many deals to the end of `stageKey` (optimistic, each persisted). Returns ids that moved. */
  bulkMoveDeals: (ids: string[], stageKey: string) => Promise<string[]>;
  /** Apply the same field updates to many deals (optimistic, each persisted). Returns ids that succeeded. */
  bulkUpdateDeals: (ids: string[], updates: Partial<Deal>) => Promise<string[]>;
  /** Soft delete many deals. Returns ids that were deleted. */
  bulkSoftDelete: (ids: string[]) => Promise<string[]>;
  /** Re-space positions of a stage in one batched write when gaps have collapsed. */
  rebalanceStage: (stageKey: string) => Promise<void>;

  // Stage management (optimistic; persisted when connected)
  addStage: (name: string) => Promise<PipelineStage | null>;
  updateStage: (key: string, updates: Partial<Omit<PipelineStage, 'id' | 'key'>>) => Promise<boolean>;
  reorderStages: (keysInOrder: string[]) => Promise<boolean>;
  removeStage: (key: string, moveToKey: string) => Promise<boolean>;
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
  const positions = Object.values(deals)
    .filter(d => d.stage === stageKey && d.id !== excludeId)
    .map(d => d.position ?? 0)
    .sort((a, b) => a - b);
  return computeDropPosition(positions, index);
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
      // Connected mode: the DB trigger writes workflow_events (server runner + realtime handle it).
      // Local/demo mode has no database, so notify browser workflows directly.
      if (!shouldPersist(state.isConnectedToDatabase)) emitDealEvent({ type: 'created', deal: newDeal });
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
      emitDealEvent({ type: 'updated', id, before: originalDeal ?? {}, after: sanitizedUpdates });
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
    } catch (error) {
      console.error('Failed to move deal, rolling back:', error);
      set(st => ({ deals: { ...st.deals, [id]: original }, error: 'Failed to move deal' }));
      return false;
    }

    // Post-move hooks never block or fail the move
    if (original.stage !== stageKey) {
      void (async () => {
        try {
          const { workflowTriggerService } = await import('../services/workflowTriggerService');
          const moved = get().deals[id] ?? { ...original, stage: stageKey, position };
          await workflowTriggerService.handleStageChanged('deal', id, original.stage, stageKey, moved);
        } catch (error) {
          console.warn('Stage-change automation failed (move kept):', error);
        }
      })();
    }
    try {
      const col = Object.values(get().deals).filter(d => d.stage === stageKey);
      if (needsRebalance(col.map(d => d.position ?? 0))) await get().rebalanceStage(stageKey);
    } catch (error) {
      console.warn('Rebalance failed (move kept):', error);
    }
    return true;
  },

  rebalanceStage: async (stageKey) => {
    const state = get();
    const col = Object.values(state.deals)
      .filter(d => d.stage === stageKey)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt.getTime() - b.createdAt.getTime());
    if (col.length === 0) return;
    const updates = rebalance(col.map(d => d.id));
    const previous = Object.fromEntries(col.map(d => [d.id, d.position]));
    set(st => {
      const next = { ...st.deals };
      updates.forEach(u => { if (next[u.id]) next[u.id] = { ...next[u.id], position: u.position }; });
      return { deals: next };
    });
    if (!shouldPersist(state.isConnectedToDatabase)) return;
    try {
      // One batched round of writes for the whole column
      await Promise.all(updates.map(u => getDataSyncService().updateDeal(u.id, { position: u.position })));
    } catch (error) {
      set(st => {
        const next = { ...st.deals };
        Object.entries(previous).forEach(([did, pos]) => { if (next[did]) next[did] = { ...next[did], position: pos }; });
        return { deals: next, error: 'Failed to rebalance column' };
      });
      throw error;
    }
  },

  bulkMoveDeals: async (ids, stageKey) => {
    const base = maxPosition(get().deals, stageKey);
    const results = await Promise.all(ids.map((id, i) =>
      get().moveDeal(id, stageKey, base + 1 + i).then(ok => (ok ? id : null))));
    return results.filter((x): x is string => x !== null);
  },

  bulkUpdateDeals: async (ids, updates) => {
    const results = await Promise.all(ids.map(id =>
      get().updateDeal(id, updates).then(() => id, () => null)));
    return results.filter((x): x is string => x !== null);
  },

  bulkSoftDelete: async (ids) => {
    const results = await Promise.all(ids.map(id =>
      get().softDeleteDeal(id).then(() => id, () => null)));
    return results.filter((x): x is string => x !== null);
  },

  addStage: async (name) => {
    const state = get();
    const trimmed = sanitizeInput(name).trim();
    if (!trimmed) return null;
    const base = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'stage';
    let key = base;
    for (let i = 2; state.stages.some(s => s.key === key); i++) key = `${base}-${i}`;
    const draft: Omit<PipelineStage, 'id'> = {
      key, name: trimmed, color: 'gray', visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null,
      position: state.stages.reduce((m, s) => Math.max(m, s.position), -1) + 1
    };
    try {
      const created = shouldPersist(state.isConnectedToDatabase) ? await createStageRow(draft) : { ...draft, id: key };
      set(st => ({ stages: [...st.stages, created].sort((a, b) => a.position - b.position) }));
      return created;
    } catch (error) {
      console.error('Failed to add stage:', error);
      set({ error: 'Failed to add stage' });
      return null;
    }
  },

  updateStage: async (key, updates) => {
    const state = get();
    const original = state.stages.find(s => s.key === key);
    if (!original) return false;
    const apply = (patch: Partial<PipelineStage>) =>
      set(st => ({ stages: st.stages.map(s => (s.key === key ? { ...s, ...patch } : s)) }));
    apply(updates);
    try {
      if (shouldPersist(state.isConnectedToDatabase)) await updateStageRow(key, updates);
      return true;
    } catch (error) {
      console.error('Failed to update stage, rolling back:', error);
      apply(original);
      set({ error: 'Failed to update stage' });
      return false;
    }
  },

  reorderStages: async (keysInOrder) => {
    const state = get();
    const previous = state.stages;
    const byKey = new Map(previous.map(s => [s.key, s]));
    const reordered = keysInOrder.map((k, position) => ({ ...byKey.get(k)!, position })).filter(s => s.key);
    const rest = previous.filter(s => !keysInOrder.includes(s.key)).map((s, i) => ({ ...s, position: reordered.length + i }));
    set({ stages: [...reordered, ...rest] });
    try {
      if (shouldPersist(state.isConnectedToDatabase)) {
        await reorderStageRows([...reordered, ...rest].map(s => s.key));
      }
      return true;
    } catch (error) {
      console.error('Failed to reorder stages, rolling back:', error);
      set({ stages: previous, error: 'Failed to reorder stages' });
      return false;
    }
  },

  removeStage: async (key, moveToKey) => {
    const state = get();
    if (key === moveToKey || !state.stages.some(s => s.key === moveToKey)) return false;
    const prevStages = state.stages;
    const prevDeals = state.deals;
    const base = maxPosition(state.deals, moveToKey);
    let n = 0;
    set(st => {
      const deals = { ...st.deals };
      Object.values(deals)
        .filter(d => d.stage === key)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(d => { deals[d.id] = { ...d, stage: moveToKey, position: base + 1 + n++ }; });
      return { deals, stages: st.stages.filter(s => s.key !== key) };
    });
    try {
      if (shouldPersist(state.isConnectedToDatabase)) await deleteStageRow(key, moveToKey);
      return true;
    } catch (error) {
      console.error('Failed to delete stage, rolling back:', error);
      set({ stages: prevStages, deals: prevDeals, error: 'Failed to delete stage' });
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