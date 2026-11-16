import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DealDetailSidebar } from './DealDetailSidebar';
import { DealDetailTabs } from './DealDetailTabs';
import { DealDetailOverview } from './DealDetailOverview';
import { DealDetailActions } from './DealDetailActions';
import { SDRResultsModal, type SdrRunRequest } from './SDRResultsModal';
import { sdrAgentLabel } from './SDRButtonGroup';
import { visibleTabs } from './tabConfig';
import { DealCommunicationHub } from '../DealCommunicationHub';
import { DealAnalyticsDashboard } from '../DealAnalyticsDashboard';
import { DealAutomationPanel } from '../DealAutomationPanel';
import DealManagementPanel from './DealManagementPanel';
import { EmailComposer } from '../EmailComposer';
import { ContactsModal } from '../ContactsModal';
import { dealDetailReducer, dealDetailActions, initialDealDetailState } from './reducer';
import { useButtonActions, shareDeal, type ButtonAction, type DealViewTab } from '../../hooks/useButtonActions';
import { useContactStore } from '../../store/contactStore';
import { useDealStore } from '../../store/dealStore';
import { useDealViewPrefs } from '../../store/dealViewPrefsStore';
import { useDealRecordHotkeys } from '../../hooks/useDealRecordHotkeys';
import { DealDetailModalProps } from './types';
import DealNotes from '../deals/DealNotes';
import DealTasks from '../deals/DealTasks';
import DealFiles from '../deals/DealFiles';
import DealTimeline from '../deals/DealTimeline';
import DealActivityPanel from '../deals/DealActivityPanel';
import { AIEmailComposer } from '../AIEmailComposer';
import DealCalendarPanel from '../deals/DealCalendarPanel';
import DealToasts from '../deals/DealToasts';
import RecordShortcutHelp from '../deals/RecordShortcutHelp';
import MergeDealsModal from '../deals/MergeDealsModal';
import { DealInsightsTab, DealAssistantPanel } from '../deals/ai';
import { ManageFieldsDialog } from '../deals/fields/ManageFieldsDialog';
import { orderDealIds, neighbours } from '../deals/dealOrder';
import { findDuplicatesOf } from '../../services/dealMergeService';
import { pushToast } from '../../store/dealRecordStore';
import { setCommandContext, onDealRecordAction } from '../commandPaletteContext';
import type { Deal } from '../../types';

const NoContactNotice: React.FC<{ icon: string; text: string; onLink: () => void }> = ({ icon, text, onLink }) => (
  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" aria-hidden="true">{icon}</div>
    <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Contact Linked</h4>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{text}</p>
    <button
      type="button"
      onClick={onLink}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
    >
      Link Contact
    </button>
  </div>
);

