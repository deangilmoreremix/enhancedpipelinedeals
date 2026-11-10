import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Pencil, Plus, Trash2, Check, Loader2, FileText, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import {
  DealNote, createNote, deleteNote, isNotesLocalOnly, listNotes, updateNote,
} from '../../services/dealNotesService';
import { errorMessage } from '../../services/dealRecordShared';
import { pushToast } from '../../store/dealRecordStore';

export const NOTE_AUTOSAVE_MS = 800;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface NoteEditorProps {
  dealId: string;
  note: DealNote | null;
  onSaved: (note: DealNote) => void;
  onClose: () => void;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ dealId, note, onSaved, onClose }) => {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const idRef = useRef<string | null>(note?.id ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ body: unknown; bodyText: string } | null>(null);
  const inflight = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);

  const persist = useCallback(() => {
    const payload = latest.current;
    if (!payload) return inflight.current;
    latest.current = null;
    // Serialise saves so a pending create finishes before the follow-up update.
    inflight.current = inflight.current.then(async () => {
      if (mounted.current) setSaveState('saving');
      try {
        let saved: DealNote;
        if (idRef.current) {
          saved = await updateNote(dealId, idRef.current, payload);
        } else {
          if (!payload.bodyText.trim()) { if (mounted.current) setSaveState('idle'); return; }
          saved = await createNote(dealId, payload);
          idRef.current = saved.id;
        }
        onSaved(saved);
        if (mounted.current) setSaveState('saved');
      } catch (e) {
        if (mounted.current) setSaveState('error');
        pushToast('error', `Could not save note: ${errorMessage(e)}`);
      }
    });
    return inflight.current;
  }, [dealId, onSaved]);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Write a note...' })],
    content: (note?.body as object | null) ?? (note?.bodyText ? `<p>${note.bodyText.replace(/</g, '&lt;')}</p>` : ''),
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[8rem] px-3 py-2 focus:outline-none text-gray-900 dark:text-gray-100',
        'aria-label': 'Note body',
      },
    },
    onUpdate: ({ editor: ed }) => {
      latest.current = { body: ed.getJSON(), bodyText: ed.getText() };
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void persist(); }, NOTE_AUTOSAVE_MS);
    },
  });

  // Flush any pending edit when the editor is closed/unmounted.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      void persist();
    };
  }, [persist]);

  const btn = (active: boolean) =>
    `rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ${active ? 'bg-gray-200 dark:bg-gray-600' : ''}`;

  return (
    <div className="rounded-xl border border-blue-300 bg-white shadow-sm dark:border-blue-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Bold" className={btn(!!editor?.isActive('bold'))} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></button>
          <button type="button" aria-label="Italic" className={btn(!!editor?.isActive('italic'))} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></button>
          <button type="button" aria-label="Bullet list" className={btn(!!editor?.isActive('bulletList'))} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></button>
          <button type="button" aria-label="Numbered list" className={btn(!!editor?.isActive('orderedList'))} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          {saveState === 'saving' && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving...</span>}
          {saveState === 'saved' && <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><Check className="h-3 w-3" />Saved</span>}
          {saveState === 'error' && <span className="text-red-600 dark:text-red-400">Not saved</span>}
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close editor"><X className="mr-1 h-3.5 w-3.5" />Done</Button>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export interface DealNotesProps {
  dealId: string;
}

export const DealNotes: React.FC<DealNotesProps> = ({ dealId }) => {
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: string; note: DealNote | null } | null>(null);
  const localOnly = isNotesLocalOnly(dealId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotes(await listNotes(dealId));
    } catch (e) {
      setError(errorMessage(e, 'Failed to load notes'));
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { setEditing(null); void load(); }, [load]);

  const onSaved = useCallback((saved: DealNote) => {
    setNotes(prev => {
      const exists = prev.some(n => n.id === saved.id);
      const next = exists ? prev.map(n => (n.id === saved.id ? saved : n)) : [saved, ...prev];
      return next.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    });
  }, []);

  const remove = async (note: DealNote) => {
    if (!window.confirm('Delete this note?')) return;
    const before = notes;
    setNotes(prev => prev.filter(n => n.id !== note.id));
    try {
      await deleteNote(dealId, note.id);
    } catch (e) {
      setNotes(before);
      pushToast('error', `Could not delete note: ${errorMessage(e)}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
          <FileText className="mr-2 h-5 w-5 text-gray-500" />Notes
        </h4>
        <Button size="sm" onClick={() => setEditing({ key: `new-${Date.now()}`, note: null })} disabled={editing?.note === null && !!editing}>
          <Plus className="mr-1 h-4 w-4" />New note
        </Button>
      </div>

      {localOnly && (
        <Alert variant="info">
          <span className="text-sm">Notes are stored in this browser session only (Supabase is not connected or demo mode is on). They will be lost on reload.</span>
        </Alert>
      )}
      {error && <Alert variant="error"><span className="text-sm">{error}</span></Alert>}

      {editing && editing.note === null && (
        <NoteEditor key={editing.key} dealId={dealId} note={null} onSaved={onSaved} onClose={() => setEditing(null)} />
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading notes...</p>
      ) : notes.length === 0 && !editing ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center dark:border-gray-600">
          <FileText className="mx-auto mb-2 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map(n => (
            <li key={n.id}>
              {editing?.note?.id === n.id ? (
                <NoteEditor key={editing.key} dealId={dealId} note={editing.note} onSaved={onSaved} onClose={() => setEditing(null)} />
              ) : (
                <div className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {new Date(n.createdAt).toLocaleString()}
                      {n.updatedAt !== n.createdAt && new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 1500 && ' (edited)'}
                    </span>
                    <span className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button type="button" aria-label="Edit note" onClick={() => setEditing({ key: n.id, note: n })} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="h-4 w-4" /></button>
                      <button type="button" aria-label="Delete note" onClick={() => void remove(n)} className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-gray-200">{n.bodyText || 'Empty note'}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DealNotes;
