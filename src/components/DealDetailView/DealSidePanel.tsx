import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, X } from 'lucide-react';
import DealDetail from '../DealDetail';
import { useDealStore } from '../../store/dealStore';
import { PinDealButton } from '../pipeline/PinnedDeals';
import { BTN_ICON } from '../ui/buttonStyles';

interface DealSidePanelProps {
  dealId: string;
  onClose: () => void;
  /** Switch the panel to another deal (prev/next hotkeys, after a merge). */
  onOpenDeal?: (dealId: string) => void;
}

/**
 * Right-hand drawer that shows a deal over the board without leaving it.
 * "Expand to full page" goes to /deals/:id. Not aria-modal, so the record hotkeys (Esc closes) stay live.
 */
export const DealSidePanel: React.FC<DealSidePanelProps> = ({ dealId, onClose, onOpenDeal }) => {
  const navigate = useNavigate();
  const deal = useDealStore(s => s.deals[dealId]);
  const label = deal?.title ?? deal?.company ?? 'Deal';

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside
        aria-label={`Deal panel: ${label}`}
        data-testid="deal-side-panel"
        className="flex h-full w-full max-w-[960px] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Deal Profile</p>
            <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{label}</h2>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <PinDealButton dealId={dealId} />
            <button
              type="button"
              aria-label="Expand to full page"
              title="Expand to full page"
              onClick={() => navigate(`/deals/${dealId}`)}
              className={BTN_ICON}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Close panel" title="Close (Esc)" onClick={onClose} className={BTN_ICON}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <DealDetail dealId={dealId} onClose={onClose} onOpenDeal={onOpenDeal} variant="panel" />
        </div>
      </aside>
    </div>
  );
};

export default DealSidePanel;
