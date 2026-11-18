import React from 'react';
import { Star } from 'lucide-react';
import { useInlineField } from './useInlineField';

export interface RatingFieldProps {
  label?: string;
  value: number | null;
  max?: number;
  /** Receives 1..max, or null when the current rating is clicked again (clear). */
  onSave: (next: number | null) => Promise<unknown> | unknown;
  disabled?: boolean;
  className?: string;
}

/** Star rating: click a star to set it, click the active star again to clear. */
export const RatingField: React.FC<RatingFieldProps> = ({ label, value, max = 5, onSave, disabled, className = '' }) => {
  const f = useInlineField<number | null>(onSave, label);
  const current = f.pending ? f.pending.value : value;
  return (
    <div className={className}>
      {label && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>}
      <div role="radiogroup" aria-label={label ?? 'Rating'} className={`flex items-center gap-0.5 px-2 py-1 ${f.pending ? 'opacity-60' : ''}`}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            disabled={disabled}
            onClick={() => void f.commit(current === n ? null : n)}
            className="rounded p-0.5 disabled:cursor-default"
          >
            <Star className={`h-5 w-5 ${current !== null && n <= current ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
          </button>
        ))}
      </div>
      {f.error && <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  );
};

export default RatingField;
