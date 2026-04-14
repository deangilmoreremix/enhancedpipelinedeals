import React, { useReducer, useEffect, useCallback, useState } from 'react';
import { DealDetailSidebar } from './DealDetailSidebar';
import { DealDetailTabs } from './DealDetailTabs';
import { DealDetailOverview } from './DealDetailOverview';
import { DealDetailActions } from './DealDetailActions';
import { SDRResultsModal } from './SDRResultsModal';
import { DealInsightsPanel } from './DealInsightsPanel';
import { DealJourneyTimeline } from '../DealJourneyTimeline';
import { DealCommunicationHub } from '../DealCommunicationHub';
import { DealAnalyticsDashboard } from '../DealAnalyticsDashboard';
import { DealAutomationPanel } from '../DealAutomationPanel';
import { EmailComposer } from '../EmailComposer';
import { ContactsModal } from '../ContactsModal';
import { dealDetailReducer, dealDetailActions, initialDealDetailState } from './reducer';
import { useButtonActions } from '../../hooks/useButtonActions';
import { useContactStore } from '../../store/contactStore';
import { aiEnrichmentService } from '../../services/aiEnrichmentService';
import { useSmartAI } from '../../hooks/useSmartAI';
import { DealDetailModalProps } from './types';
import { sdrExecutionService } from '../../services/sdrExecutionService';
import { SDRContext } from '../../lib/agents/sdr/base';
import { SDRAgentConfigurator } from '../sdr/SDRAgentConfigurator';
import { sdrPreferencesService } from '../../services/sdrPreferencesService';
import { SDRUserPreferences } from '../../types/sdr-config';
import { InlineErrorBoundary } from '../ui/ErrorBoundary';

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

  // SDR-related state
  const [sdrResult, setSdrResult] = useState<any>(null);
  const [showSdrModal, setShowSdrModal] = useState(false);
  const [isRunningSdr, setIsRunningSdr] = useState(false);
  const [configuringAgent, setConfiguringAgent] = useState<{ id: string; name: string; config?: SDRUserPreferences } | null>(null);
  
  // Error handling state
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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
    setError(null); // Clear any previous errors
    try {
      const updated = await onUpdate(deal.id, state.editedDeal);
      dispatch(dealDetailActions.updateEditedDeal(updated));
      dispatch(dealDetailActions.setEditing(false));
      dispatch(dealDetailActions.setEditingField(null));
    } catch (error) {
      console.error('Failed to update deal:', error);
      setError('Failed to save changes. Please try again.');
      // Note: Keep current edits so user can retry without losing changes
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

    setError(null);
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
      setError('Failed to save field. Please try again.');
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



  const handleRunSDRAgent = useCallback(async (agentId: string) => {
    const startTime = Date.now();

    try {
      dispatch(dealDetailActions.setRunningSDR(true));

      const context: SDRContext = {
        contactId: state.linkedContact?.id,
        dealId: deal.id,
        metadata: {
          dealStage: deal.stage,
          dealValue: deal.value,
          contactName: state.linkedContact?.name,
          contactTitle: state.linkedContact?.title,
          contactCompany: state.linkedContact?.company,
          lastActivity: deal.updatedAt || deal.createdAt,
          dealNotes: deal.notes,
          contactNotes: state.linkedContact?.notes,
        }
      };

      console.log(`🤖 Executing SDR Agent: ${agentId}`, {
        dealId: deal.id,
        contactId: state.linkedContact?.id,
        context
      });

      const executionResult = await sdrExecutionService.executeAgent(agentId, context, 'user-1');

      console.log(`✅ SDR Agent ${agentId} completed:`, executionResult);

      // Set result for modal display
      setSdrResult({
        success: executionResult.success,
        agentId,
        agentName: agentId.replace(/sdr-|-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        message: executionResult.message || 'Agent executed successfully',
        emailData: executionResult.emailData,
        metadata: executionResult.metadata,
        executionTime: Date.now() - startTime
      });
      setShowSdrModal(true);

      // Show success message
      if (executionResult.success) {
        console.log(`🎉 ${executionResult.message || 'Agent executed successfully'}`);
      } else {
        console.error(`❌ SDR Agent failed:`, executionResult.error);
      }

    } catch (error: any) {
      console.error('Failed to execute SDR agent:', error);
      // Could show error toast here
    } finally {
      dispatch(dealDetailActions.setRunningSDR(false));
    }
  }, [deal, state.linkedContact]);

  const handleConfigureAgent = async (agentId: string, agentName: string) => {
    // Load existing user preferences
    const userPrefs = await sdrPreferencesService.getUserPreferences('user-1', agentId);

    setConfiguringAgent({
      id: agentId,
      name: agentName,
      config: userPrefs || undefined
    });
  };

  const handleSaveConfiguration = async (preferences: any) => {
    if (!configuringAgent) return;

    await sdrPreferencesService.saveUserPreferences('user-1', configuringAgent.id, preferences);
    setConfiguringAgent(null);
  };

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
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex animate-scale-in shadow-2xl relative">
        
        {/* Loading Overlay */}
        {(state.isSaving || state.isAnalyzing || state.isEnriching || state.isRunningSDR) && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-[70] flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full"></div>
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {state.isSaving ? 'Saving changes...' :
                     state.isAnalyzing ? 'Analyzing data...' :
                     state.isEnriching ? 'Enriching contact...' :
                     state.isRunningSDR ? 'Running SDR Agent...' : 'Processing...'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please wait while we complete this operation
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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
          onAction={(action) => handleAction(action as any)}
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
            onAction={(action) => handleAction(action as any)}
            onRunSDRAgent={handleRunSDRAgent}
            isRunningSDR={state.isRunningSDR}
          />

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 min-h-0">
            <div className="transition-all duration-300 ease-in-out">
              {state.activeTab === 'overview' && (
                <div className="animate-fade-in">
                  <InlineErrorBoundary componentName="Overview Tab">
                    <DealDetailOverview
                      deal={deal}
                      editedDeal={state.editedDeal}
                      linkedContact={state.linkedContact}
                      onEditField={handleEditField}
                      onStartEditingField={handleStartEditingField}
                      onSaveField={handleSaveField}
                      editingField={state.editingField}
                    />
                  </InlineErrorBoundary>
                </div>
              )}

              {state.activeTab === 'insights' && (
                <div className="animate-fade-in">
                  <InlineErrorBoundary componentName="AI Insights Tab">
                    <DealInsightsPanel
                      deal={state.editedDeal}
                      contact={state.linkedContact}
                      onAction={(action) => handleAction(action as any)}
                    />
                  </InlineErrorBoundary>
                </div>
              )}

              {state.activeTab === 'journey' && (
                <div className="p-6 animate-fade-in">
                  <InlineErrorBoundary componentName="Journey Tab">
                    <DealJourneyTimeline deal={state.editedDeal} />
                  </InlineErrorBoundary>
                </div>
              )}

              {state.activeTab === 'communication' && (
                <div className="p-6 space-y-6 animate-fade-in">
                  <InlineErrorBoundary componentName="Communication Tab">
                    <DealCommunicationHub deal={state.editedDeal} contact={state.linkedContact} />

                {/* AI SDR Outreach Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
                    🤖 AI SDR Outreach
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Generate personalized SDR emails and responses based on deal context and contact data.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Data-Enrichment SDR */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-400 text-sm">📊</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">Data-Enrichment SDR</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Enrich contact data & draft email</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfigureAgent('sdr-data-enrichment', 'Data-Enrichment SDR')}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          title="Configure Data-Enrichment SDR"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={() => handleRunSDRAgent('sdr-data-enrichment')}
                        disabled={isRunningSdr}
                        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        {isRunningSdr ? 'Running...' : 'Run SDR Agent'}
                      </button>
                    </div>

                    {/* Competitor-Aware SDR */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                            <span className="text-purple-600 dark:text-purple-400 text-sm">🎯</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">Competitor-Aware SDR</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Position against competitors</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfigureAgent('sdr-competitor-aware', 'Competitor-Aware SDR')}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          title="Configure Competitor-Aware SDR"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={() => handleRunSDRAgent('sdr-competitor-aware')}
                        disabled={isRunningSdr}
                        className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        {isRunningSdr ? 'Running...' : 'Run SDR Agent'}
                      </button>
                    </div>

                    {/* Objection-Handling SDR */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                            <span className="text-red-600 dark:text-red-400 text-sm">🚫</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">Objection-Handling SDR</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Handle negotiation objections</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfigureAgent('sdr-objection-handling', 'Objection-Handling SDR')}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          title="Configure Objection-Handling SDR"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={() => handleRunSDRAgent('sdr-objection-handling')}
                        disabled={isRunningSdr}
                        className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        {isRunningSdr ? 'Running...' : 'Run SDR Agent'}
                      </button>
                    </div>

                    {/* Follow-Up SDR */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                            <span className="text-green-600 dark:text-green-400 text-sm">📧</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">Follow-Up SDR</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Create follow-up sequences</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfigureAgent('sdr-follow-up', 'Follow-Up SDR')}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          title="Configure Follow-Up SDR"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={() => handleRunSDRAgent('sdr-follow-up')}
                        disabled={isRunningSdr}
                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        {isRunningSdr ? 'Running...' : 'Run SDR Agent'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {state.activeTab === 'analytics' && (
                <div className="p-6 animate-fade-in">
                  <DealAnalyticsDashboard deal={state.editedDeal} />
                </div>
              )}

              {state.activeTab === 'automation' && (
                <div className="p-6 space-y-6 animate-fade-in">
                  <DealAutomationPanel deal={state.editedDeal} />

                {/* SDR Agent Automation Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
                    ⚡ SDR Agent Automation
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Set up automated SDR sequences triggered by deal events and time-based schedules.
                  </p>

                  <div className="space-y-4">
                    {/* Sequence Builder */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="text-indigo-600 dark:text-indigo-400 mr-2">🔄</span>
                        Automated SDR Sequence
                      </h4>
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                          <span>Day 3: Follow-Up SDR</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                          <span>Day 7: Re-Activation SDR</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                          <span>Day 14: Win-Back SDR</span>
                        </div>
                      </div>
                      <button className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors">
                        Schedule SDR Sequence
                      </button>
                    </div>

                    {/* Trigger-Based SDR */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="text-orange-600 dark:text-orange-400 mr-2">🎯</span>
                        Event-Triggered SDR
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">High-Intent SDR</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Trigger: Demo request received</div>
                          </div>
                          <button className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-md transition-colors">
                            Configure
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">Event-Based SDR</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Trigger: Webinar registration</div>
                          </div>
                          <button className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-md transition-colors">
                            Configure
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Manual SDR Triggers */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="text-green-600 dark:text-green-400 mr-2">🚀</span>
                        Manual SDR Triggers
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          onClick={() => handleRunSDRAgent('sdr-follow-up')}
                          disabled={isRunningSdr}
                          className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          <span>📧</span>
                          <span>Run Follow-Up SDR</span>
                        </button>
                        <button
                          onClick={() => handleRunSDRAgent('sdr-reactivation')}
                          disabled={isRunningSdr}
                          className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors"
                        >
                          <span>🔄</span>
                          <span>Run Re-Activation SDR</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )}
            </div>
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

      {/* SDR Results Modal */}
      <SDRResultsModal
        isOpen={showSdrModal}
        onClose={() => setShowSdrModal(false)}
        result={sdrResult}
        onCopyEmail={(subject, body) => {
          const fullText = `Subject: ${subject}\n\n${body}`;
          navigator.clipboard.writeText(fullText);
        }}
        onSendEmail={(subject, body) => {
          // Open email composer with pre-filled content
          dispatch(dealDetailActions.setActiveModal('emailComposer'));
          // Could pass the email content to the composer here
        }}
        onEditEmail={(subject, body) => {
          // Open email composer with pre-filled content for editing
          dispatch(dealDetailActions.setActiveModal('emailComposer'));
          // Could pass the email content to the composer here
        }}
      />

      {/* SDR Agent Configuration Modal */}
      {configuringAgent && (
        <SDRAgentConfigurator
          agentId={configuringAgent.id}
          agentName={configuringAgent.name}
          currentConfig={configuringAgent.config}
          onSave={handleSaveConfiguration}
          onClose={() => setConfiguringAgent(null)}
          isOpen={true}
        />
      )}

      {/* Error Notification Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-[80] animate-slide-up">
          <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center space-x-3 border border-red-600">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-white hover:text-red-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};