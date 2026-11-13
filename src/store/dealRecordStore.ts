import { create } from 'zustand';

export interface RecordToast {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

interface DealRecordStore {
  toasts: RecordToast[];
  pushToast: (type: RecordToast['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

/** Small UI store for the deal record page (toasts). Deal data itself lives in useDealStore. */
export const useDealRecordStore = create<DealRecordStore>((set) => ({
  toasts: [],
  pushToast: (type, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set(s => ({ toasts: [...s.toasts, { id, type, message }].slice(-4) }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 5000);
  },
  dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export const pushToast = (type: RecordToast['type'], message: string) =>
  useDealRecordStore.getState().pushToast(type, message);
