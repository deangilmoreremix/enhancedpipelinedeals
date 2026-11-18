import { useCallback, useMemo } from 'react';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { getPhoneService } from '../services/phoneService';
import { getAIEnrichmentService } from '../services/aiEnrichmentService';
import { pushToast } from '../store/dealRecordStore';

/** Tabs of the deal view that actions can switch to. */
export type DealViewTab =
  | 'overview' | 'notes' | 'tasks' | 'files' | 'timeline' | 'insights' | 'assistant' | 'journey'
  | 'communication' | 'calendar' | 'email' | 'analytics' | 'automation' | 'management';

export type ButtonAction =
  | 'email'
  | 'email-ai'
  | 'call'
  | 'edit'
  | 'favorite'
  | 'unfavorite'
  | 'ai-auto-enrich'
  | 'share'
  | 'calendar'
  | 'meet'
  | 'add-field'
  | 'add-contact'
  | 'change-contact'
  | 'remove-contact'
  | 'view-files'
  | 'view-insights'
  | 'view-journey'
  | 'view-communication'
  | 'view-analytics'
  | 'view-automation'
  | 'close';

export interface UseButtonActionsProps {
  deal: Deal;
  contact?: Contact;
  onUpdateDeal?: (id: string, updates: Partial<Deal>) => Promise<Deal>;
  onUpdateContact?: (contactId: string, updates: Partial<Contact>) => Promise<any>;
  onClose?: () => void;
  onOpenEmailComposer?: (contact: Contact, deal: Deal) => void;
  onOpenContactSelector?: () => void;
  /** Unlinks the deal's contact. */
  onRemoveContact?: () => void;
  /** Switches the deal view to another tab. */
  onShowTab?: (tab: DealViewTab) => void;
  /** Focuses the inline title editor (Overview tab). */
  onEditDeal?: () => void;
  /** Opens the Calendar tab with the schedule-meeting form expanded. */
  onScheduleMeeting?: () => void;
  /** Opens the custom field manager. */
  onManageFields?: () => void;
}

export interface ButtonActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/** Copies deal details to the clipboard (or uses the Web Share API) and reports through the toast store. */
export async function shareDeal(deal: Pick<Deal, 'title' | 'company'>): Promise<ButtonActionResult> {
  const shareData = {
    title: deal.title ?? deal.company,
    text: `Check out this deal: ${deal.title ?? deal.company} at ${deal.company}`,
    url: typeof window !== 'undefined' ? window.location.href : ''
  };
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share(shareData);
      return { success: true };
    }
    await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
    pushToast('success', 'Deal link copied to the clipboard');
    return { success: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { success: true }; // share sheet dismissed
    return { success: false, error: 'Could not share the deal' };
  }
}

