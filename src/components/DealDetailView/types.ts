import { Deal } from '../../types';
import { Contact } from '../../types/contact';

export interface DealDetailViewProps {
  deal: Deal;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Deal>) => Promise<Deal>;
  contactData?: Contact | null;
  onAddContact?: () => void;
}

export interface DealDetailModalProps extends DealDetailViewProps {}

export interface DealDetailSidebarProps {
  deal: Deal;
  editedDeal: Deal;
  linkedContact: Contact | null;
  isAnalyzing: boolean;
  onAnalyzeDeal: () => Promise<void>;
  onContactAnalysis: () => Promise<void>;
  onContactEnrichment: (enrichmentData: any) => Promise<void>;
  onFindNewImage: () => Promise<void>;
  onToggleFavorite: () => Promise<void>;
  onAction: (action: string, event?: React.MouseEvent) => void;
  onClose: () => void;
}

export interface DealDetailTabsProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export interface DealDetailOverviewProps {
  deal: Deal;
  editedDeal: Deal;
  linkedContact: Contact | null;
  onEditField: (field: string, value: any) => void;
  onStartEditingField: (field: string) => void;
  onSaveField: () => Promise<void>;
  editingField: string | null;
}

export interface DealDetailContactProps {
  linkedContact: Contact | null;
  onSelectContact: (contact: Contact) => void;
  onRemoveContact: () => void;
  onContactAnalysis: () => Promise<void>;
  onContactEnrichment: (enrichmentData: any) => Promise<void>;
  onFindNewImage: () => Promise<void>;
  showContactSelector: boolean;
  onToggleContactSelector: () => void;
}

export interface DealDetailActionsProps {
  deal: Deal;
  linkedContact: Contact | null;
  isEditing: boolean;
  isSaving: boolean;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onToggleFavorite: () => Promise<void>;
  onShare: () => Promise<void>;
  onAction: (action: string, event?: React.MouseEvent) => void;
}

export type ModalType = 'emailComposer' | 'contactSelector' | 'addField' | 'addLink' | null;

export interface DealDetailState {
  activeTab: string;
  isEditing: boolean;
  editedDeal: Deal;
  linkedContact: Contact | null;
  isAnalyzing: boolean;
  isSaving: boolean;
  isEnriching: boolean;
  lastEnrichment: any;
  editingField: string | null;
  showAddField: boolean;
  newFieldName: string;
  newFieldValue: string;
  showAddSocial: boolean;
  selectedSocialPlatform: string;
  socialFieldValue: string;
  showAddSource: boolean;
  addSource: string;
  editInterestLevel: boolean;
  showContactSelector: boolean;
  newTag: string;
  showAddLink: boolean;
  newLinkTitle: string;
  newLinkUrl: string;
  files: any[];
  activeModal: ModalType;
}

export type DealDetailAction =
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_EDITING'; payload: boolean }
  | { type: 'UPDATE_EDITED_DEAL'; payload: Partial<Deal> }
  | { type: 'SET_LINKED_CONTACT'; payload: Contact | null }
  | { type: 'SET_ANALYZING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ENRICHING'; payload: boolean }
  | { type: 'SET_LAST_ENRICHMENT'; payload: any }
  | { type: 'SET_EDITING_FIELD'; payload: string | null }
  | { type: 'SET_SHOW_ADD_FIELD'; payload: boolean }
  | { type: 'SET_NEW_FIELD_NAME'; payload: string }
  | { type: 'SET_NEW_FIELD_VALUE'; payload: string }
  | { type: 'SET_SHOW_ADD_SOCIAL'; payload: boolean }
  | { type: 'SET_SELECTED_SOCIAL_PLATFORM'; payload: string }
  | { type: 'SET_SOCIAL_FIELD_VALUE'; payload: string }
  | { type: 'SET_SHOW_ADD_SOURCE'; payload: boolean }
  | { type: 'SET_ADD_SOURCE'; payload: string }
  | { type: 'SET_EDIT_INTEREST_LEVEL'; payload: boolean }
  | { type: 'SET_SHOW_CONTACT_SELECTOR'; payload: boolean }
  | { type: 'SET_NEW_TAG'; payload: string }
  | { type: 'SET_SHOW_ADD_LINK'; payload: boolean }
  | { type: 'SET_NEW_LINK_TITLE'; payload: string }
  | { type: 'SET_NEW_LINK_URL'; payload: string }
  | { type: 'SET_FILES'; payload: any[] }
  | { type: 'SET_ACTIVE_MODAL'; payload: ModalType }
  | { type: 'RESET_STATE'; payload: { deal: Deal; contactData?: Contact | null } };
