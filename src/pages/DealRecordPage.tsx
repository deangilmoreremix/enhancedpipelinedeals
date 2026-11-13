import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDealRecord } from '../components/deals/useDealRecord';
import { DealDetailLoaded, DealRecordState } from '../components/DealDetail';
import DealRecordHeader from '../components/deals/DealRecordHeader';
import DealTrashPanel from '../components/deals/DealTrashPanel';
import MergeDealsModal from '../components/deals/MergeDealsModal';
import DealToasts from '../components/deals/DealToasts';
import { useDealStore } from '../store/dealStore';
import { findDuplicatesOf } from '../services/dealMergeService';

/** /deals/:id - full-page deal record (header + the same tabbed detail used by the board modal). */
const DealRecordPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rec = useDealRecord(id);
  const dealsMap = useDealStore(s => s.deals);
  const [showTrash, setShowTrash] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  const goBack = () => navigate('/');
  const deals = Object.values(dealsMap);
  const initialIds = rec.deal ? [rec.deal.id, ...findDuplicatesOf(rec.deal, deals).map(d => d.deal.id)] : [];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      {rec.deal ? (
        <>
          <DealRecordHeader deal={rec.deal} onFindDuplicates={() => setShowMerge(true)} onShowDeleted={() => setShowTrash(true)} />
          <DealDetailLoaded key={rec.deal.id} deal={rec.deal} onClose={goBack} variant="page" />
          <MergeDealsModal
            isOpen={showMerge}
            onClose={() => setShowMerge(false)}
            deals={deals}
            initialIds={initialIds.length >= 2 ? initialIds : [rec.deal.id]}
            onMerged={survivor => navigate(`/deals/${survivor}`)}
          />
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
