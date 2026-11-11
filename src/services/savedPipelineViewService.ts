import { supabase, isSupabaseConfigured } from './supabaseService';
import { assertRowsAffected } from '../utils/rlsError';
import { notifyIfPermissionDenied } from '../utils/permissionToast';
import { isDemoMode } from '../config/demoMode';
import type { ViewFilter, ViewSort, AdvancedFilterGroup } from '../types';

export type SavedViewType = 'board' | 'kanban' | 'table' | 'list' | 'calendar' | 'timeline' | 'dashboard';

/** Shape stored in saved_pipeline_views.filters (legacy arrays / `{filters: []}` are normalised on read). */
export interface SavedViewFilters {
  conditions: ViewFilter[];
  groups: AdvancedFilterGroup[];
  search: string;
  favoritesOnly: boolean;
}

/** Row of public.saved_pipeline_views (the single canonical saved-views table). */
export interface SavedPipelineView {
  id: string;
  user_id: string | null;
  name: string;
  description?: string;
  view_type: SavedViewType;
  /** jsonb: normally a SavedViewFilters object; older rows may hold an array. */
  filters: any;
  /** jsonb: ViewSort[] */
  sorting: any;
  group_by: string | null;
  columns: any;
  is_default: boolean;
  is_public: boolean;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export type NewSavedPipelineView = Omit<SavedPipelineView, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'usage_count' | 'tags' | 'is_public' | 'group_by' | 'is_default'> &
  Partial<Pick<SavedPipelineView, 'user_id' | 'usage_count' | 'tags' | 'is_public' | 'group_by' | 'is_default'>>;

const TABLE = 'saved_pipeline_views';
const LOCAL_KEY = 'pipeline_saved_views_v1';

const useRemote = (): boolean => Boolean(isSupabaseConfigured) && !isDemoMode();

/** Coerce any stored filters value into SavedViewFilters. */
export function normalizeSavedFilters(raw: any): SavedViewFilters {
  const empty: SavedViewFilters = { conditions: [], groups: [], search: '', favoritesOnly: false };
  if (!raw) return empty;
  if (Array.isArray(raw)) return { ...empty, conditions: raw as ViewFilter[] };
  if (typeof raw !== 'object') return empty;
  const conditions = Array.isArray(raw.conditions) ? raw.conditions : Array.isArray(raw.filters) ? raw.filters : [];
  return {
    conditions,
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    search: typeof raw.search === 'string' ? raw.search : '',
    favoritesOnly: Boolean(raw.favoritesOnly)
  };
}

export function normalizeSavedSorting(raw: any): ViewSort[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(s => s && typeof s.field === 'string')
    .map((s, i) => ({ field: s.field, direction: s.direction === 'desc' ? 'desc' : 'asc', priority: typeof s.priority === 'number' ? s.priority : i }));
}

const normalizeRow = (row: any): SavedPipelineView => ({
  id: String(row.id),
  user_id: row.user_id ?? null,
  name: row.name ?? 'Untitled view',
  description: row.description ?? undefined,
  view_type: row.view_type ?? 'board',
  filters: row.filters ?? {},
  sorting: row.sorting ?? [],
  group_by: row.group_by ?? null,
  columns: row.columns ?? [],
  is_default: Boolean(row.is_default),
  is_public: Boolean(row.is_public),
  tags: Array.isArray(row.tags) ? row.tags : [],
  usage_count: Number(row.usage_count ?? 0),
  created_at: row.created_at ?? new Date().toISOString(),
  updated_at: row.updated_at ?? new Date().toISOString()
});

// ---- local (demo / unauthenticated) storage ---------------------------------
const readLocal = (): SavedPipelineView[] => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeRow) : [];
  } catch {
    return [];
  }
};
const writeLocal = (views: SavedPipelineView[]): void => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCAL_KEY, JSON.stringify(views));
  } catch {
    /* storage unavailable */
  }
};
const localId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Current authenticated user id (null in demo / signed-out sessions). */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Service for managing saved pipeline views (table: saved_pipeline_views).
 * Falls back to localStorage when Supabase is not configured or demo mode is on.
 */
