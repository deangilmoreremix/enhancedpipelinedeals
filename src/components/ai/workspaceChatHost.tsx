import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useWorkspaceChatStore } from '../../store/workspaceChatStore';
import { WorkspaceChat } from './WorkspaceChat';

let root: Root | null = null;

/** Mounts the chat slide-over once in its own React root on document.body (so it works on every route without App.tsx). */
export function mountWorkspaceChat(): void {
  if (root || typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.setAttribute('data-workspace-chat-host', '');
  document.body.appendChild(el);
  root = createRoot(el);
  root.render(<WorkspaceChat />);
}

/** Opens (and lazily mounts) the Ask AI panel. */
export function openWorkspaceChat(): void {
  mountWorkspaceChat();
  useWorkspaceChatStore.getState().setOpen(true);
}

export function toggleWorkspaceChat(): void {
  mountWorkspaceChat();
  useWorkspaceChatStore.getState().toggle();
}
