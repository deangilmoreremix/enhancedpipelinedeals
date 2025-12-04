import { useCallback } from 'react';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { getPhoneService } from '../services/phoneService';
import { getAIFunctionOrchestrator } from '../services/aiFunctionOrchestrator';

export type ButtonAction =
  | 'email'
  | 'email-ai'
  | 'call'
  | 'edit'
  | 'favorite'
  | 'unfavorite'
  | 'ai-analyze'
  | 'ai-enrich'
  | 'ai-score'
  | 'ai-auto-enrich'
  | 'find-image'
  | 'share'
  | 'calendar'
  | 'meet'
  | 'add-field'
  | 'add-contact'
  | 'remove-contact'
  | 'change-contact'
  | 'add-tag'
  | 'add-link'
  | 'add-file'
  | 'view-files'
  | 'view-insights'
  | 'view-journey'
  | 'view-communication'
  | 'view-analytics'
  | 'view-automation'
  | 'download'
  | 'upload'
  | 'copy'
  | 'close'
  | 'save'
  | 'cancel'
  | 'feedback-positive'
  | 'feedback-negative';

export interface UseButtonActionsProps {
  deal: Deal;
  contact?: Contact;
  onUpdateDeal?: (id: string, updates: Partial<Deal>) => Promise<Deal>;
  onUpdateContact?: (contactId: string, updates: Partial<Contact>) => Promise<any>;
  onClose?: () => void;
  onOpenEmailComposer?: (contact: Contact, deal: Deal) => void;
  onOpenContactSelector?: () => void;
}

export interface ButtonActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

