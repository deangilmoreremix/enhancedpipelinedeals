import React, { useEffect, useState } from 'react';
import type { Deal, PipelineStage } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface NewDealDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stages: PipelineStage[];
  onCreate: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

const FIELD_CLASS =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/** Small "New deal" dialog (toolbar button / command palette). */
export const NewDealDialog: React.FC<NewDealDialogProps> = ({ isOpen, onClose, stages, onCreate }) => {
  const ordered = [...stages].sort((a, b) => a.position - b.position).filter(s => s.visible);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState(ordered[0]?.key ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !ordered.some(s => s.key === stage)) setStage(ordered[0]?.key ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stageDef = ordered.find(s => s.key === stage);
    const amount = value.trim() === '' ? 0 : Number(value);
    if (!title.trim()) { setError('Enter a title'); return; }
    if (isNaN(amount) || amount < 0) { setError('Value must be a positive number'); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        company: company.trim(),
        contact: contact.trim(),
        value: amount,
        stage: stage || 'lead',
        probability: stageDef?.probability ?? 0,
        priority: 'medium'
      });
      setTitle(''); setCompany(''); setContact(''); setValue('');
      onClose();
    } catch {
      setError('Could not create the deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New deal">
      <form onSubmit={submit} className="space-y-3">
        <input autoFocus aria-label="Deal title" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD_CLASS} />
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Company" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} className={FIELD_CLASS} />
          <input aria-label="Contact" placeholder="Contact" value={contact} onChange={(e) => setContact(e.target.value)} className={FIELD_CLASS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input aria-label="Value" type="number" min="0" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} className={FIELD_CLASS} />
          <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} className={FIELD_CLASS}>
            {ordered.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end space-x-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create deal'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default NewDealDialog;
