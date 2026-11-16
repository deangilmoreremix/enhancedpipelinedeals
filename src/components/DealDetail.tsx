import React from 'react';
import { DealDetailView } from './DealDetailView';
import { useContactStore } from '../store/contactStore';
import { useDealStore } from '../store/dealStore';
import type { Deal } from '../types';
import type { Contact } from '../types/contact';
import { useDealRecord, DealRecordStatus } from './deals/useDealRecord';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

type Variant = 'modal' | 'page' | 'panel';

interface DealDetailProps {
  dealId: string;
  onClose: () => void;
  /** 'modal' (full-screen overlay), 'page' (inline, /deals/:id) or 'panel' (inside the side panel). */
  variant?: Variant;
  /** Opens another deal (prev/next hotkeys, after a merge). */
  onOpenDeal?: (dealId: string) => void;
}

/** Detail view for an already-loaded deal; every edit persists through useDealStore.updateDeal. */
export const DealDetailLoaded: React.FC<{ deal: Deal; onClose: () => void; variant?: Variant; onOpenDeal?: (dealId: string) => void }> = ({ deal, onClose, variant = 'modal', onOpenDeal }) => {
  const contacts = useContactStore(s => s.contacts);
  const contactData: Contact | null = deal.contactId ? contacts.find(c => c.id === deal.contactId) ?? null : null;
  const handleUpdate = React.useCallback(
    (id: string, updates: Partial<Deal>) => useDealStore.getState().updateDeal(id, updates),
    []
  );
  return (
    <DealDetailView
      deal={deal}
      isOpen={true}
      onClose={onClose}
      onUpdate={handleUpdate}
      contactData={contactData}
      onOpenDeal={onOpenDeal}
      variant={variant}
    />
  );
};

/** Loading / not-found / deleted states for a record that is not (yet) in the store. */
export const DealRecordState: React.FC<{
  status: Exclude<DealRecordStatus, 'ready'>;
  deletedTitle?: string;
  onRestore?: () => Promise<void>;
  onClose: () => void;
  variant?: Variant;
}> = ({ status, deletedTitle, onRestore, onClose, variant = 'modal' }) => {
  const [restoring, setRestoring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const content = (
    <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {status === 'loading' && <p role="status" className="text-gray-600 dark:text-gray-300">Loading deal...</p>}
      {status === 'not_found' && (
        <>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Deal not found</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">It may have been removed or you may not have access.</p>
          <Button onClick={onClose}>Back to pipeline</Button>
        </>
      )}
      {status === 'deleted' && (
        <>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">This deal was deleted</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{deletedTitle ? `"${deletedTitle}" is in Deleted deals.` : 'It is in Deleted deals.'}</p>
          {error && <Alert variant="error" className="mb-3"><span className="text-sm">{error}</span></Alert>}
          <div className="flex justify-center gap-2">
            {onRestore && (
              <Button
                disabled={restoring}
                onClick={async () => {
                  setRestoring(true);
                  setError(null);
                  try { await onRestore(); } catch (e) { setError(e instanceof Error ? e.message : 'Restore failed'); } finally { setRestoring(false); }
                }}
              >
                {restoring ? 'Restoring...' : 'Restore deal'}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Back to pipeline</Button>
          </div>
        </>
      )}
    </div>
  );

  if (variant !== 'modal') return <div className="px-4 py-16">{content}</div>;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {content}
    </div>
  );
};

const DealDetail: React.FC<DealDetailProps> = ({ dealId, onClose, variant = 'modal', onOpenDeal }) => {
  const rec = useDealRecord(dealId);
  if (rec.deal) return <DealDetailLoaded deal={rec.deal} onClose={onClose} variant={variant} onOpenDeal={onOpenDeal} />;
  if (rec.status === 'ready') return null;
  return (
    <DealRecordState
      status={rec.status}
      deletedTitle={rec.deletedDeal?.title ?? rec.deletedDeal?.company}
      onRestore={rec.restore}
      onClose={onClose}
      variant={variant}
    />
  );
};

export default DealDetail;
