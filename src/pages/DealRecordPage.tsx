import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDealRecord } from '../components/deals/useDealRecord';
import { DealDetailLoaded, DealRecordState } from '../components/DealDetail';
import DealRecordHeader from '../components/deals/DealRecordHeader';
import DealTrashPanel from '../components/deals/DealTrashPanel';
import DealToasts from '../components/deals/DealToasts';

/**
 * /deals/:id - full-page deal record (header + the tabbed detail). The detail view owns the record hotkeys, the
 * shortcut help and the palette actions (merge, workflows, notes, tasks) so they work here and in the side panel.
 */
const DealRecordPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rec = useDealRecord(id);
  const [showTrash, setShowTrash] = useState(false);

  const goBack = () => navigate('/');

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      {rec.deal ? (
        <>
          <DealRecordHeader deal={rec.deal} onShowDeleted={() => setShowTrash(true)} />
          <DealDetailLoaded key={rec.deal.id} deal={rec.deal} onClose={goBack} variant="page" />
        </>
      ) : rec.status !== 'ready' ? (
        <DealRecordState
          status={rec.status}
          deletedTitle={rec.deletedDeal?.title ?? rec.deletedDeal?.company}
          onRestore={rec.restore}
          onClose={goBack}
          variant="page"
        />
      ) : null}
      <DealTrashPanel isOpen={showTrash} onClose={() => setShowTrash(false)} onRestored={restoredId => navigate(`/deals/${restoredId}`)} />
      <DealToasts />
    </div>
  );
};

export default DealRecordPage;