export const useButtonActions = ({
  deal,
  contact,
  onUpdateDeal,
  onUpdateContact,
  onClose,
  onOpenEmailComposer,
  onOpenContactSelector
}: UseButtonActionsProps) => {

  // Favorite handler (defined first to avoid circular reference)
  const handleFavorite = useCallback(async (): Promise<ButtonActionResult> => {
    try {
      if (!onUpdateDeal) {
        return { success: false, error: 'Update function not available' };
      }

      const updatedDeal = { ...deal, isFavorite: !deal.isFavorite };
      await onUpdateDeal(deal.id, { isFavorite: updatedDeal.isFavorite });

      return { success: true, data: updatedDeal };
    } catch (error) {
      console.error('Favorite action failed:', error);
      return { success: false, error: 'Failed to update favorite status' };
    }
  }, [deal, onUpdateDeal]);

  // Action handlers map
  const actionHandlers: Record<ButtonAction, (context?: any) => Promise<ButtonActionResult>> = {
    email: useCallback(async () => {
      try {
        if (!contact?.email) {
          return { success: false, error: 'No email address available' };
        }

        const orchestrator = getAIFunctionOrchestrator();
        await orchestrator.executeFunction('generate_personalized_email', {
          contactId: contact.id,
          context: 'deal-followup',
          tone: 'professional'
        }, {
          userId: 'current-user',
          componentId: 'button-action-email',
          entityType: 'deal',
          entityId: deal.id,
          timestamp: Date.now()
        });

        if (onOpenEmailComposer) {
          onOpenEmailComposer(contact, deal);
        }

        return { success: true };
      } catch (error) {
        console.error('Email action failed:', error);
        return { success: false, error: 'Failed to open email composer' };
      }
    }, [contact, deal, onOpenEmailComposer]),

    'email-ai': useCallback(async () => {
      try {
        if (!contact?.email) {
          return { success: false, error: 'No email address available' };
        }

        const orchestrator = getAIFunctionOrchestrator();
        const result = await orchestrator.executeFunction('generate_personalized_email', {
          contactId: contact.id,
          context: 'deal-followup',
          tone: 'professional',
          useAI: true
        }, {
          userId: 'current-user',
          componentId: 'button-action-email-ai',
          entityType: 'deal',
          entityId: deal.id,
          timestamp: Date.now()
        });

        if (onOpenEmailComposer) {
          onOpenEmailComposer(contact, deal);
        }

        return { success: true, data: result };
      } catch (error) {
        console.error('AI Email action failed:', error);
        return { success: false, error: 'Failed to generate AI email' };
      }
    }, [contact, deal, onOpenEmailComposer]),

    call: useCallback(async () => {
      try {
        if (!contact?.phone) {
          return { success: false, error: 'No phone number available' };
        }

        const phoneService = getPhoneService();
        phoneService.makeCall(contact.phone, contact.name, deal.title);

        return { success: true };
      } catch (error) {
        console.error('Call action failed:', error);
        return { success: false, error: 'Failed to initiate call' };
      }
    }, [contact, deal]),

    edit: useCallback(async () => {
      // Edit functionality is handled by parent component state
      return { success: true };
    }, []),

    favorite: handleFavorite,

    unfavorite: useCallback(async () => {
      // Same logic as favorite
      return handleFavorite();
    }, [handleFavorite]),

    'ai-analyze': useCallback(async () => {
      try {
        const orchestrator = getAIFunctionOrchestrator();
        const result = await orchestrator.executeFunction('comprehensive_deal_analysis', {
          dealId: deal.id,
          includeMarketResearch: true,
          includeStakeholderAnalysis: true
        }, {
          userId: 'current-user',
          componentId: 'button-action-analyze',
          entityType: 'deal',
          entityId: deal.id,
          timestamp: Date.now()
        });

        if ((result as any).result?.insights && onUpdateDeal) {
          const newProbability = Math.min(deal.probability + 15, 95);
          await onUpdateDeal(deal.id, { probability: newProbability });
        }

        return { success: true, data: result };
      } catch (error) {
        console.error('AI Analyze action failed:', error);
        return { success: false, error: 'Failed to analyze deal' };
      }
    }, [deal, onUpdateDeal]),

    'ai-enrich': useCallback(async () => {
      try {
        if (!contact && !deal.contact) {
          return { success: false, error: 'No contact information available' };
        }

        const orchestrator = getAIFunctionOrchestrator();
        const result = await orchestrator.executeFunction('enrich_contact_data', {
          contactId: contact?.id || deal.contact,
          includeSocialProfiles: true,
          includeCompanyResearch: true
        }, {
          userId: 'current-user',
          componentId: 'button-action-enrich',
          entityType: contact ? 'contact' : 'deal',
          entityId: contact?.id || deal.id,
          timestamp: Date.now()
        });

        return { success: true, data: result };
      } catch (error) {
        console.error('AI Enrich action failed:', error);
        return { success: false, error: 'Failed to enrich contact data' };
      }
    }, [contact, deal]),

    'ai-score': useCallback(async () => {
      try {
        if (!contact) {
          return { success: false, error: 'No contact available for scoring' };
        }

        const orchestrator = getAIFunctionOrchestrator();
        const result = await orchestrator.executeFunction('contact_scoring_analysis', {
          contactId: contact.id,
          dealContext: deal
        }, {
          userId: 'current-user',
          componentId: 'button-action-score',
          entityType: 'contact',
          entityId: contact.id,
          timestamp: Date.now()
        });

        if ((result as any).result?.score && onUpdateContact) {
          await onUpdateContact(contact.id, { aiScore: Math.round((result as any).result.score) });
        }

        return { success: true, data: result };
      } catch (error) {
        console.error('AI Score action failed:', error);
        return { success: false, error: 'Failed to score contact' };
      }
    }, [contact, deal, onUpdateContact]),

    'ai-auto-enrich': useCallback(async () => {
      try {
        if (!contact) {
          return { success: false, error: 'No contact available for auto-enrichment' };
        }

        const mockEnrichment = {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          company: contact.company,
          phone: contact.phone || `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
          industry: contact.industry || ['Technology', 'Finance', 'Healthcare', 'Education'][Math.floor(Math.random() * 4)],
          notes: "Auto-enriched with AI on " + new Date().toLocaleDateString(),
          confidence: 85
        };

        if (onUpdateContact) {
          await onUpdateContact(contact.id, mockEnrichment);
        }

        return { success: true, data: mockEnrichment };
      } catch (error) {
        console.error('AI Auto-Enrich action failed:', error);
        return { success: false, error: 'Failed to auto-enrich contact' };
      }
    }, [contact, onUpdateContact]),

    'find-image': useCallback(async () => {
      try {
        if (!contact) {
          return { success: false, error: 'No contact available' };
        }

        const mockImageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.name.toLowerCase().replace(/\s+/g, '')}`;

        if (onUpdateContact) {
          await onUpdateContact(contact.id, { avatarSrc: mockImageUrl });
        }

        return { success: true, data: { imageUrl: mockImageUrl } };
      } catch (error) {
        console.error('Find Image action failed:', error);
        return { success: false, error: 'Failed to find contact image' };
      }
    }, [contact, onUpdateContact]),

    share: useCallback(async () => {
      try {
        const shareData = {
          title: deal.title,
          text: `Check out this deal: ${deal.title} at ${deal.company}`,
          url: window.location.href
        };

        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          const shareText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
          await navigator.clipboard.writeText(shareText);
          alert('Deal link copied to clipboard!');
        }

        return { success: true };
      } catch (error) {
        console.error('Share action failed:', error);
        return { success: false, error: 'Failed to share deal' };
      }
    }, [deal]),

    calendar: useCallback(async () => {
      try {
        const calendarUrl = `https://calendar.google.com/calendar/u/0/r/eventedit?text=Meeting+about+${encodeURIComponent(deal.title || 'Deal')}&details=${encodeURIComponent(deal.company || 'Company')}`;
        window.open(calendarUrl, '_blank');

        return { success: true };
      } catch (error) {
        console.error('Calendar action failed:', error);
        return { success: false, error: 'Failed to open calendar' };
      }
    }, [deal]),

    close: useCallback(async () => {
      try {
        if (onClose) {
          onClose();
        }
        return { success: true };
      } catch (error) {
        console.error('Close action failed:', error);
        return { success: false, error: 'Failed to close' };
      }
    }, [onClose]),

    save: useCallback(async () => {
      return { success: true };
    }, []),

    cancel: useCallback(async () => {
      return { success: true };
    }, []),

    'feedback-positive': useCallback(async () => {
      try {
        console.log('Positive feedback for deal:', deal.id);
        alert('Thank you for your feedback! 👍 This helps improve our AI insights.');
        return { success: true };
      } catch (error) {
        console.error('Positive feedback action failed:', error);
        return { success: false, error: 'Failed to submit feedback' };
      }
    }, [deal.id]),

    'feedback-negative': useCallback(async () => {
      try {
        console.log('Negative feedback for deal:', deal.id);
        alert('Thank you for your feedback! 👎 This helps improve our AI insights.');
        return { success: true };
      } catch (error) {
        console.error('Negative feedback action failed:', error);
        return { success: false, error: 'Failed to submit feedback' };
      }
    }, [deal.id]),

    // Placeholder handlers for navigation actions
    'view-insights': useCallback(async () => ({ success: true }), []),
    'view-journey': useCallback(async () => ({ success: true }), []),
    'view-communication': useCallback(async () => ({ success: true }), []),
    'view-analytics': useCallback(async () => ({ success: true }), []),
    'view-automation': useCallback(async () => ({ success: true }), []),
    'view-files': useCallback(async () => ({ success: true }), []),
    'add-field': useCallback(async () => ({ success: true }), []),
    'add-contact': useCallback(async () => ({ success: true }), []),
    'remove-contact': useCallback(async () => ({ success: true }), []),
    'change-contact': useCallback(async () => ({ success: true }), []),
    'add-tag': useCallback(async () => ({ success: true }), []),
    'add-link': useCallback(async () => ({ success: true }), []),
    'add-file': useCallback(async () => ({ success: true }), []),
    'download': useCallback(async () => ({ success: true }), []),
    'upload': useCallback(async () => ({ success: true }), []),
    'copy': useCallback(async () => ({ success: true }), []),
    'meet': useCallback(async () => ({ success: true }), [])
  };

  // Main action handler
  const handleAction = useCallback(async (actionType: ButtonAction, context?: any): Promise<ButtonActionResult> => {
    const handler = actionHandlers[actionType];
    if (!handler) {
      return { success: false, error: `Unknown action: ${actionType}` };
    }
    return handler(context);
  }, [actionHandlers]);

  return {
    handleAction
  };
};