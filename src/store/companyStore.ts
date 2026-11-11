import { create } from 'zustand';
import { notifyIfPermissionDenied } from '../utils/permissionToast';
import type { Company, Deal } from '../types';
import type { Contact } from '../types/contact';
import * as companyService from '../services/companyService';
import type { CompanyDraft } from '../services/companyService';

interface CompanyStore {
  companies: Record<string, Company>;
  isLoading: boolean;
  error: string | null;
  search: (q: string) => Promise<Company[]>;
  getById: (id: string) => Promise<Company | null>;
  create: (name: string, extra?: CompanyDraft) => Promise<Company>;
  update: (id: string, updates: Partial<Omit<Company, 'id'>>) => Promise<Company>;
  listRelated: (id: string) => Promise<{ deals: Deal[]; contacts: Contact[] }>;
}

const put = (map: Record<string, Company>, list: Company[]) => {
  const next = { ...map };
  list.forEach(c => { next[c.id] = c; });
  return next;
};

export const useCompanyStore = create<CompanyStore>((set, get) => ({
  companies: {},
  isLoading: false,
  error: null,

  search: async (q) => {
    set({ isLoading: true });
    try {
      const list = await companyService.search(q);
      set(s => ({ companies: put(s.companies, list), isLoading: false, error: null }));
      return list;
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Company search failed' });
      return [];
    }
  },

  getById: async (id) => {
    const cached = get().companies[id];
    if (cached) return cached;
    const c = await companyService.getById(id);
    if (c) set(s => ({ companies: put(s.companies, [c]) }));
    return c;
  },

  create: async (name, extra) => {
    const c = await companyService.create(name, extra);
    set(s => ({ companies: put(s.companies, [c]), error: null }));
    return c;
  },

  update: async (id, updates) => {
    const prev = get().companies[id];
    if (prev) set(s => ({ companies: put(s.companies, [{ ...prev, ...updates, id }]) })); // optimistic
    try {
      const c = await companyService.update(id, updates);
      set(s => ({ companies: put(s.companies, [c]) }));
      return c;
    } catch (e) {
      if (prev) set(s => ({ companies: put(s.companies, [prev]) }));
      notifyIfPermissionDenied(e, 'edit', 'company');
      throw e;
    }
  },

  listRelated: (id) => companyService.listRelated(id, get().companies[id]?.name),
}));
