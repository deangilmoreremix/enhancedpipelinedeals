import React, { useReducer, useEffect, useCallback } from 'react';
import { DealDetailSidebar } from './DealDetailSidebar';
import { DealDetailTabs } from './DealDetailTabs';
import { DealDetailOverview } from './DealDetailOverview';
import { DealDetailActions } from './DealDetailActions';
import { DealJourneyTimeline } from '../DealJourneyTimeline';
import { DealCommunicationHub } from '../DealCommunicationHub';
import { DealAnalyticsDashboard } from '../DealAnalyticsDashboard';
import { DealAutomationPanel } from '../DealAutomationPanel';
import DealManagementPanel from './DealManagementPanel';
import { EmailComposer } from '../EmailComposer';
import { ContactsModal } from '../ContactsModal';
import { dealDetailReducer, dealDetailActions, initialDealDetailState } from './reducer';
import { useButtonActions } from '../../hooks/useButtonActions';
import { useContactStore } from '../../store/contactStore';
import { aiEnrichmentService } from '../../services/aiEnrichmentService';
import { useSmartAI } from '../../hooks/useSmartAI';
import { DealDetailModalProps } from './types';

export const DealDetailModal: React.FC<DealDetailModalProps> = ({
  deal,
  isOpen,
  onClose,
  onUpdate,
  contactData,
  onAddContact
}) => {
  const { contacts, updateContact } = useContactStore();
  const { smartScoreContact } = useSmartAI();

  // Initialize state with useReducer
  const [state, dispatch] = useReducer(
    dealDetailReducer,
    initialDealDetailState(deal, contactData)
  );

  // Unified button actions
  const { handleAction } = useButtonActions({
    deal: state.editedDeal,
    contact: state.linkedContact || undefined,
    onUpdateDeal: onUpdate,
    onUpdateContact: updateContact,
    onClose,
    onOpenEmailComposer: () => dispatch(dealDetailActions.setActiveModal('emailComposer')),
    onOpenContactSelector: () => dispatch(dealDetailActions.setShowContactSelector(true))
  });

  // Update state when deal or contactData changes
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
    }
  }, [deal.contactId, contactData, contacts]);

  // Business logic functions
  const handleSave = useCallback(async () => {
    dispatch(dealDetailActions.setSaving(true));
    try {
      const updated = await onUpdate(deal.id, state.editedDeal);
      dispatch(dealDetailActions.updateEditedDeal(updated));
      dispatch(dealDetailActions.setEditing(false));
      dispatch(dealDetailActions.setEditingField(null));
    } catch (error) {
      console.error('Failed to update deal:', error);
    } finally {
      dispatch(dealDetailActions.setSaving(false));
    }
  }, [deal.id, state.editedDeal, onUpdate]);

  const handleCancel = useCallback(() => {
    dispatch(dealDetailActions.updateEditedDeal(deal));
    dispatch(dealDetailActions.setEditing(false));
    dispatch(dealDetailActions.setShowAddField(false));
    dispatch(dealDetailActions.setNewFieldName(''));
    dispatch(dealDetailActions.setNewFieldValue(''));
    dispatch(dealDetailActions.setEditingField(null));
    dispatch(dealDetailActions.setShowAddSocial(false));
    dispatch(dealDetailActions.setSocialFieldValue(''));
    dispatch(dealDetailActions.setSelectedSocialPlatform(''));
    dispatch(dealDetailActions.setShowAddSource(false));
    dispatch(dealDetailActions.setAddSource(''));
    dispatch(dealDetailActions.setEditInterestLevel(false));
  }, [deal]);

  const handleToggleFavorite = useCallback(async () => {
    const updatedDeal = { ...state.editedDeal, isFavorite: !state.editedDeal.isFavorite };
    dispatch(dealDetailActions.updateEditedDeal(updatedDeal));

    try {
      await onUpdate(deal.id, { isFavorite: updatedDeal.isFavorite });
    } catch (error) {
      console.error('Failed to update favorite status:', error);
      dispatch(dealDetailActions.updateEditedDeal(deal));
    }
  }, [deal.id, state.editedDeal.isFavorite, onUpdate]);

  const handleEditField = useCallback((field: string, value: any) => {
    dispatch(dealDetailActions.updateEditedDeal({ [field]: value }));
  }, []);

  const handleStartEditingField = useCallback((field: string) => {
    dispatch(dealDetailActions.setEditingField(field));
  }, []);

  const handleSaveField = useCallback(async () => {
    if (!state.editingField) return;

    try {
      let updates: Partial<any> = {};

      if (state.editingField.startsWith('custom_')) {
        const fieldName = state.editingField.replace('custom_', '');
        const customFields = {
          ...(state.editedDeal.customFields || {}),
        };
        updates = { customFields };
      } else {
        const fieldValue = state.editedDeal[state.editingField as keyof typeof state.editedDeal];
        updates = { [state.editingField]: fieldValue };
      }

      await onUpdate(deal.id, updates);
      dispatch(dealDetailActions.setEditingField(null));
    } catch (error) {
      console.error('Failed to update field:', error);
    }
  }, [state.editingField, state.editedDeal, deal.id, onUpdate]);

  const handleAnalyzeDeal = useCallback(async () => {
    dispatch(dealDetailActions.setAnalyzing(true));
    try {
      const newProbability = Math.min(state.editedDeal.probability + 15, 95);
      const updatedDeal = { ...state.editedDeal, probability: newProbability };
      dispatch(dealDetailActions.updateEditedDeal(updatedDeal));
      await onUpdate(deal.id, { probability: newProbability });
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      dispatch(dealDetailActions.setAnalyzing(false));
    }
  }, [state.editedDeal, deal.id, onUpdate]);

  const handleContactAnalysis = useCallback(async () => {
    if (!state.linkedContact) return;

    dispatch(dealDetailActions.setAnalyzing(true));
    try {
      const analysis = await smartScoreContact(state.linkedContact.id, state.linkedContact, 'medium');
      await updateContact(state.linkedContact.id, {
        aiScore: Math.round(analysis.score || 75),
        notes: state.linkedContact.notes ?
          `${state.linkedContact.notes}\n\nAI Analysis: ${analysis.insights?.join('. ') || 'Analysis completed'}` :
          `AI Analysis: ${analysis.insights?.join('. ') || 'Analysis completed'}`
      });

      dispatch(dealDetailActions.setLinkedContact({
        ...state.linkedContact,
        aiScore: Math.round(analysis.score || 75)
      }));
    } catch (error) {
      console.error('Contact analysis failed:', error);
    } finally {
      dispatch(dealDetailActions.setAnalyzing(false));
    }
  }, [state.linkedContact, smartScoreContact, updateContact]);

  const handleContactEnrichment = useCallback(async (enrichmentData: any) => {
    if (!state.linkedContact) return;

    dispatch(dealDetailActions.setLastEnrichment(enrichmentData));
    dispatch(dealDetailActions.setEnriching(true));

    try {
      const updates: any = {};

      if (enrichmentData.phone && !state.linkedContact.phone) {
        updates.phone = enrichmentData.phone;
      }
      if (enrichmentData.industry && !state.linkedContact.industry) {
        updates.industry = enrichmentData.industry;
      }
      if (enrichmentData.avatar && enrichmentData.avatar !== state.linkedContact.avatarSrc) {
        updates.avatarSrc = enrichmentData.avatar;
      }
      if (enrichmentData.notes) {
        updates.notes = state.linkedContact.notes ?
          `${state.linkedContact.notes}\n\nAI Research: ${enrichmentData.notes}` :
          enrichmentData.notes;
      }

      if (enrichmentData.socialProfiles) {
        const socialUpdates: any = {};
        Object.entries(enrichmentData.socialProfiles).forEach(([key, value]) => {
          if (value && !state.linkedContact!.socialProfiles?.[key as keyof typeof state.linkedContact.socialProfiles]) {
            socialUpdates[key] = value;
          }
        });
        if (Object.keys(socialUpdates).length > 0) {
          updates.socialProfiles = { ...state.linkedContact.socialProfiles, ...socialUpdates };
        }
      }

      if (enrichmentData.confidence) {
        updates.aiScore = Math.round(enrichmentData.confidence);
      }

      const updatedContact = { ...state.linkedContact, ...updates };
      dispatch(dealDetailActions.setLinkedContact(updatedContact));

      if (Object.keys(updates).length > 0) {
        await updateContact(state.linkedContact.id, updates);
      }
    } catch (error) {
      console.error('Failed to apply enrichment:', error);
    } finally {
      dispatch(dealDetailActions.setEnriching(false));
    }
  }, [state.linkedContact, updateContact]);

  const handleFindNewImage = useCallback(async () => {
    if (!state.linkedContact) return;

    dispatch(dealDetailActions.setEnriching(true));
    try {
      const newImageUrl = await aiEnrichmentService.findContactImage(
        state.linkedContact.name,
        state.linkedContact.company
      );

      const updatedContact = { ...state.linkedContact, avatarSrc: newImageUrl };
      dispatch(dealDetailActions.setLinkedContact(updatedContact));

      await updateContact(state.linkedContact.id, { avatarSrc: newImageUrl });
    } catch (error) {
      console.error('Failed to find new image:', error);
    } finally {
      dispatch(dealDetailActions.setEnriching(false));
    }
  }, [state.linkedContact, updateContact]);

  const handleSelectContact = useCallback((contact: any) => {
    dispatch(dealDetailActions.setLinkedContact(contact));
    dispatch(dealDetailActions.updateEditedDeal({
      contact: contact.name,
      contactId: contact.id
    }));
    onUpdate(deal.id, { contact: contact.name, contactId: contact.id });
    dispatch(dealDetailActions.setShowContactSelector(false));
  }, [deal.id, onUpdate]);

  const handleRemoveContact = useCallback(() => {
    dispatch(dealDetailActions.setLinkedContact(null));
    dispatch(dealDetailActions.updateEditedDeal({
      contact: '',
      contactId: undefined
    }));
    onUpdate(deal.id, { contact: '', contactId: undefined });
  }, [deal.id, onUpdate]);

  const handleShareDeal = useCallback(async () => {
    try {
      const shareData = {
        title: state.editedDeal.title,
        text: `Check out this deal: ${state.editedDeal.title} at ${state.editedDeal.company}`,
        url: window.location.href
      };

      if (navigator.share) {
        await navigator.share(shareData);
        console.log('✅ Deal shared successfully via Web Share API');
      } else {
        const shareText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        alert('Deal link copied to clipboard! You can now share it manually.');
        console.log('✅ Deal link copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to share deal:', error);
      const shareText = `${state.editedDeal.title} - ${state.editedDeal.company}\nValue: ${formatCurrency(state.editedDeal.value)}\nStage: ${state.editedDeal.stage}\n\nShared from CRM System`;
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Deal information copied to clipboard!');
      } catch (clipboardError) {
        alert(`Share this deal:\n\n${shareText}`);
      }
    }
  }, [state.editedDeal]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!isOpen) return null;

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

        {/* Sidebar */}
        <DealDetailSidebar
          deal={deal}
          editedDeal={state.editedDeal}
          linkedContact={state.linkedContact}
          isAnalyzing={state.isAnalyzing}
          onAnalyzeDeal={handleAnalyzeDeal}
          onContactAnalysis={handleContactAnalysis}
          onContactEnrichment={handleContactEnrichment}
          onFindNewImage={handleFindNewImage}
          onToggleFavorite={handleToggleFavorite}
          onAction={handleAction}
          onClose={onClose}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Tab Navigation */}
          <DealDetailTabs
            activeTab={state.activeTab}
            onTabChange={(tabId) => dispatch(dealDetailActions.setActiveTab(tabId))}
          />

          {/* Action Buttons */}
          <DealDetailActions
            deal={deal}
            linkedContact={state.linkedContact}
            isEditing={state.isEditing}
            isSaving={state.isSaving}
            onSave={handleSave}
            onCancel={handleCancel}
            onToggleFavorite={handleToggleFavorite}
            onShare={handleShareDeal}
            onAction={handleAction}
          />

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
            {state.activeTab === 'overview' && (
              <DealDetailOverview
                deal={deal}
                editedDeal={state.editedDeal}
                linkedContact={state.linkedContact}
                onEditField={handleEditField}
                onStartEditingField={handleStartEditingField}
                onSaveField={handleSaveField}
                editingField={state.editingField}
              />
            )}

            {state.activeTab === 'insights' && (
              <div className="p-6">
                {state.linkedContact ? (
                  <div>AI Insights Panel would go here</div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3">🤖</div>
                    <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Contact Linked</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Link a contact to this deal to view AI insights and recommendations.
                    </p>
                    <button
                      onClick={() => dispatch(dealDetailActions.setShowContactSelector(true))}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Link Contact
                    </button>
                  </div>
                )}
              </div>
            )}

            {state.activeTab === 'journey' && (
              <div className="p-6">
                <DealJourneyTimeline deal={state.editedDeal} />
              </div>
            )}

            {state.activeTab === 'communication' && (
              <div className="p-6">
                <DealCommunicationHub deal={state.editedDeal} contact={state.linkedContact} />
              </div>
            )}

            {state.activeTab === 'analytics' && (
              <div className="p-6">
                <DealAnalyticsDashboard deal={state.editedDeal} />
              </div>
            )}

            {state.activeTab === 'automation' && (
              <div className="p-6">
                <DealAutomationPanel deal={state.editedDeal} />
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
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3">📅</div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Calendar View</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    View deal-related dates and scheduled activities.
                  </p>
                  <p className="text-xs text-gray-400">Coming soon</p>
                </div>
              </div>
            )}

            {state.activeTab === 'email' && state.linkedContact && (
              <div className="p-6">
                <EmailComposer
                  contact={state.linkedContact}
                  deal={state.editedDeal}
                  isOpen={true}
                  onClose={() => {}}
                  onSend={(emailData) => {
                    console.log('📧 Email sent from email tab:', emailData);
                  }}
                />
              </div>
            )}

            {state.activeTab === 'email' && !state.linkedContact && (
              <div className="p-6">
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3">📧</div>
                  <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Contact Linked</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Link a contact to send emails directly from this deal.
                  </p>
                  <button
                    onClick={() => dispatch(dealDetailActions.setShowContactSelector(true))}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Link Contact
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {state.activeModal === 'emailComposer' && state.linkedContact && (
        <EmailComposer
          contact={state.linkedContact}
          deal={state.editedDeal}
          isOpen={true}
          onClose={() => dispatch(dealDetailActions.setActiveModal(null))}
          onSend={(emailData) => {
            console.log('📧 Email sent from deal detail:', emailData);
          }}
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
    </div>
  );
};