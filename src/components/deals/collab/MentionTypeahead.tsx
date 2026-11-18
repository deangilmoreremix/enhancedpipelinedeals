import React from 'react';
import type { DirectoryUser } from '../../../types';
import type { MentionSuggestionState } from './MentionExtension';

export interface MentionTypeaheadProps {
  state: MentionSuggestionState;
  users: DirectoryUser[];
  activeIndex: number;
  onPick: (user: DirectoryUser) => void;
  onHover: (index: number) => void;
}

/** Popup list for the "@" typeahead; positioned at the caret (fixed) when coordinates are known. */
export const MentionTypeahead: React.FC<MentionTypeaheadProps> = ({ state, users, activeIndex, onPick, onHover }) => {
  const style: React.CSSProperties = state.rect
    ? { position: 'fixed', left: state.rect.left, top: state.rect.bottom + 4 }
    : { position: 'absolute', left: 8, top: 40 };
  return (
    <ul
      role="listbox"
      aria-label="Mention a teammate"
      style={style}
      className="z-50 max-h-56 w-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      {users.length === 0 && <li className="px-2 py-2 text-xs text-gray-500">No matching teammates</li>}
      {users.map((u, i) => (
        <li key={u.id} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onPick(u); }}
            onMouseEnter={() => onHover(i)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-900 dark:text-white ${i === activeIndex ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700 dark:bg-gray-600 dark:text-gray-100">
              {u.name.charAt(0).toUpperCase()}
            </span>
            {u.name}
          </button>
        </li>
      ))}
    </ul>
  );
};
