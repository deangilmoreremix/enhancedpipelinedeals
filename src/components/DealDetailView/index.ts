export { DealDetailModal } from './DealDetailModal';
export { DealDetailSidebar } from './DealDetailSidebar';
export { DealDetailTabs } from './DealDetailTabs';
export { DealDetailOverview } from './DealDetailOverview';
export { DealDetailActions } from './DealDetailActions';

// Re-export types for external use
export type {
  DealDetailViewProps,
  DealDetailModalProps,
  DealDetailSidebarProps,
  DealDetailTabsProps,
  DealDetailOverviewProps,
  DealDetailContactProps,
  DealDetailActionsProps,
  DealDetailState,
  DealDetailAction,
  ModalType
} from './types';

// Re-export reducer and actions
export { dealDetailReducer, dealDetailActions, initialDealDetailState } from './reducer';