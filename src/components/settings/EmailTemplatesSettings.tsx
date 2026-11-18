import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { BTN, BTN_DANGER, BTN_PRIMARY } from '../ui/buttonStyles';
import {
  TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES, deleteTemplate, extractVariables, listTemplates, renderTemplate, saveTemplate, validateTemplate,
  type EmailTemplateInput, type EmailTemplateRow, type TemplateContext,
} from '../../services/emailTemplateService';
import { pushToast } from '../../store/dealRecordStore';
import { CARD, ErrorLine, INPUT, ReadOnlyNotice, SectionHeader, errText } from './settingsUi';

const SAMPLE: TemplateContext = {
  deal: { title: 'Acme Renewal', company: 'Acme Corp', value: 48000, contact: 'Jordan Lee', assignedTo: 'Sam Rivera', stage: 'negotiation' },
  contact: { name: 'Jordan Lee', firstName: 'Jordan' },
  now: new Date(),
};
const BLANK: EmailTemplateInput = { name: '', subject: '', body: '', category: 'general', is_snippet: false, shortcut: '' };

/** Template and snippet CRUD with {{variable}} help and a live preview against sample data. */
export const EmailTemplatesSettings: React.FC<{ canEdit?: boolean }> = ({ canEdit = true }) => {
  const [items, setItems] = useState<EmailTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<EmailTemplateInput>(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<EmailTemplateRow | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try { setItems(await listTemplates()); setError(null); } catch (e) { setError(errText(e, 'Could not load templates')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const edit = (t: EmailTemplateRow | null) => {
    setFormError(null);
    if (!t) { setEditingId('new'); setForm(BLANK); return; }
    setEditingId(t.id);
    setForm({ name: t.name, subject: t.subject, body: t.body, category: t.category, is_snippet: t.is_snippet, shortcut: t.shortcut ?? '' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateTemplate(form, items, editingId && editingId !== 'new' ? editingId : undefined);
    if (invalid) { setFormError(invalid); return; }
    setBusy(true);
    try {
      await saveTemplate(form, editingId && editingId !== 'new' ? editingId : undefined);
      pushToast('success', form.is_snippet ? 'Snippet saved' : 'Template saved');
      setEditingId(null);
      await load();
    } catch (err) { setFormError(errText(err, 'Could not save')); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await deleteTemplate(deleting.id); pushToast('success', `Deleted "${deleting.name}"`); if (editingId === deleting.id) setEditingId(null); setDeleting(null); await load(); } catch (e) { pushToast('error', errText(e, 'Could not delete')); } finally { setBusy(false); }
  };

  const insertVar = (key: string) => {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    if (!el) { setForm(f => ({ ...f, body: f.body + token })); return; }
    const s = el.selectionStart ?? form.body.length; const en = el.selectionEnd ?? s;
    setForm(f => ({ ...f, body: f.body.slice(0, s) + token + f.body.slice(en) }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
  };

  const preview = useMemo(() => ({
    subject: renderTemplate(form.subject, SAMPLE), body: renderTemplate(form.body, SAMPLE),
  }), [form.subject, form.body]);
  const unknownVars = useMemo(() => extractVariables(`${form.subject}\n${form.body}`).filter(v => !TEMPLATE_VARIABLES.some(t => t.key === v)), [form.subject, form.body]);

  return (
    <section aria-label="Email templates and snippets">
      <SectionHeader title="Email templates & snippets" description="Templates fill the composer; snippets are short blocks you insert by typing /shortcut."
        actions={canEdit && <button type="button" className={BTN_PRIMARY} onClick={() => edit(null)}><Plus className="h-4 w-4" />New</button>} />
      {!canEdit && <ReadOnlyNotice>Your role can view templates but not change them.</ReadOnlyNotice>}
      <ErrorLine message={error} />
      <div className="grid gap-4 lg:grid-cols-[18rem,1fr]">
        <ul className={`${CARD} space-y-1 !p-2`} aria-label="Templates">
          {loading && <li className="p-2 text-sm text-gray-600 dark:text-gray-400">Loading...</li>}
          {!loading && items.length === 0 && <li className="p-2 text-sm text-gray-600 dark:text-gray-400">Nothing here yet. Create your first template.</li>}
          {items.map(t => (
            <li key={t.id} className="flex items-center gap-1">
              <button type="button" onClick={() => edit(t)} aria-current={editingId === t.id ? 'true' : undefined}
                className={`flex-1 rounded-lg px-2 py-1.5 text-left text-sm ${editingId === t.id ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
                <span className="block font-medium">{t.name}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t.is_snippet ? `Snippet /${t.shortcut}` : 'Template'} - {t.category}</span>
              </button>
              {canEdit && <button type="button" className="rounded p-1 text-gray-400 hover:text-red-600" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>

        {editingId ? (
          <form onSubmit={e => void save(e)} className={`${CARD} space-y-3`} aria-label="Template editor">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="tpl-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input id="tpl-name" className={INPUT} value={form.name} disabled={!canEdit} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label htmlFor="tpl-cat" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <select id="tpl-cat" className={INPUT} value={form.category} disabled={!canEdit} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {[...new Set([...TEMPLATE_CATEGORIES, form.category])].map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}</select></div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={form.is_snippet} disabled={!canEdit} onChange={e => setForm({ ...form, is_snippet: e.target.checked })} />This is a snippet</label>
              {form.is_snippet && <div className="flex items-center gap-1"><label htmlFor="tpl-shortcut" className="text-sm text-gray-700 dark:text-gray-300">Shortcut /</label>
                <input id="tpl-shortcut" className={`${INPUT} !w-40`} value={form.shortcut ?? ''} disabled={!canEdit} onChange={e => setForm({ ...form, shortcut: e.target.value })} placeholder="meet" /></div>}
            </div>
            {!form.is_snippet && <div><label htmlFor="tpl-subject" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
              <input id="tpl-subject" className={INPUT} value={form.subject} disabled={!canEdit} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>}
            <div><label htmlFor="tpl-body" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Body</label>
              <textarea id="tpl-body" ref={bodyRef} rows={8} className={INPUT} value={form.body} disabled={!canEdit} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
            <div>
              <p className="mb-1 text-xs text-gray-600 dark:text-gray-400">Variables are replaced when the template is used. Click to insert at the cursor:</p>
              <div className="flex flex-wrap gap-1">{TEMPLATE_VARIABLES.map(v => (
                <button key={v.key} type="button" title={v.label} disabled={!canEdit} onClick={() => insertVar(v.key)} className="rounded-full border border-gray-300 px-2 py-0.5 font-mono text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">{`{{${v.key}}}`}</button>))}</div>
              {unknownVars.length > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Unknown variable(s) will stay as written: {unknownVars.map(v => `{{${v}}}`).join(', ')}</p>}
            </div>
            <div aria-label="Live preview" className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview (sample data)</p>
              {!form.is_snippet && <p className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="preview-subject">{preview.subject.text || 'No subject'}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200" data-testid="preview-body">{preview.body.text || 'Nothing to preview yet.'}</p>
            </div>
            <ErrorLine message={formError} />
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN} onClick={() => setEditingId(null)}>Close</button>
              {canEdit && <button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>}
            </div>
          </form>
        ) : <div className={`${CARD} text-sm text-gray-600 dark:text-gray-400`}>Select a template or snippet to edit it, or create a new one.</div>}
      </div>

      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Delete template?">
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-300">"{deleting?.name}" will be removed for everyone in the workspace.</p>
        <div className="flex justify-end gap-2"><button type="button" className={BTN} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void remove()}>Delete</button></div>
      </Modal>
    </section>
  );
};

export default EmailTemplatesSettings;
