import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { DuplicateCandidate } from '../../../services/dealDuplicateService';
import { formatMoney } from '../../../utils/currencyMicros';
import { Button } from '../../ui/Button';

export interface DuplicateDealsWarningProps {
  duplicates: DuplicateCandidate[];
  onCreateAnyway: () => void;
  creating?: boolean;
  /** Overrides the default "open in a new tab" link. */
  onOpenDeal?: (id: string) => void;
}

/** Non-blocking "Possible duplicates" list shown before a deal is created. */
export const DuplicateDealsWarning: React.FC<DuplicateDealsWarningProps> = ({ duplicates, onCreateAnyway, creating, onOpenDeal }) => (
  <div role="region" aria-label="Possible duplicates" className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
    <p className="mb-2 flex items-center text-sm font-semibold text-amber-800 dark:text-amber-200">
      <AlertTriangle className="mr-1.5 h-4 w-4" />Possible duplicates
    </p>
    <ul className="space-y-1.5">
      {duplicates.map(d => (
        <li key={d.id} className="flex items-center gap-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-gray-900 dark:text-white">{d.title ?? d.company ?? 'Untitled deal'}</p>
            <p className="truncate text-xs text-gray-600 dark:text-gray-300">
              {[d.company, d.value != null ? formatMoney(d.value) : null, d.reason].filter(Boolean).join(' - ')}
            </p>
          </div>
          {onOpenDeal ? (
            <button type="button" onClick={() => onOpenDeal(d.id)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">Open</button>
          ) : (
            <a href={`/deals/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline dark:text-blue-400">Open</a>
          )}
        </li>
      ))}
    </ul>
    <div className="mt-3 flex justify-end">
      <Button type="button" size="sm" variant="outline" disabled={creating} onClick={onCreateAnyway}>Create anyway</Button>
    </div>
  </div>
);

export default DuplicateDealsWarning;
