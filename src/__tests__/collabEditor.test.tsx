import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../services/supabaseService', () => ({ isSupabaseConfigured: false, supabase: {} }));
import { Mention, matchMentionTrigger, MentionSuggestionState } from '../components/deals/collab/MentionExtension';
import { NoteBody } from '../components/deals/collab/renderNoteBody';
import { extractMentions } from '../services/mentionService';

describe('matchMentionTrigger', () => {
  it('matches "@que" at start or after whitespace only', () => {
    expect(matchMentionTrigger('hello @sa')).toEqual({ query: 'sa', length: 3 });
    expect(matchMentionTrigger('@')).toEqual({ query: '', length: 1 });
    expect(matchMentionTrigger('mail me@x')).toBeNull();
    expect(matchMentionTrigger('@sam done')).toBeNull();
  });
});

describe('Mention extension', () => {
  it('reports the suggestion query as the user types "@" and inserts a mention node', () => {
    const seen: Array<MentionSuggestionState | null> = [];
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, Mention.configure({ onSuggestion: s => seen.push(s), onKeyDown: () => false })],
      content: '<p>hi </p>',
    });
    editor.commands.focus('end');
    editor.commands.insertContent(' @sa');
    const last = seen.filter(Boolean).pop();
    expect(last?.query).toBe('sa');

    editor.chain().insertContentAt(last!.range, [{ type: 'mention', attrs: { id: 'u1', label: 'Sam' } }, { type: 'text', text: ' ' }]).run();
    expect(extractMentions(editor.getJSON())).toEqual([{ id: 'u1', label: 'Sam' }]);
    expect(editor.getText()).toContain('@Sam');
    expect(editor.getHTML()).toContain('data-mention');
    editor.destroy();
  });
});

describe('NoteBody', () => {
  it('renders mentions as chips and falls back to plain text', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ping ' }, { type: 'mention', attrs: { id: 'u1', label: 'Sam' } }] }] };
    const { rerender } = render(<NoteBody body={body} fallback="ignored" />);
    expect(screen.getByTestId('mention-chip')).toHaveTextContent('@Sam');
    rerender(<NoteBody body={null} fallback="plain text" />);
    expect(screen.getByText('plain text')).toBeInTheDocument();
  });
});