export const DealDetailModal: React.FC<DealDetailModalProps> = ({
  deal,
  isOpen,
  onClose,
  onUpdate,
  contactData,
  onOpenDeal,
  variant = 'modal'
}) => {
  const navigate = useNavigate();
  const { contacts, updateContact } = useContactStore();
  const { prefs, toggleFieldGroup } = useDealViewPrefs();

  const [state, dispatch] = useReducer(
    dealDetailReducer,
    initialDealDetailState(deal, contactData)
  );

  // One-shot requests to child tabs (consumed by the child, which then calls the matching *Handled callback)
  const [noteSignal, setNoteSignal] = useState(0);
  const [taskSignal, setTaskSignal] = useState(0);
  const [titleSignal, setTitleSignal] = useState(0);
  const [scheduleSignal, setScheduleSignal] = useState(0);
  const [workflowSignal, setWorkflowSignal] = useState(0);
  const [commsRefresh, setCommsRefresh] = useState(0);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [merge, setMerge] = useState<{ deals: Deal[]; ids: string[] } | null>(null);
  const [sdrRequest, setSdrRequest] = useState<SdrRunRequest | null>(null);
  const [isRunningSDR, setIsRunningSDR] = useState(false);
  const workflowsRef = useRef<HTMLDivElement>(null);

  const setTab = useCallback((tab: string) => dispatch(dealDetailActions.setActiveTab(tab)), []);
  const openDeal = useCallback((id: string) => (onOpenDeal ? onOpenDeal(id) : navigate(`/deals/${id}`)), [onOpenDeal, navigate]);

  // Unified button actions
  const { handleAction } = useButtonActions({
    deal: state.editedDeal,
    contact: state.linkedContact || undefined,
    onUpdateDeal: onUpdate,
    onUpdateContact: updateContact,
    onClose,
    onOpenEmailComposer: () => dispatch(dealDetailActions.setActiveModal('emailComposer')),
    onOpenContactSelector: () => dispatch(dealDetailActions.setShowContactSelector(true)),
    onRemoveContact: () => handleRemoveContact(),
    onShowTab: (tab: DealViewTab) => setTab(tab),
    onEditDeal: () => { setTab('overview'); setTitleSignal(n => n + 1); },
    onScheduleMeeting: () => { setTab('calendar'); setScheduleSignal(n => n + 1); },
    onManageFields: () => setManageFieldsOpen(true)
  });

  // Child components pass plain action strings and ignore the returned promise.
  const onAction = (action: string, event?: React.MouseEvent): void => {
    void handleAction(action as ButtonAction);
    void event;
  };

  useEffect(() => {
    dispatch(dealDetailActions.resetState(deal, contactData));
  }, [deal, contactData]);

  // Find linked contact based on deal's contactId
  useEffect(() => {
    if (deal.contactId) {
      const contact = contacts.find(c => c.id === deal.contactId);
      dispatch(dealDetailActions.setLinkedContact(contact || null));
    } else if (contactData) {
      dispatch(dealDetailActions.setLinkedContact(contactData));
    } else {
      dispatch(dealDetailActions.setLinkedContact(null));
    }
  }, [deal.contactId, contactData, contacts]);

  // The command palette's "This deal" group follows the open record.
  useEffect(() => {
    if (!isOpen) return undefined;
    setCommandContext({ dealId: deal.id });
    return () => setCommandContext(null);
  }, [isOpen, deal.id]);

  // Palette actions that need this view
  useEffect(() => {
    if (!isOpen) return undefined;
    return onDealRecordAction(({ action, dealId }) => {
      if (dealId !== deal.id) return;
      switch (action) {
        case 'add-note': setTab('notes'); setNoteSignal(n => n + 1); break;
        case 'add-task': setTab('tasks'); setTaskSignal(n => n + 1); break;
        case 'run-workflow': setTab('automation'); setWorkflowSignal(n => n + 1); break;
        case 'merge-duplicates':
        case 'find-duplicates': {
          const all = Object.values(useDealStore.getState().deals);
          const dupes = findDuplicatesOf(deal, all).map(d => d.deal.id);
          setMerge({ deals: all, ids: dupes.length > 0 ? [deal.id, ...dupes] : [deal.id] });
          break;
        }
        default:
      }
    });
  }, [isOpen, deal, setTab]);

  // Focus the workflows panel once the Automation tab has rendered
  useEffect(() => {
    if (!workflowSignal || state.activeTab !== 'automation') return;
    workflowsRef.current?.focus();
    workflowsRef.current?.scrollIntoView?.({ block: 'start' });
  }, [workflowSignal, state.activeTab]);

  // A tab the user hid must not stay selected
  const tabs = visibleTabs(prefs);
  useEffect(() => {
    if (!tabs.some(t => t.id === state.activeTab)) setTab(tabs[0]?.id ?? 'overview');
  }, [tabs, state.activeTab, setTab]);

  const stages = useDealStore(s => s.stages);
  const goNeighbour = (dir: 'prev' | 'next') => {
    const nb = neighbours(orderDealIds(useDealStore.getState().deals, stages), deal.id);
    const id = dir === 'prev' ? nb.prev : nb.next;
    if (id) openDeal(id);
  };

  useDealRecordHotkeys(deal.id, {
    onEditTitle: () => { setTab('overview'); setTitleSignal(n => n + 1); },
    onNewNote: () => { setTab('notes'); setNoteSignal(n => n + 1); },
    onNewTask: () => { setTab('tasks'); setTaskSignal(n => n + 1); },
    onToggleFavorite: () => { void handleToggleFavorite(); },
    onPrevious: () => goNeighbour('prev'),
    onNext: () => goNeighbour('next'),
    onGoPipeline: () => navigate('/'),
    onGoContacts: () => navigate('/contacts'),
    onClose
  }, isOpen);

  const handleToggleFavorite = useCallback(async () => {
    const updatedDeal = { ...state.editedDeal, isFavorite: !state.editedDeal.isFavorite };
    dispatch(dealDetailActions.updateEditedDeal(updatedDeal));

    try {
      await onUpdate(deal.id, { isFavorite: updatedDeal.isFavorite });
    } catch (error) {
      console.error('Failed to update favorite status:', error);
      pushToast('error', 'Could not update favorite');
      dispatch(dealDetailActions.updateEditedDeal(deal));
    }
  }, [deal, state.editedDeal, onUpdate]);

  // Inline field editors persist through the store (optimistic; they surface their own errors).
  const handleUpdateDeal = useCallback(
    async (updates: Partial<typeof deal>) => onUpdate(deal.id, updates),
    [deal.id, onUpdate]
  );

  const handleSelectContact = useCallback((contact: any) => {
    dispatch(dealDetailActions.setLinkedContact(contact));
    dispatch(dealDetailActions.updateEditedDeal({
      contact: contact.name,
      contactId: contact.id
    }));
    onUpdate(deal.id, { contact: contact.name, contactId: contact.id }).catch(e => {
      pushToast('error', e instanceof Error ? `Could not link the contact: ${e.message}` : 'Could not link the contact');
    });
    dispatch(dealDetailActions.setShowContactSelector(false));
  }, [deal.id, onUpdate]);

  function handleRemoveContact() {
    dispatch(dealDetailActions.setLinkedContact(null));
    dispatch(dealDetailActions.updateEditedDeal({
      contact: '',
      contactId: undefined
    }));
    onUpdate(deal.id, { contact: '', contactId: undefined }).catch(e => {
      pushToast('error', e instanceof Error ? `Could not unlink the contact: ${e.message}` : 'Could not unlink the contact');
    });
  }

  const handleShareDeal = useCallback(async () => {
    const r = await shareDeal(state.editedDeal);
    if (!r.success && r.error) pushToast('error', r.error);
  }, [state.editedDeal]);

  const handleRunSDRAgent = (agentId: string) => {
    if (!state.linkedContact) {
      pushToast('error', 'Link a contact to this deal to run an SDR agent');
      return;
    }
    setSdrRequest({
      nonce: Date.now(),
      agentId,
      agentLabel: sdrAgentLabel(agentId),
      leadId: state.linkedContact.id,
      goal: `Move the deal "${state.editedDeal.title ?? state.editedDeal.company}" forward`
    });
  };

  if (!isOpen) return null;

  const isPage = variant === 'page';
  const isPanel = variant === 'panel';

  const body = (
    <>
        {/* Profile sidebar (full views only; the side panel stays compact) */}
        {!isPanel && (
          <DealDetailSidebar
            deal={deal}
            editedDeal={state.editedDeal}
            linkedContact={state.linkedContact}
            onToggleFavorite={handleToggleFavorite}
            onAction={onAction}
            onClose={onClose}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          <DealDetailTabs activeTab={state.activeTab} onTabChange={setTab} compact={isPanel} />

          <DealDetailActions
            deal={deal}
            linkedContact={state.linkedContact}
            onToggleFavorite={handleToggleFavorite}
            onShare={handleShareDeal}
            onAction={onAction}
            onRunSDRAgent={handleRunSDRAgent}
            isRunningSDR={isRunningSDR}
          />

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 min-h-0">
            {state.activeTab === 'overview' && (
              <DealDetailOverview
                deal={deal}
                editedDeal={state.editedDeal}
                linkedContact={state.linkedContact}
                onUpdateDeal={handleUpdateDeal}
                hiddenFieldGroups={prefs.hiddenFieldGroups}
                onToggleFieldGroup={g => { void toggleFieldGroup(g); }}
                editTitleSignal={titleSignal}
                onEditTitleHandled={() => setTitleSignal(0)}
                onContactAction={a => onAction(a)}
              />
            )}

            {state.activeTab === 'notes' && (
              <div className="p-6"><DealNotes dealId={deal.id} composeSignal={noteSignal} onComposeHandled={() => setNoteSignal(0)} /></div>
            )}

            {state.activeTab === 'tasks' && (
              <div className="p-6"><DealTasks dealId={deal.id} focusSignal={taskSignal} onFocusHandled={() => setTaskSignal(0)} /></div>
            )}

            {state.activeTab === 'files' && (
              <div className="p-6"><DealFiles dealId={deal.id} /></div>
            )}

            {state.activeTab === 'timeline' && (
              <div className="p-6"><DealTimeline dealId={deal.id} showFilters maxItems={200} refreshKey={`${deal.updatedAt?.getTime?.() ?? ''}`} /></div>
            )}

            {state.activeTab === 'insights' && (
              <div className="p-6"><DealInsightsTab dealId={deal.id} /></div>
            )}

            {state.activeTab === 'assistant' && (
              <div className="p-6"><DealAssistantPanel dealId={deal.id} /></div>
            )}

            {state.activeTab === 'journey' && (
              <div className="p-6">
                <DealActivityPanel dealId={state.editedDeal.id} refreshKey={`${deal.updatedAt?.getTime?.() ?? ''}`} />
              </div>
            )}

            {state.activeTab === 'communication' && (
              <div className="p-6">
                <DealCommunicationHub deal={state.editedDeal} contact={state.linkedContact} refreshKey={commsRefresh} />
              </div>
            )}

            {state.activeTab === 'analytics' && (
              <div className="p-6">
                <DealAnalyticsDashboard deal={state.editedDeal} />
              </div>
            )}

            {state.activeTab === 'automation' && (
              <div className="p-6">
                <div ref={workflowsRef} tabIndex={-1} aria-label="Deal workflows" className="outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
                  <DealAutomationPanel deal={state.editedDeal} />
                </div>
              </div>
            )}

            {state.activeTab === 'management' && (
              <div className="p-6">
                <DealManagementPanel
                  deal={state.editedDeal}
                  onUpdate={onUpdate}
                  linkedContactId={state.linkedContact?.id}
                />
              </div>
            )}

            {state.activeTab === 'calendar' && (
              <div className="p-6">
                <DealCalendarPanel
                  deal={state.editedDeal}
                  contact={state.linkedContact}
                  scheduleSignal={scheduleSignal}
                  onScheduleHandled={() => setScheduleSignal(0)}
                />
              </div>
            )}

            {state.activeTab === 'email' && state.linkedContact && (
              <div className="p-6 space-y-6">
                <section aria-label="AI email draft">
                  <AIEmailComposer contactId={state.linkedContact.id} dealId={state.editedDeal.id} />
                </section>
                <EmailComposer
                  inline
                  contact={state.linkedContact}
                  deal={state.editedDeal}
                  isOpen={true}
                  onClose={() => setTab('communication')}
                  onQueued={() => setCommsRefresh(n => n + 1)}
                />
              </div>
            )}

            {state.activeTab === 'email' && !state.linkedContact && (
              <div className="p-6">
                <NoContactNotice
                  icon="📧"
                  text="Link a contact to send emails directly from this deal."
                  onLink={() => dispatch(dealDetailActions.setShowContactSelector(true))}
                />
              </div>
            )}
          </div>
        </div>
    </>
  );

  const overlays = (
    <>
      {state.activeModal === 'emailComposer' && state.linkedContact && (
        <EmailComposer
          contact={state.linkedContact}
          deal={state.editedDeal}
          isOpen={true}
          onClose={() => dispatch(dealDetailActions.setActiveModal(null))}
          onQueued={() => setCommsRefresh(n => n + 1)}
        />
      )}

      {state.showContactSelector && (
        <ContactsModal
          isOpen={true}
          onClose={() => dispatch(dealDetailActions.setShowContactSelector(false))}
          onSelectContact={handleSelectContact}
          selectedContactId={state.linkedContact?.id}
        />
      )}

      <ManageFieldsDialog isOpen={manageFieldsOpen} onClose={() => setManageFieldsOpen(false)} />

      {merge && (
        <MergeDealsModal
          isOpen
          onClose={() => setMerge(null)}
          deals={merge.deals}
          initialIds={merge.ids}
          onMerged={survivor => { setMerge(null); if (survivor !== deal.id) openDeal(survivor); }}
        />
      )}

      <SDRResultsModal request={sdrRequest} onClose={() => setSdrRequest(null)} onRunningChange={setIsRunningSDR} />
      <RecordShortcutHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DealToasts />
    </>
  );

  if (isPanel) {
    return (
      <div className="flex h-full min-h-0 w-full bg-white dark:bg-gray-900">
        {body}
        {overlays}
      </div>
    );
  }

  if (isPage) {
    return (
      <div className="w-full h-[calc(100vh-13rem)] min-h-[32rem] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex">
        {body}
        {overlays}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-md z-[60] flex items-center justify-center p-2 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex animate-scale-in shadow-2xl">
        {body}
      </div>
      {overlays}
    </div>
  );
};