export const useButtonActions = ({
  deal,
  contact,
  onUpdateDeal,
  onUpdateContact,
  onClose,
  onOpenEmailComposer,
  onOpenContactSelector,
  onRemoveContact,
  onShowTab,
  onEditDeal,
  onScheduleMeeting,
  onManageFields
}: UseButtonActionsProps) => {
  const noHandler = (what: string): ButtonActionResult => ({ success: false, error: `${what} is not available here` });
  const showTab = useCallback((tab: DealViewTab) => (): Promise<ButtonActionResult> => {
    if (!onShowTab) return Promise.resolve(noHandler('Tab navigation'));
    onShowTab(tab);
    return Promise.resolve({ success: true });
  }, [onShowTab]);

  const handleFavorite = useCallback(async (): Promise<ButtonActionResult> => {
    try {
      if (!onUpdateDeal) return { success: false, error: 'Update function not available' };
      await onUpdateDeal(deal.id, { isFavorite: !deal.isFavorite });
      return { success: true };
    } catch (error) {
      console.error('Favorite action failed:', error);
      return { success: false, error: 'Failed to update favorite status' };
    }
  }, [deal.id, deal.isFavorite, onUpdateDeal]);

  const actionHandlers = useMemo<Record<ButtonAction, () => Promise<ButtonActionResult>>>(() => ({
    email: async () => {
      if (!contact?.email) return { success: false, error: 'This deal has no contact with an email address' };
      if (!onOpenEmailComposer) return noHandler('The email composer');
      onOpenEmailComposer(contact, deal);
      return { success: true };
    },

    // The AI draft composer lives on the Email tab.
    'email-ai': async () => {
      if (!contact?.email) return { success: false, error: 'This deal has no contact with an email address' };
      if (!onShowTab) return noHandler('The email tab');
      onShowTab('email');
      return { success: true };
    },

    call: async () => {
      try {
        if (!contact?.phone) return { success: false, error: 'No phone number available' };
        getPhoneService().makeCall(contact.phone, contact.name, deal.title);
        return { success: true };
      } catch (error) {
        console.error('Call action failed:', error);
        return { success: false, error: 'Failed to initiate call' };
      }
    },

    edit: async () => {
      if (!onEditDeal) return noHandler('Editing');
      onEditDeal();
      return { success: true };
    },

    favorite: handleFavorite,
    unfavorite: handleFavorite,

    'ai-auto-enrich': async () => {
      try {
        if (!contact) return { success: false, error: 'Link a contact to this deal to enrich it' };
        // Public-web research with the OpenAI web_search tool. Fills empty fields only, never overwrites,
        // appends a sourced note and merges public social profiles.
        const { applied, suggestions, research } = await getAIEnrichmentService().enrichContactFromWeb(contact as any);
        if (!research.found || Object.keys(applied).length === 0) {
          return {
            success: false,
            error: research.found
              ? 'No new information found (existing fields already match)'
              : (research.notes || 'No reliable public information found for this contact'),
          };
        }
        if (onUpdateContact) await onUpdateContact(contact.id, applied as Partial<Contact>);
        return { success: true, data: { applied, suggestions, sources: research.sources, confidence: research.confidence } };
      } catch (error) {
        console.error('AI Auto-Enrich action failed:', error);
        return { success: false, error: 'Failed to auto-enrich contact' };
      }
    },

    share: () => shareDeal(deal),

    // Google Calendar quick-add in a new tab (the Calendar tab holds the deal's own events)
    calendar: async () => {
      window.open(
        `https://calendar.google.com/calendar/u/0/r/eventedit?text=Meeting+about+${encodeURIComponent(deal.title || 'Deal')}&details=${encodeURIComponent(deal.company || 'Company')}`,
        '_blank',
        'noopener'
      );
      return { success: true };
    },

    meet: async () => {
      if (!onScheduleMeeting) return noHandler('Scheduling');
      onScheduleMeeting();
      return { success: true };
    },

    'add-field': async () => {
      if (!onManageFields) return noHandler('Custom fields');
      onManageFields();
      return { success: true };
    },

    'add-contact': async () => {
      if (!onOpenContactSelector) return noHandler('The contact picker');
      onOpenContactSelector();
      return { success: true };
    },
    'change-contact': async () => {
      if (!onOpenContactSelector) return noHandler('The contact picker');
      onOpenContactSelector();
      return { success: true };
    },
    'remove-contact': async () => {
      if (!onRemoveContact) return noHandler('Unlinking a contact');
      onRemoveContact();
      return { success: true };
    },

    'view-files': showTab('files'),
    'view-insights': showTab('insights'),
    'view-journey': showTab('journey'),
    'view-communication': showTab('communication'),
    'view-analytics': showTab('analytics'),
    'view-automation': showTab('automation'),

    close: async () => {
      if (!onClose) return noHandler('Closing');
      onClose();
      return { success: true };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [contact, deal, handleFavorite, onClose, onEditDeal, onManageFields, onOpenContactSelector, onOpenEmailComposer, onRemoveContact, onScheduleMeeting, onShowTab, onUpdateContact, showTab]);

  const handleAction = useCallback(async (actionType: ButtonAction): Promise<ButtonActionResult> => {
    const handler = actionHandlers[actionType];
    if (!handler) return { success: false, error: `Unknown action: ${actionType}` };
    const result = await handler();
    if (!result.success && result.error) pushToast('error', result.error);
    return result;
  }, [actionHandlers]);

  return { handleAction };
};
