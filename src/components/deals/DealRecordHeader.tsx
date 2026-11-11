import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoreHorizontal, Star, Trash2, GitMerge, Archive } from 'lucide-react';
import type { Deal } from '../../types';
import { useDealStore } from '../../store/dealStore';
import { orderDealIds, neighbours } from './dealOrder';
import { setFavorite } from '../../services/favoritesService';
import { errorMessage } from '../../services/dealRecordShared';
import { pushToast } from '../../store/dealRecordStore';
import { usePermissions } from '../../hooks/usePermissions';
import { toastFailure } from '../../utils/permissionToast';
import { BTN_ICON } from '../ui/buttonStyles';

interface DealRecordHeaderProps {
  deal: Deal;
  onFindDuplicates: () => void;
  onShowDeleted: () => void;
}

/** Breadcrumb, favorite star, prev/next navigation and the "..." menu for /deals/:id. */
export const DealRecordHeader: React.FC<DealRecordHeaderProps> = ({ deal, onFindDuplicates, onShowDeleted }) => {
  const navigate = useNavigate();
  const deals = useDealStore(s => s.deals);
  const stages = useDealStore(s => s.stages);
  const perms = usePermissions();
  const canEdit = perms.allowed('edit', 'deal', deal);
  const canDelete = perms.allowed('delete', 'deal', deal);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const order = useMemo(() => orderDealIds(deals, stages), [deals, stages]);
  const nav = neighbours(order, deal.id);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const toggleStar = async () => {
    const next = !deal.isFavorite;
    try {
      await useDealStore.getState().updateDeal(deal.id, { isFavorite: next }); // optimistic + persists deals.is_favorite
      await setFavorite('deal', deal.id, next);
    } catch (e) {
      toastFailure(e, 'edit', 'deal', `Could not update favorite: ${errorMessage(e)}`);
    }
  };

  const remove = async () => {
    setMenu(false);
    if (!window.confirm(`Delete "${deal.title ?? deal.company}"? You can restore it from Deleted deals.`)) return;
    try {
      await useDealStore.getState().softDeleteDeal(deal.id);
      pushToast('success', 'Deal moved to Deleted deals');
      navigate(nav.next ? `/deals/${nav.next}` : nav.prev ? `/deals/${nav.prev}` : '/');
    } catch (e) {
      toastFailure(e, 'delete', 'deal', `Could not delete deal: ${errorMessage(e)}`);
    }
  };

  const iconBtn = BTN_ICON;

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <Link to="/" className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">Pipeline</Link>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
        <span aria-current="page" className="truncate font-medium text-gray-900 dark:text-white">{deal.title ?? deal.company}</span>
      </nav>

      <div className="flex flex-shrink-0 items-center gap-2">
        {nav.index >= 0 && <span className="mr-1 hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">{nav.index + 1} of {nav.total}</span>}
        <button type="button" aria-label="Previous deal" disabled={!nav.prev} onClick={() => nav.prev && navigate(`/deals/${nav.prev}`)} className={iconBtn}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Next deal" disabled={!nav.next} onClick={() => nav.next && navigate(`/deals/${nav.next}`)} className={iconBtn}><ChevronRight className="h-4 w-4" /></button>
        <button
          type="button"
          aria-label={deal.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={!!deal.isFavorite}
          onClick={() => void toggleStar()}
          disabled={!canEdit}
          title={canEdit ? undefined : perms.can('edit', 'deal', deal).reason}
          className={iconBtn}
        >
          <Star className={`h-4 w-4 ${deal.isFavorite ? 'fill-yellow-400 text-yellow-500' : ''}`} />
        </button>
        <div className="relative" ref={menuRef}>
          <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)} className={iconBtn}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              {canEdit && canDelete && (
              <button role="menuitem" type="button" onClick={() => { setMenu(false); onFindDuplicates(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700">
                <GitMerge className="h-4 w-4" />Find duplicates / Merge
              </button>
              )}
              <button role="menuitem" type="button" onClick={() => { setMenu(false); onShowDeleted(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700">
                <Archive className="h-4 w-4" />Deleted deals
              </button>
              {canDelete && (
                <>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                  <button role="menuitem" type="button" onClick={() => void remove()} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30">
                    <Trash2 className="h-4 w-4" />Delete deal
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealRecordHeader;
