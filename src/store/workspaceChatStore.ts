import { create } from 'zustand';
import type { ChatMessage, Proposal } from '../services/workspaceChatService';

export type ProposalState = 'applied' | 'dismissed' | 'failed' | 'applying';

interface WorkspaceChatStore {
  open: boolean;
  messages: ChatMessage[];
  pending: boolean;
  /** Per-proposal outcome (message id + proposal id), so Apply cannot run twice. */
  states: Record<string, { state: ProposalState; message?: string }>;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  add: (m: ChatMessage) => void;
  setPending: (p: boolean) => void;
  setProposalState: (key: string, state: ProposalState, message?: string) => void;
  clear: () => void;
}

/** Chat history lives in memory for the session only (cleared on reload or with the Clear button). */
export const useWorkspaceChatStore = create<WorkspaceChatStore>((set) => ({
  open: false,
  messages: [],
  pending: false,
  states: {},
  setOpen: (open) => set({ open }),
  toggle: () => set(s => ({ open: !s.open })),
  add: (m) => set(s => ({ messages: [...s.messages, m] })),
  setPending: (pending) => set({ pending }),
  setProposalState: (key, state, message) => set(s => ({ states: { ...s.states, [key]: { state, message } } })),
  clear: () => set({ messages: [], states: {}, pending: false }),
}));

export const proposalKey = (messageId: string, p: Pick<Proposal, 'id'>): string => `${messageId}:${p.id}`;
