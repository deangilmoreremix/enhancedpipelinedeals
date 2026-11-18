import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UndoToasts } from './UndoToasts';

let root: Root | null = null;

/** Mounts the undo toast stack once, in its own React root on document.body (works on every route). */
export function mountUndoHost(): void {
  if (root || typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.setAttribute('data-undo-host', '');
  document.body.appendChild(el);
  root = createRoot(el);
  root.render(<UndoToasts />);
}
