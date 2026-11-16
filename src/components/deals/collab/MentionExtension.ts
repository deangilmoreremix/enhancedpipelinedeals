import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface MentionSuggestionState {
  query: string;
  /** Document range of "@query" to replace when a user is picked. */
  range: { from: number; to: number };
  /** Caret position in viewport coordinates, for placing the popup. */
  rect: { left: number; bottom: number } | null;
}

export interface MentionOptions {
  /** Called whenever the "@query" under the caret appears, changes or goes away (null). */
  onSuggestion: (state: MentionSuggestionState | null) => void;
  /** Return true to swallow the key (arrow/enter/tab/escape while the list is open). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const TRIGGER = /(?:^|\s)@([^\s@]{0,30})$/;

/** Finds "@query" ending at the caret. Exported for tests. */
export function matchMentionTrigger(textBeforeCaret: string): { query: string; length: number } | null {
  const m = TRIGGER.exec(textBeforeCaret);
  return m ? { query: m[1], length: m[1].length + 1 } : null;
}

export const mentionPluginKey = new PluginKey('noteMention');

/** Inline @mention atom ({id,label}) with a typeahead trigger driven by the host component. */
export const Mention = Node.create<MentionOptions>({
  name: 'mention',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addOptions() {
    return { onSuggestion: () => undefined, onKeyDown: () => false };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: el => el.getAttribute('data-id'),
        renderHTML: attrs => (attrs.id ? { 'data-id': attrs.id } : {}),
      },
      label: {
        default: null,
        parseHTML: el => el.getAttribute('data-label'),
        renderHTML: attrs => (attrs.label ? { 'data-label': attrs.label } : {}),
      },
    };
  },

  parseHTML() { return [{ tag: 'span[data-mention]' }]; },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-mention': '', class: 'mention-chip rounded bg-blue-100 px-1 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' }, HTMLAttributes),
      `@${node.attrs.label ?? ''}`,
    ];
  },

  renderText({ node }) { return `@${node.attrs.label ?? ''}`; },

  addProseMirrorPlugins() {
    const opts = this.options;
    let active = false;
    let lastKey = '';
    return [
      new Plugin({
        key: mentionPluginKey,
        view() {
          const check = (view: import('@tiptap/pm/view').EditorView) => {
            const { selection } = view.state;
            let next: MentionSuggestionState | null = null;
            if (selection.empty && view.editable) {
              const $from = selection.$from;
              const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 32), $from.parentOffset, undefined, '￼');
              const m = matchMentionTrigger(before);
              if (m) {
                let rect: MentionSuggestionState['rect'] = null;
                try { const c = view.coordsAtPos($from.pos); rect = { left: c.left, bottom: c.bottom }; } catch { /* jsdom */ }
                next = { query: m.query, range: { from: $from.pos - m.length, to: $from.pos }, rect };
              }
            }
            const key = next ? `${next.range.from}:${next.query}` : '';
            if (key === lastKey) return;
            lastKey = key;
            active = !!next;
            opts.onSuggestion(next);
          };
          return { update: check, destroy: () => { if (active) opts.onSuggestion(null); } };
        },
        props: {
          handleKeyDown(_view, event) { return active ? opts.onKeyDown(event) : false; },
        },
      }),
    ];
  },
});
