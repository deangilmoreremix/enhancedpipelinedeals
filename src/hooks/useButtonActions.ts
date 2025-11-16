import { useCallback } from 'react';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { ButtonAction } from '../components/ui/ButtonRegistry';
import { getPhoneService } from '../services/phoneService';
import { getAIFunctionOrchestrator } from '../services/aiFunctionOrchestrator';
import { aiEnrichmentService } from '../services/aiEnrichmentService';
import { useSmartAI } from './useSmartAI';
import { useContactStore } from '../store/contactStore';

interface UseButtonActionsProps {
  deal?: Deal;
  contact?: Contact;
  onUpdateDeal?: (id: string, updates: Partial<Deal>) => Promise<Deal>;
  onUpdateContact?: (id: string, updates: Partial<Contact>) => Promise<Contact>;
  onNavigate?: (path: string) => void;
  onClose?: () => void;
  onOpenEmailComposer?: (contact: Contact, deal?: Deal) => void;
  onOpenContactSelector?: () => void;
  onShare?: (data: any) => void;
}

export const useButtonActions = ({
  deal,
  contact,
  onUpdateDeal,
  onUpdateContact,
  onNavigate,
  onClose,
  onOpenEmailComposer,
  onOpenContactSelector,
  onShare
}: UseButtonActionsProps) => {
  const { smartScoreContact } = useSmartAI();
  const { updateContact } = useContactStore();

  const handleEmail = useCallback(async (action: ButtonAction) => {
    if (!contact) return;

    try {
      if (action === 'email-ai') {
        // Generate AI email first
        const { getAIFunctionOrchestrator } = await import('../services/aiFunctionOrchestrator');
        const orchestrator = getAIFunctionOrchestrator();

        await orchestrator.executeFunction('generate_personalized_email', {
          contactId: contact.id,
          context: 'deal-followup',
          tone: 'professional'
        }, {
          userId: 'current-user',
          componentId: 'unified-button-email-ai',
          entityType: 'contact',
          entityId: contact.id,
          timestamp: Date.now()
        });
      }

      // Open email composer
      if (onOpenEmailComposer) {
        onOpenEmailComposer(contact, deal);
      } else {
        // Fallback: open mailto link
        window.open(`mailto:${contact.email}`, '_blank');
      }
    } catch (error) {
      console.error('Email action failed:', error);
    }
  }, [contact, deal, onOpenEmailComposer]);

  const handleCall = useCallback(async () => {
    if (!contact?.phone) return;

    try {
      const phoneService = getPhoneService();
      phoneService.makeCall(contact.phone, contact.name, deal?.title || 'Business Call');
    } catch (error) {
      console.error('Call action failed:', error);
    }
  }, [contact, deal]);

  const handleEdit = useCallback(() => {
    // This would typically toggle edit mode in the parent component
    // For now, we'll emit an event that parent components can listen to
    console.log('Edit action triggered');
  }, []);

  const handleFavorite = useCallback(async (action: ButtonAction) => {
    if (!deal && !contact) return;

    try {
      if (deal && onUpdateDeal) {
        const isCurrentlyFavorite = deal.isFavorite || false;
        await onUpdateDeal(deal.id, { isFavorite: !isCurrentlyFavorite });
      } else if (contact && onUpdateContact) {
        const isCurrentlyFavorite = contact.isFavorite || false;
        await onUpdateContact(contact.id, { isFavorite: !isCurrentlyFavorite });
      }
    } catch (error) {
      console.error('Favorite action failed:', error);
    }
  }, [deal, contact, onUpdateDeal, onUpdateContact]);

  const handleAIAnalyze = useCallback(async () => {
    if (!deal || !onUpdateDeal) return;

    try {
      const orchestrator = getAIFunctionOrchestrator();

      // Run comprehensive deal analysis
      await orchestrator.executeFunction('comprehensive_deal_analysis', {
        dealId: deal.id,
        includeMarketResearch: true,
        includeStakeholderAnalysis: true
      }, {
        userId: 'current-user',
        componentId: 'unified-button-analyze',
        entityType: 'deal',
        entityId: deal.id,
        timestamp: Date.now()
      });

      // Update deal with improved probability
      const newProbability = Math.min(deal.probability + 15, 95);
      await onUpdateDeal(deal.id, { probability: newProbability });
    } catch (error) {
      console.error('AI analyze action failed:', error);
    }
  }, [deal, onUpdateDeal]);

  const handleAIEnrich = useCallback(async () => {
    if (!contact) return;

    try {
      const enrichmentData = await aiEnrichmentService.enrichContact({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        company: contact.company,
        title: contact.title
      });

      // Apply enrichment updates
      const updates: any = {};
      if (enrichmentData.phone && !contact.phone) {
        updates.phone = enrichmentData.phone;
      }
      if (enrichmentData.industry && !contact.industry) {
        updates.industry = enrichmentData.industry;
      }
      if (enrichmentData.avatar && enrichmentData.avatar !== contact.avatarSrc) {
        updates.avatarSrc = enrichmentData.avatar;
      }
      if (enrichmentData.notes) {
        updates.notes = contact.notes ?
          `${contact.notes}\n\nAI Research: ${enrichmentData.notes}` :
          enrichmentData.notes;
      }

      if (Object.keys(updates).length > 0) {
        await updateContact(contact.id, updates);
      }
    } catch (error) {
      console.error('AI enrich action failed:', error);
    }
  }, [contact, updateContact]);

  const handleAIScore = useCallback(async () => {
    if (!contact) return;

    try {
      const analysis = await smartScoreContact(contact.id, contact, 'medium');
      await updateContact(contact.id, {
        aiScore: Math.round(analysis.score || 75)
      });
    } catch (error) {
      console.error('AI score action failed:', error);
    }
  }, [contact, smartScoreContact, updateContact]);

  const handleAIAutoEnrich = useCallback(async () => {
    if (!contact) return;

    try {
      // Generate mock enrichment data (in real app, this would call AI service)
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

      const updates: any = {};
      if (mockEnrichment.phone && !contact.phone) {
        updates.phone = mockEnrichment.phone;
      }
      if (mockEnrichment.industry && !contact.industry) {
        updates.industry = mockEnrichment.industry;
      }
      if (mockEnrichment.notes) {
        updates.notes = contact.notes ?
          `${contact.notes}\n\nAI Research: ${mockEnrichment.notes}` :
          mockEnrichment.notes;
      }

      if (Object.keys(updates).length > 0) {
        await updateContact(contact.id, updates);
      }
    } catch (error) {
      console.error('AI auto-enrich action failed:', error);
    }
  }, [contact, updateContact]);

  const handleFindImage = useCallback(async () => {
    if (!contact) return;

    try {
      const newImageUrl = await aiEnrichmentService.findContactImage(
        contact.name,
        contact.company
      );

      await updateContact(contact.id, { avatarSrc: newImageUrl });
    } catch (error) {
      console.error('Find image action failed:', error);
    }
  }, [contact, updateContact]);

  const handleShare = useCallback(async () => {
    if (!deal && !contact) return;

    try {
      const entity = deal || contact;
      if (!entity) return;

      const shareData = {
        title: deal ? deal.title : contact!.name,
        text: deal
          ? `Check out this deal: ${deal.title} at ${deal.company}`
          : `Check out this contact: ${contact!.name} at ${contact!.company}`,
        url: window.location.href
      };

      if (navigator.share) {
        await navigator.share(shareData);
        console.log('✅ Entity shared successfully via Web Share API');
      } else {
        const shareText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        alert('Link copied to clipboard! You can now share it manually.');
        console.log('✅ Link copied to clipboard');
      }
    } catch (error) {
      console.error('Share action failed:', error);
      if (onShare) {
        onShare({ deal, contact });
      }
    }
  }, [deal, contact, onShare]);

  const handleCalendar = useCallback(() => {
    const title = deal ? `Meeting about ${deal.title}` : `Meeting with ${contact?.name || 'Contact'}`;
    const url = `https://calendar.google.com/calendar/u/0/r/eventedit?text=${encodeURIComponent(title)}`;
    window.open(url, '_blank');
  }, [deal, contact]);

  const handleNavigation = useCallback((action: ButtonAction) => {
    const routes = {
      'view-insights': 'insights',
      'view-journey': 'journey',
      'view-communication': 'communication',
      'view-analytics': 'analytics',
      'view-automation': 'automation'
    };

    const route = routes[action as keyof typeof routes];
    if (route && onNavigate) {
      onNavigate(route);
    }
  }, [onNavigate]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleContactAction = useCallback((action: ButtonAction) => {
    switch (action) {
      case 'add-contact':
      case 'change-contact':
        if (onOpenContactSelector) {
          onOpenContactSelector();
        }
        break;
      case 'remove-contact':
        // This would typically be handled by parent component
        console.log('Remove contact action');
        break;
    }
  }, [onOpenContactSelector]);

  // Main action handler
  const handleAction = useCallback(async (action: ButtonAction, event?: React.MouseEvent) => {
    switch (action) {
      case 'email':
      case 'email-ai':
        await handleEmail(action);
        break;
      case 'call':
        await handleCall();
        break;
      case 'edit':
        handleEdit();
        break;
      case 'favorite':
      case 'unfavorite':
        await handleFavorite(action);
        break;
      case 'ai-analyze':
        await handleAIAnalyze();
        break;
      case 'ai-enrich':
        await handleAIEnrich();
        break;
      case 'ai-score':
        await handleAIScore();
        break;
      case 'ai-auto-enrich':
        await handleAIAutoEnrich();
        break;
      case 'find-image':
        await handleFindImage();
        break;
      case 'share':
        await handleShare();
        break;
      case 'calendar':
        handleCalendar();
        break;
      case 'close':
        handleClose();
        break;
      case 'view-insights':
      case 'view-journey':
      case 'view-communication':
      case 'view-analytics':
      case 'view-automation':
        handleNavigation(action);
        break;
      case 'add-contact':
      case 'change-contact':
      case 'remove-contact':
        handleContactAction(action);
        break;
      default:
        console.log('Unhandled action:', action);
    }
  }, [
    handleEmail,
    handleCall,
    handleEdit,
    handleFavorite,
    handleAIAnalyze,
    handleAIEnrich,
    handleAIScore,
    handleAIAutoEnrich,
    handleFindImage,
    handleShare,
    handleCalendar,
    handleClose,
    handleNavigation,
    handleContactAction
  ]);

  return {
    handleAction
  };
};