import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

interface QuickCreateDealProps {
  stageName: string;
  onCreate: (title: string, value: number) => Promise<void>;
  onClose: () => void;
}

/** Inline quick-create row (title + value) shown at the top of a column. */
export const QuickCreateDeal: React.FC<QuickCreateDealProps> = ({ stageName, onCreate, onClose }) => {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const submit = async () => {
    const name = title.trim();
    if (!name) { setError('Enter a deal title'); return; }
    const amount = value.trim() === '' ? 0 : Number(value.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) { setError('Value must be a positive number'); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate(name, amount);
      onClose();
    } catch {
      setError('Could not create deal');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); void submit(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

  return (
    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-blue-300 dark:border-blue-700 shadow-sm space-y-2" onKeyDown={onKeyDown}>
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`New deal in ${stageName}`}
        aria-label="Deal title"
        className={inputClass}
        disabled={saving}
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Value (e.g. 25000)"
        aria-label="Deal value"
        inputMode="decimal"
        className={inputClass}
        disabled={saving}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="flex items-center space-x-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          <Check className="w-4 h-4" />
          <span>{saving ? 'Adding...' : 'Add'}</span>
        </button>
      </div>
    </div>
  );
};