export class SavedPipelineViewService {
  /** Own views + public views + shared (user_id null) views, default first, then by name. */
  static async getAllViews(): Promise<SavedPipelineView[]> {
    try {
      if (!useRemote()) {
        return readLocal().sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name));
      }
      const userId = await currentUserId();
      let query = supabase.from(TABLE).select('*');
      query = userId
        ? query.or(`user_id.eq.${userId},is_public.eq.true,user_id.is.null`)
        : query.or('user_id.is.null,is_public.eq.true');
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data ?? []).map(normalizeRow).sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching saved pipeline views:', error);
      return [];
    }
  }

  static async getViewById(id: string): Promise<SavedPipelineView | null> {
    try {
      if (!useRemote()) return readLocal().find(v => v.id === id) ?? null;
      const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
      if (error) throw error;
      return data ? normalizeRow(data) : null;
    } catch (error) {
      console.error('Error fetching saved pipeline view:', error);
      return null;
    }
  }

  /** Create a view owned by the current user. Returns null when it could not be saved (e.g. duplicate name). */
  static async createView(view: NewSavedPipelineView): Promise<SavedPipelineView | null> {
    try {
      const now = new Date().toISOString();
      if (!useRemote()) {
        const all = readLocal();
        if (all.some(v => v.name.toLowerCase() === view.name.trim().toLowerCase())) return null;
        const row = normalizeRow({ ...view, name: view.name.trim(), id: localId(), user_id: null, created_at: now, updated_at: now });
        writeLocal([...all, row]);
        return row;
      }
      const userId = view.user_id !== undefined ? view.user_id : await currentUserId();
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          name: view.name.trim(),
          description: view.description ?? null,
          view_type: view.view_type,
          filters: view.filters ?? {},
          sorting: view.sorting ?? [],
          group_by: view.group_by ?? null,
          columns: view.columns ?? [],
          is_default: view.is_default ?? false,
          is_public: view.is_public ?? false,
          tags: view.tags ?? [],
          usage_count: view.usage_count ?? 0,
          user_id: userId
        })
        .select()
        .single();
      if (error) throw error;
      return normalizeRow(data);
    } catch (error) {
      console.error('Error creating saved pipeline view:', error);
      return null;
    }
  }

  static async updateView(id: string, updates: Partial<SavedPipelineView>): Promise<boolean> {
    try {
      const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
      delete patch.id;
      delete patch.created_at;
      delete patch.user_id;
      if (!useRemote()) {
        const all = readLocal();
        const idx = all.findIndex(v => v.id === id);
        if (idx < 0) return false;
        if (typeof patch.name === 'string' && all.some(v => v.id !== id && v.name.toLowerCase() === (patch.name as string).trim().toLowerCase())) return false;
        all[idx] = normalizeRow({ ...all[idx], ...patch });
        writeLocal(all);
        return true;
      }
      const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('id');
      if (error) throw error;
      if (Array.isArray(data)) assertRowsAffected(data);
      return true;
    } catch (error) {
      notifyIfPermissionDenied(error, 'manage_views', 'view');
      console.error('Error updating saved pipeline view:', error);
      return false;
    }
  }

  static async renameView(id: string, name: string): Promise<boolean> {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return this.updateView(id, { name: trimmed });
  }

  static async deleteView(id: string): Promise<boolean> {
    try {
      if (!useRemote()) {
        writeLocal(readLocal().filter(v => v.id !== id));
        return true;
      }
      const { data, error } = await supabase.from(TABLE).delete().eq('id', id).select('id');
      if (error) throw error;
      if (Array.isArray(data)) assertRowsAffected(data);
      return true;
    } catch (error) {
      notifyIfPermissionDenied(error, 'manage_views', 'view');
      console.error('Error deleting saved pipeline view:', error);
      return false;
    }
  }

  /** Make `id` the (single) default view for its owner. */
  static async setDefaultView(id: string): Promise<boolean> {
    try {
      if (!useRemote()) {
        writeLocal(readLocal().map(v => ({ ...v, is_default: v.id === id })));
        return true;
      }
      const userId = await currentUserId();
      let clear = supabase.from(TABLE).update({ is_default: false }).eq('is_default', true);
      clear = userId ? clear.eq('user_id', userId) : clear.is('user_id', null);
      await clear;
      const { error } = await supabase.from(TABLE).update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting default view:', error);
      return false;
    }
  }

  static async clearDefaultView(id: string): Promise<boolean> {
    return this.updateView(id, { is_default: false });
  }

  static async getDefaultView(): Promise<SavedPipelineView | null> {
    const views = await this.getAllViews();
    return views.find(v => v.is_default) ?? null;
  }

  static async setPublic(id: string, isPublic: boolean): Promise<boolean> {
    return this.updateView(id, { is_public: isPublic });
  }

  static async incrementUsage(id: string): Promise<void> {
    const view = await this.getViewById(id);
    if (view) await this.updateView(id, { usage_count: (view.usage_count ?? 0) + 1 });
  }

  /** Save the current view configuration under a new name. */
  static async saveCurrentView(
    name: string,
    viewType: string,
    filters: any,
    sorting: any,
    columns: any,
    extras: { groupBy?: string | null; isPublic?: boolean; description?: string; tags?: string[] } = {}
  ): Promise<SavedPipelineView | null> {
    return this.createView({
      name,
      view_type: viewType as SavedViewType,
      filters,
      sorting,
      columns,
      group_by: extras.groupBy ?? null,
      is_public: extras.isPublic ?? false,
      description: extras.description,
      tags: extras.tags ?? [],
      is_default: false
    });
  }
}

// Export convenience functions
export const getAllViews = SavedPipelineViewService.getAllViews.bind(SavedPipelineViewService);
export const getViewById = SavedPipelineViewService.getViewById.bind(SavedPipelineViewService);
export const createView = SavedPipelineViewService.createView.bind(SavedPipelineViewService);
export const updateView = SavedPipelineViewService.updateView.bind(SavedPipelineViewService);
export const renameView = SavedPipelineViewService.renameView.bind(SavedPipelineViewService);
export const deleteView = SavedPipelineViewService.deleteView.bind(SavedPipelineViewService);
export const setDefaultView = SavedPipelineViewService.setDefaultView.bind(SavedPipelineViewService);
export const clearDefaultView = SavedPipelineViewService.clearDefaultView.bind(SavedPipelineViewService);
export const getDefaultView = SavedPipelineViewService.getDefaultView.bind(SavedPipelineViewService);
export const setViewPublic = SavedPipelineViewService.setPublic.bind(SavedPipelineViewService);
export const incrementViewUsage = SavedPipelineViewService.incrementUsage.bind(SavedPipelineViewService);
export const saveCurrentView = SavedPipelineViewService.saveCurrentView.bind(SavedPipelineViewService);
