import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin, PinOff, X } from 'lucide-react';
import { useDealStore } from '../../store/dealStore';
import { useDealViewPrefs } from '../../store/dealViewPrefsStore';
import { BTN_ICON } from '../ui/buttonStyles';

export const dealLabel = (d: { title?: string; company?: string } | undefined): string => d?.title || d?.company || 'Untitled deal';

interface StripProps {
  /** Defaults to navigating to /deals/:id. */
  onOpenDeal?: (dealId: string) => void;
  className?: string;
}

/** Horizontal strip of the user's pinned deals (renders nothing when none are pinned). */
export const PinnedDeals: React.FC<StripProps> = ({ onOpenDeal, className = '' }) => {
  const navigate = useNavigate();
  const { prefs, unpin } = useDealViewPrefs();
  const deals = useDealStore(s => s.deals);
  if (prefs.pinnedDealIds.length === 0) return null;
  const open = (id: string) => (onOpenDeal ? onOpenDeal(id) : navigate(`/deals/${id}`));

  return (
    <nav aria-label="Pinned deals" className={`flex items-center gap-2 overflow-x-auto ${className}`}>
      <Pin className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
      <ul className="flex items-center gap-2">
        {prefs.pinnedDealIds.map(id => {
          const deal = deals[id];
          const label = dealLabel(deal);
          return (
            <li key={id} className="inline-flex items-center h-8 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200">
              <button
                type="button"
                onClick={() => open(id)}
                className="pl-3 pr-1 max-w-[12rem] truncate hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-l-full"
              >
                {label}
              </button>
              <button
                type="button"
                aria-label={`Unpin ${label}`}
                onClick={() => { void unpin(id); }}
                className="px-1.5 text-gray-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-r-full"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

/** Pin / unpin toggle for a deal record header or card. */
export const PinDealButton: React.FC<{ dealId: string; className?: string }> = ({ dealId, className }) => {
  const { prefs, pin, unpin } = useDealViewPrefs();
  const pinned = prefs.pinnedDealIds.includes(dealId);
  return (
    <button
      type="button"
      className={className ?? BTN_ICON}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin deal' : 'Pin deal'}
      title={pinned ? 'Unpin deal' : 'Pin deal'}
      onClick={() => { void (pinned ? unpin(dealId) : pin(dealId)); }}
    >
      {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
    </button>
  );
};

export default PinnedDeals;
