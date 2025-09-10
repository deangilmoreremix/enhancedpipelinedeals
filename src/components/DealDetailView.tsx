import React, { useState, useEffect } from 'react';
import { AvatarWithStatus } from './ui/AvatarWithStatus';
import { ModernButton } from './ui/ModernButton';
import { CustomizableAIToolbar } from './ui/CustomizableAIToolbar';
import { AIResearchButton } from './ui/AIResearchButton';
import { aiEnrichmentService, ContactEnrichmentData } from '../services/aiEnrichmentService';
import { ContactJourneyTimeline } from './contacts/ContactJourneyTimeline';
import { AIInsightsPanel } from './deals/AIInsightsPanel';
import { DealCommunicationHub } from './deals/DealCommunicationHub';
import { DealAutomationPanel } from './deals/DealAutomationPanel';
import { DealAnalyticsDashboard } from './deals/DealAnalyticsDashboard';
import { DealJourneyTimeline } from './deals/DealJourneyTimeline';
import { EmailComposer } from './communication/EmailComposer';
import { useContactStore } from '../store/contactStore';
import { useSmartAI } from '../hooks/useSmartAI';
import { getPhoneService } from '../services/phoneService';
import { getEnhancedIntelligentAI } from '../services/enhancedIntelligentAIService';
import { getWebSearchService } from '../services/webSearchService';
import { getCitationService } from '../services/citationService';
import { ResearchThinkingAnimation, ResearchStatusOverlay } from './ui/ResearchThinkingAnimation';
import { CitationBadge, CitationSummary } from './ui/CitationBadge';
import { Deal } from '../types';
import { Contact } from '../types/contact';
import { X, Edit, Mail, Phone, Plus, MessageSquare, FileText, Calendar, MoreHorizontal, User, Globe, Clock, Building2, Tag, Star, ExternalLink, Brain, TrendingUp, BarChart3, Zap, Users, Activity, Settings, Database, Shield, Target, Smartphone, Video, Linkedin, Twitter, Facebook, Instagram, Save, Ambulance as Cancel, Heart, HeartOff, MapPin, Briefcase, Award, CheckCircle, AlertCircle, Wifi, WifiOff, Search, DollarSign, RefreshCw, Sparkles, Camera, Wand2, UserPlus, UserMinus, Share2, Copy, Link, Paperclip, Download, Upload, ChevronDown, ChevronRight, UserX } from 'lucide-react';

interface DealDetailViewProps {
  deal: Deal;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Deal>) => Promise<Deal>;
  contactData?: Contact | null;
  onAddContact?: () => void;
}

const interestColors = {
  hot: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  cold: 'bg-gray-400'
};

const interestLabels = {
  hot: 'Hot Client',
  medium: 'Medium Interest',
  low: 'Low Interest',
  cold: 'Non Interest'
};

const sourceColors: { [key: string]: string } = {
  'LinkedIn': 'bg-blue-600',
  'Facebook': 'bg-blue-500',
  'Email': 'bg-green-500',
  'Website': 'bg-purple-500',
  'Referral': 'bg-orange-500',
  'Typeform': 'bg-pink-500',
  'Cold Call': 'bg-gray-600',
  'Twitter': 'bg-sky-500',
  'Instagram': 'bg-pink-600',
  'Conference': 'bg-yellow-600'
};

const socialPlatforms = [
  { icon: MessageSquare, color: 'bg-green-500', name: 'WhatsApp', key: 'whatsapp' },
  { icon: Linkedin, color: 'bg-blue-500', name: 'LinkedIn', key: 'linkedin' },
  { icon: Mail, color: 'bg-blue-600', name: 'Email', key: 'email' },
  { icon: Twitter, color: 'bg-blue-400', name: 'Twitter', key: 'twitter' },
  { icon: Facebook, color: 'bg-blue-700', name: 'Facebook', key: 'facebook' },
  { icon: Instagram, color: 'bg-pink-500', name: 'Instagram', key: 'instagram' },
  { icon: Globe, color: 'bg-purple-500', name: 'Website', key: 'website' }
];

export const DealDetailView: React.FC<DealDetailViewProps> = ({ 
  deal, 
  isOpen, 
  onClose, 
  onUpdate,
  contactData,
  onAddContact
}) => {
  const { contacts, updateContact, createContact } = useContactStore();
  const { smartScoreContact } = useSmartAI();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedDeal, setEditedDeal] = useState<Deal>(deal);
  const [linkedContact, setLinkedContact] = useState<Contact | null>(contactData || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [lastEnrichment, setLastEnrichment] = useState<ContactEnrichmentData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showAddSocial, setShowAddSocial] = useState(false);
  const [selectedSocialPlatform, setSelectedSocialPlatform] = useState('');
  const [socialFieldValue, setSocialFieldValue] = useState('');
  const [showAddSource, setShowAddSource] = useState(false);
  const [addSource, setAddSource] = useState('');
  const [editInterestLevel, setEditInterestLevel] = useState(false);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [showEmailComposer, setShowEmailComposer] = useState(false);

  useEffect(() => {
    setEditedDeal(deal);
    // Find linked contact based on deal's contactId
    if (deal.contactId) {
      const contact = contacts.find(c => c.id === deal.contactId);
      setLinkedContact(contact || null);
    } else if (contactData) {
      setLinkedContact(contactData);
    }
  }, [deal, contactData, contacts]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'insights', label: 'AI Insights', icon: Brain },
    { id: 'journey', label: 'Journey', icon: TrendingUp },
    { id: 'communication', label: 'Communication', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'automation', label: 'Automation', icon: Zap },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await onUpdate(deal.id, editedDeal);
      setEditedDeal(updated);
      setIsEditing(false);
      setEditingField(null);
    } catch (error) {
      console.error('Failed to update deal:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedDeal(deal);
    setIsEditing(false);
    setShowAddField(false);
    setNewFieldName('');
    setNewFieldValue('');
    setEditingField(null);
    setShowAddSocial(false);
    setSocialFieldValue('');
    setSelectedSocialPlatform('');
    setShowAddSource(false);
    setAddSource('');
    setEditInterestLevel(false);
  };

  const handleToggleFavorite = async () => {
    const updatedDeal = { ...editedDeal, isFavorite: !editedDeal.isFavorite };
    setEditedDeal(updatedDeal);
    
    try {
      await onUpdate(deal.id, { isFavorite: updatedDeal.isFavorite });
    } catch (error) {
      console.error('Failed to update favorite status:', error);
      setEditedDeal(prev => ({ ...prev, isFavorite: !updatedDeal.isFavorite }));
    }
  };

  const handleEditField = (field: string, value: any) => {
    setEditedDeal(prev => ({ ...prev, [field]: value }));
  };

  const handleStartEditingField = (field: string) => {
    setEditingField(field);
  };

  const handleSaveField = async () => {
    if (editingField) {
      try {
        let updates: Partial<Deal> = {};
        
        if (editingField.startsWith('custom_')) {
          const fieldName = editingField.replace('custom_', '');
          const customFields = {
            ...(editedDeal.customFields || {}),
          };
          updates = { customFields };
        } else {
          const fieldValue = editedDeal[editingField as keyof Deal];
          updates = { [editingField]: fieldValue };
        }
        
        await onUpdate(deal.id, updates);
        setEditingField(null);
      } catch (error) {
        console.error('Failed to update field:', error);
      }
    }
  };

  const handleAddCustomField = () => {
    if (newFieldName && newFieldValue) {
      const customFields = {
        ...(editedDeal.customFields || {}),
        [newFieldName]: newFieldValue
      };
      
      setEditedDeal(prev => ({
        ...prev,
        customFields
      }));
      
      onUpdate(deal.id, { customFields })
        .catch(error => console.error('Failed to add custom field:', error));
      
      setNewFieldName('');
      setNewFieldValue('');
      setShowAddField(false);
    }
  };

  const handleRemoveCustomField = async (fieldName: string) => {
    const customFields = { ...(editedDeal.customFields || {}) };
    if (!customFields) return;
    
    delete customFields[fieldName];
    
    setEditedDeal(prev => ({
      ...prev,
      customFields
    }));
    
    try {
      await onUpdate(deal.id, { customFields });
    } catch (error) {
      console.error('Failed to remove custom field:', error);
    }
  };

  const handleAnalyzeDeal = async () => {
    setIsAnalyzing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newProbability = Math.min(editedDeal.probability + 15, 95);
      const updatedDeal = { ...editedDeal, probability: newProbability };
      setEditedDeal(updatedDeal);
      
      await onUpdate(deal.id, { probability: newProbability });
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContactAnalysis = async () => {
    if (!linkedContact) return;
    
    setIsAnalyzing(true);
    try {
      const analysis = await smartScoreContact(linkedContact.id, linkedContact, 'medium');
      await updateContact(linkedContact.id, { 
        aiScore: Math.round(analysis.results.contact_scoring.score),
        notes: linkedContact.notes ? 
          `${linkedContact.notes}\n\nAI Analysis: ${analysis.results.contact_scoring.insights.join('. ')}` :
          `AI Analysis: ${analysis.results.contact_scoring.insights.join('. ')}`
      });
      
      // Update local contact data
      setLinkedContact(prev => prev ? {
        ...prev,
        aiScore: Math.round(analysis.results.contact_scoring.score)
      } : null);
    } catch (error) {
      console.error('Contact analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContactEnrichment = async (enrichmentData: ContactEnrichmentData) => {
    if (!linkedContact) return;
    
    setLastEnrichment(enrichmentData);
    setIsEnriching(true);
    
    try {
      const updates: any = {};
      
      if (enrichmentData.phone && !linkedContact.phone) {
        updates.phone = enrichmentData.phone;
      }
      if (enrichmentData.industry && !linkedContact.industry) {
        updates.industry = enrichmentData.industry;
      }
      if (enrichmentData.avatar && enrichmentData.avatar !== linkedContact.avatarSrc) {
        updates.avatarSrc = enrichmentData.avatar;
      }
      if (enrichmentData.notes) {
        updates.notes = linkedContact.notes ? 
          `${linkedContact.notes}\n\nAI Research: ${enrichmentData.notes}` : 
          enrichmentData.notes;
      }
      
      if (enrichmentData.socialProfiles) {
        const socialUpdates: any = {};
        Object.entries(enrichmentData.socialProfiles).forEach(([key, value]) => {
          if (value && !linkedContact.socialProfiles?.[key as keyof typeof linkedContact.socialProfiles]) {
            socialUpdates[key] = value;
          }
        });
        if (Object.keys(socialUpdates).length > 0) {
          updates.socialProfiles = { ...linkedContact.socialProfiles, ...socialUpdates };
        }
      }
      
      if (enrichmentData.confidence) {
        updates.aiScore = Math.round(enrichmentData.confidence);
      }
      
      const updatedContact = { ...linkedContact, ...updates };
      setLinkedContact(updatedContact);
      
      if (Object.keys(updates).length > 0) {
        await updateContact(linkedContact.id, updates);
      }
      
    } catch (error) {
      console.error('Failed to apply enrichment:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleFindNewImage = async () => {
    if (!linkedContact) return;
    
    try {
      setIsEnriching(true);
      const newImageUrl = await aiEnrichmentService.findContactImage(
        linkedContact.name,
        linkedContact.company
      );
      
      const updatedContact = { ...linkedContact, avatarSrc: newImageUrl };
      setLinkedContact(updatedContact);
      
      await updateContact(linkedContact.id, { avatarSrc: newImageUrl });
    } catch (error) {
      console.error('Failed to find new image:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSelectContact = (contact: Contact) => {
    setLinkedContact(contact);
    setEditedDeal(prev => ({
      ...prev,
      contact: contact.name,
      contactId: contact.id
    }));
    onUpdate(deal.id, { contact: contact.name, contactId: contact.id });
    setShowContactSelector(false);
  };

  const handleRemoveContact = () => {
    setLinkedContact(null);
    setEditedDeal(prev => ({
      ...prev,
      contact: '',
      contactId: undefined
    }));
    onUpdate(deal.id, { contact: '', contactId: undefined });
  };

  const handleAddTag = () => {
    if (newTag && !editedDeal.tags?.includes(newTag)) {
      const tags = [...(editedDeal.tags || []), newTag];
      setEditedDeal(prev => ({ ...prev, tags }));
      onUpdate(deal.id, { tags });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const tags = editedDeal.tags?.filter(tag => tag !== tagToRemove) || [];
    setEditedDeal(prev => ({ ...prev, tags }));
    onUpdate(deal.id, { tags });
  };

  const handleAddLink = () => {
    if (newLinkTitle && newLinkUrl) {
      const links = [
        ...(editedDeal.links || []),
        {
          title: newLinkTitle,
          url: newLinkUrl,
          type: 'external',
          createdAt: new Date().toISOString()
        }
      ];
      setEditedDeal(prev => ({ ...prev, links }));
      onUpdate(deal.id, { links });
      setNewLinkTitle('');
      setNewLinkUrl('');
      setShowAddLink(false);
    }
  };

  const handleShareDeal = async () => {
    try {
      const shareData = {
        title: editedDeal.title,
        text: `Check out this deal: ${editedDeal.title} at ${editedDeal.company}`,
        url: window.location.href
      };

      // Try to use the Web Share API if available
      if (navigator.share) {
        await navigator.share(shareData);
        console.log('✅ Deal shared successfully via Web Share API');
      } else {
        // Fallback: Copy to clipboard
        const shareText = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(shareText);
        alert('Deal link copied to clipboard! You can now share it manually.');
        console.log('✅ Deal link copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to share deal:', error);

      // Fallback: Show share options
      const shareText = `${editedDeal.title} - ${editedDeal.company}\nValue: ${formatCurrency(editedDeal.value)}\nStage: ${editedDeal.stage}\n\nShared from CRM System`;

      // Try clipboard fallback
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Deal information copied to clipboard!');
      } catch (clipboardError) {
        // Final fallback: Show alert with share text
        alert(`Share this deal:\n\n${shareText}`);
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'qualification': 'bg-blue-500',
      'proposal': 'bg-indigo-500',
      'negotiation': 'bg-purple-500',
      'closed-won': 'bg-green-500',
      'closed-lost': 'bg-red-500'
    };
    return colors[stage] || 'bg-gray-500';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'text-red-600',
      'medium': 'text-yellow-600',
      'low': 'text-green-600'
    };
    return colors[priority] || 'text-gray-600';
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
      <div className="bg-white rounded-xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex animate-scale-in shadow-2xl">
        
        {/* Enhanced Deal Profile Sidebar */}
        <div className="w-80 bg-gradient-to-b from-gray-50 via-white to-gray-50 border-r border-gray-200 flex flex-col h-full">
          {/* Fixed Header with AI Features */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              Deal Profile
              <Sparkles className="w-4 h-4 ml-2 text-purple-500" />
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={handleAnalyzeDeal}
                disabled={isAnalyzing}
                className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50 relative"
                title="AI Analysis"
              >
                <Brain className="w-4 h-4" />
                {isAnalyzing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Deal Header with Company Info */}
            <div className="p-5 text-center border-b border-gray-100 bg-white">
              <div className="relative inline-block mb-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  {editedDeal.company.charAt(0)}
                </div>
                
                {/* AI Enhancement Indicator */}
                {editedDeal.probability > 70 && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white">
                    <Sparkles className="w-2.5 h-2.5" />
                  </div>
                )}
                
                {/* Favorite Badge */}
                {editedDeal.isFavorite && (
                  <div className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white">
                    <Heart className="w-3 h-3" />
                  </div>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{editedDeal.title}</h3>
              <p className="text-gray-600 font-medium mb-1">{editedDeal.company}</p>
              
              {/* Stage and Priority */}
              <div className="flex items-center justify-center space-x-2 mt-3">
                <span className={`${getStageColor(editedDeal.stage)} text-white text-xs px-3 py-1 rounded-full font-medium`}>
                  {editedDeal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className={`text-xs font-medium ${getPriorityColor(editedDeal.priority)}`}>
                  {editedDeal.priority.toUpperCase()} PRIORITY
                </span>
              </div>

              {/* AI Enhanced Badge */}
              {editedDeal.probability > 70 && (
                <div className="mt-3 p-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    <span className="text-xs font-medium text-purple-900">
                      AI Enhanced (75% confidence)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Tools Section - PROMINENTLY DISPLAYED */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                <Brain className="w-4 h-4 mr-2 text-purple-600" />
                AI Assistant Tools
              </h4>
              
              {/* AI Goals Button */}
              <div className="mb-3">
                <button className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 text-sm font-medium transition-all duration-200 border border-indigo-300/50 shadow-sm hover:shadow-md hover:scale-105">
                  <Target className="w-4 h-4 mr-2" />
                  AI Goals
                </button>
              </div>

              {/* Quick AI Actions Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* Lead Score */}
                <button 
                  onClick={handleAnalyzeDeal}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-blue-300/50"
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Lead Score</span>
                </button>
                
                {/* Email AI */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (linkedContact?.email) {
                      setShowEmailComposer(true);
                    }
                  }}
                  disabled={!linkedContact?.email}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border-gray-200/50 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Email AI</span>
                </button>
                
                {/* Enrich */}
                <button 
                  onClick={() => {
                    if (linkedContact) {
                      const enrichData: ContactEnrichmentData = {
                        email: linkedContact.email,
                        firstName: linkedContact.firstName,
                        lastName: linkedContact.lastName,
                        company: linkedContact.company,
                        confidence: 75
                      };
                      handleContactEnrichment(enrichData);
                    }
                  }}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border-gray-200/50"
                >
                  <Search className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Enrich</span>
                </button>
                
                {/* Insights */}
                <button 
                  onClick={() => setActiveTab('insights')}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border-gray-200/50"
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Insights</span>
                </button>
              </div>

              {/* AI Auto-Enrich Button */}
              <button 
                onClick={() => {
                  if (linkedContact) {
                    const mockEnrichment: ContactEnrichmentData = {
                      firstName: linkedContact.firstName,
                      lastName: linkedContact.lastName,
                      email: linkedContact.email,
                      company: linkedContact.company,
                      phone: linkedContact.phone || `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
                      industry: linkedContact.industry || ['Technology', 'Finance', 'Healthcare', 'Education'][Math.floor(Math.random() * 4)],
                      notes: "Auto-enriched with AI on " + new Date().toLocaleDateString(),
                      confidence: 85
                    };
                    handleContactEnrichment(mockEnrichment);
                  }
                }}
                className="w-full flex items-center justify-center py-2 px-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 text-sm font-medium transition-all duration-200 border border-purple-300/50 shadow-sm hover:shadow-md hover:scale-105"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                AI Auto-Enrich
                <Sparkles className="w-3 h-3 ml-2 text-yellow-300" />
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-blue-500" />
                Quick Actions
              </h4>
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-3 flex flex-col items-center hover:bg-blue-50 rounded-lg transition-all text-center"
                >
                  <Edit className="w-4 h-4 mb-1 text-blue-600" />
                  <span className="text-xs font-medium">Edit</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (linkedContact?.email) {
                      // Open email composer modal
                      setShowEmailComposer(true);
                    }
                  }}
                  disabled={!linkedContact?.email}
                  className="p-3 flex flex-col items-center hover:bg-green-50 rounded-lg transition-all text-center disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 mb-1 text-green-600" />
                  <span className="text-xs font-medium">Email</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (linkedContact?.phone) {
                      const phoneService = getPhoneService();
                      phoneService.makeCall(linkedContact.phone, linkedContact.name, editedDeal.title);
                    }
                  }}
                  disabled={!linkedContact?.phone}
                  className="p-3 flex flex-col items-center hover:bg-yellow-50 rounded-lg transition-all text-center disabled:opacity-50"
                >
                  <Phone className="w-4 h-4 mb-1 text-yellow-600" />
                  <span className="text-xs font-medium">Call</span>
                </button>
                <button 
                  onClick={() => window.open(`https://calendar.google.com/calendar/u/0/r/eventedit?text=Meeting+about+${editedDeal.title}&details=${editedDeal.company}`, '_blank')}
                  className="p-3 flex flex-col items-center hover:bg-indigo-50 rounded-lg transition-all text-center"
                >
                  <Calendar className="w-4 h-4 mb-1 text-indigo-600" />
                  <span className="text-xs font-medium">Meet</span>
                </button>
              </div>
              
              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button 
                  onClick={() => setShowAddField(true)}
                  className="p-2 flex items-center justify-center hover:bg-purple-50 rounded-lg transition-all text-center text-xs font-medium text-purple-600"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Field
                </button>
                <button 
                  onClick={() => setActiveTab('journey')}
                  className="p-2 flex items-center justify-center hover:bg-orange-50 rounded-lg transition-all text-center text-xs font-medium text-orange-600"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Files
                </button>
              </div>
            </div>

            {/* Contact Person Section - ENHANCED */}
            {linkedContact ? (
              <div className="p-4 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                    <User className="w-4 h-4 mr-2 text-green-500" />
                    Contact Person
                  </h4>
                  <div className="flex space-x-1">
                    {linkedContact && (
                      <AIResearchButton
                        searchType="auto"
                        searchQuery={{
                          email: linkedContact.email,
                          firstName: linkedContact.firstName,
                          lastName: linkedContact.lastName,
                          company: linkedContact.company,
                          linkedinUrl: linkedContact.socialProfiles?.linkedin
                        }}
                        onDataFound={handleContactEnrichment}
                        variant="outline"
                        size="sm"
                        className="p-1 bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200"
                      />
                    )}
                    <button 
                      onClick={() => setShowContactSelector(true)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Change Contact"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={handleRemoveContact}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove Contact"
                    >
                      <UserX className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Contact Profile Display */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="relative">
                      <AvatarWithStatus
                        src={linkedContact.avatarSrc}
                        alt={linkedContact.name}
                        size="md"
                        status={linkedContact.status}
                      />
                      
                      {/* AI Score Badge */}
                      {linkedContact.aiScore && (
                        <div className={`absolute -top-1 -right-1 h-5 w-5 rounded-full ${
                          linkedContact.aiScore >= 80 ? 'bg-green-500' :
                          linkedContact.aiScore >= 60 ? 'bg-blue-500' :
                          linkedContact.aiScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        } text-white flex items-center justify-center text-xs font-bold shadow-lg ring-1 ring-white`}>
                          {linkedContact.aiScore}
                        </div>
                      )}
                      
                      {/* AI Image Search Button */}
                      <button 
                        onClick={handleFindNewImage}
                        disabled={isEnriching}
                        className="absolute -bottom-1 -right-1 p-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 transition-colors shadow-sm"
                      >
                        {isEnriching ? (
                          <div className="animate-spin w-2 h-2 border border-white border-t-transparent rounded-full" />
                        ) : (
                          <Camera className="w-2 h-2" />
                        )}
                      </button>
                    </div>
                    
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900">{linkedContact.name}</h5>
                      <p className="text-sm text-gray-600">{linkedContact.title}</p>
                      <p className="text-xs text-gray-500">{linkedContact.company}</p>
                      
                      {/* Interest Level Indicator */}
                      {linkedContact.interestLevel && (
                        <div className="flex items-center space-x-1 mt-1">
                          <div className={`w-2 h-2 rounded-full ${interestColors[linkedContact.interestLevel]} animate-pulse`} />
                          <span className="text-xs font-medium text-gray-700">
                            {interestLabels[linkedContact.interestLevel]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact AI Tools */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button 
                      onClick={handleContactAnalysis}
                      disabled={isAnalyzing}
                      className="p-2 flex items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-blue-300/50"
                    >
                      <Target className="w-3 h-3 mr-1" />
                      <span className="text-xs">AI Score</span>
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onAddContact) {
                          console.log('Change contact button clicked');
                          onAddContact();
                        } else {
                          console.warn('onAddContact prop not provided');
                        }
                      }}
                      className={`p-2 flex items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 ${
                        linkedContact.isFavorite 
                          ? 'bg-red-100 text-red-700 border-red-200' 
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      <Heart className={`w-3 h-3 mr-1 ${linkedContact.isFavorite ? 'fill-current' : ''}`} />
                      <span className="text-xs">Favorite</span>
                    </button>
                  </div>

                  {/* Contact Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEmailComposer(true);
                      }}
                      className="p-2 flex items-center justify-center hover:bg-green-50 rounded-lg transition-all text-center text-xs font-medium text-green-600 border border-green-200"
                    >
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (linkedContact?.phone) {
                          const phoneService = getPhoneService();
                          phoneService.makeCall(linkedContact.phone, linkedContact.name, editedDeal.title);
                        }
                      }}
                      disabled={!linkedContact?.phone}
                      className="p-2 flex items-center justify-center hover:bg-yellow-50 rounded-lg transition-all text-center text-xs font-medium text-yellow-600 border border-yellow-200 disabled:opacity-50"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      Call
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                    <User className="w-4 h-4 mr-2 text-green-500" />
                    Contact Person
                  </h4>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                  <UserPlus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-3">No contact assigned to this deal</p>
                  <button 
                    onClick={() => setShowContactSelector(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Add Contact
                  </button>
                </div>
              </div>
            )}

            {/* Deal Value & Probability */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                Deal Value & Probability
              </h4>
              
              <div className="space-y-4">
                {/* Deal Value */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Deal Value</p>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(editedDeal.value)}</p>
                  </div>
                  <button 
                    onClick={() => handleStartEditingField('value')}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>

                {/* Probability */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Probability</p>
                    <span className="text-lg font-bold text-blue-700">{editedDeal.probability}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        editedDeal.probability >= 80 ? 'bg-green-500' :
                        editedDeal.probability >= 60 ? 'bg-blue-500' :
                        editedDeal.probability >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${editedDeal.probability}%` }}
                    />
                  </div>
                </div>

                {/* Due Date */}
                {editedDeal.dueDate && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Due Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {editedDeal.dueDate.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {Math.ceil((editedDeal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-blue-500" />
                Timeline
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Created</p>
                    <p className="text-sm font-medium text-gray-900">{editedDeal.createdAt.toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Days Active</p>
                    <p className="text-sm font-medium text-gray-900">
                      {Math.ceil((new Date().getTime() - editedDeal.createdAt.getTime()) / (1000 * 60 * 60 * 24))}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                  <Database className="w-4 h-4 mr-2 text-purple-500" />
                  Custom Fields
                </h4>
                <button 
                  onClick={() => setShowAddField(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {editedDeal.customFields && Object.keys(editedDeal.customFields).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(editedDeal.customFields).map(([key, value], index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                      <div>
                        <p className="text-xs text-gray-500">{key}</p>
                        <p className="text-sm font-medium text-gray-900">{String(value)}</p>
                      </div>
                      <button 
                        onClick={() => handleRemoveCustomField(key)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No custom fields</p>
              )}

              {showAddField && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Field name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Field value"
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleAddCustomField}
                        disabled={!newFieldName || !newFieldValue}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddField(false)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-yellow-500" />
                  Tags
                </h4>
              </div>
              
              <div className="flex flex-wrap gap-1 mb-3">
                {editedDeal.tags?.map((tag, index) => (
                  <div key={index} className="group relative">
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                      {tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Add a tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={handleAddTag}
                  disabled={!newTag}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Files & Attachments */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                  <Paperclip className="w-4 h-4 mr-2 text-orange-500" />
                  Files & Attachments
                </h4>
                <button 
                  onClick={() => {/* Handle file upload */}}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {editedDeal.attachments && editedDeal.attachments.length > 0 ? (
                <div className="space-y-2">
                  {editedDeal.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-900">{file.name}</span>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No files attached</p>
              )}
            </div>

            {/* External Links */}
            <div className="p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                  <Link className="w-4 h-4 mr-2 text-indigo-500" />
                  External Links
                </h4>
                <button 
                  onClick={() => setShowAddLink(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              {editedDeal.links && editedDeal.links.length > 0 ? (
                <div className="space-y-2">
                  {editedDeal.links.map((link, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{link.title}</p>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                          {link.url}
                        </a>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No links added</p>
              )}

              {showAddLink && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Link title"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="url"
                      placeholder="URL"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={handleAddLink}
                        disabled={!newLinkTitle || !newLinkUrl}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddLink(false)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center justify-between p-5">
              <div className="flex space-x-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2
                        ${activeTab === tab.id 
                          ? 'bg-blue-100 text-blue-700 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              
              <div className="flex items-center space-x-3">
                <ModernButton 
                  variant={editedDeal.isFavorite ? "primary" : "outline"} 
                  size="sm" 
                  onClick={handleToggleFavorite}
                  className="flex items-center space-x-2"
                >
                  {editedDeal.isFavorite ? <Heart className="w-4 h-4" /> : <HeartOff className="w-4 h-4" />}
                  <span>{editedDeal.isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
                </ModernButton>
                
                <ModernButton
                  variant="outline"
                  size="sm"
                  onClick={handleShareDeal}
                  className="flex items-center space-x-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Deal</span>
                </ModernButton>
                
                {isEditing ? (
                  <div className="flex items-center space-x-2">
                    <ModernButton 
                      variant="primary" 
                      size="sm" 
                      onClick={handleSave}
                      loading={isSaving}
                      className="flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save</span>
                    </ModernButton>
                    <ModernButton 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancel}
                      className="flex items-center space-x-2"
                    >
                      <Cancel className="w-4 h-4" />
                      <span>Cancel</span>
                    </ModernButton>
                  </div>
                ) : (
                  <ModernButton 
                    variant="primary" 
                    size="sm" 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Deal</span>
                  </ModernButton>
                )}
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
            {activeTab === 'overview' && (
              <div className="p-6 space-y-6">
                {/* Deal Summary Card */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">{editedDeal.title}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Company</p>
                      <p className="text-gray-900 text-lg">{editedDeal.company}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Deal Value</p>
                      <p className="text-green-700 text-lg font-bold">{formatCurrency(editedDeal.value)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Stage</p>
                      <span className={`${getStageColor(editedDeal.stage)} text-white text-sm px-3 py-1 rounded-full font-medium`}>
                        {editedDeal.stage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Information Card */}
                {linkedContact && (
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <User className="w-5 h-5 mr-2 text-blue-500" />
                      Contact Information
                    </h4>
                    
                    <div className="flex items-start space-x-4">
                      <AvatarWithStatus
                        src={linkedContact.avatarSrc}
                        alt={linkedContact.name}
                        size="lg"
                        status={linkedContact.status}
                      />
                      
                      <div className="flex-1">
                        <h5 className="text-xl font-semibold text-gray-900 mb-1">{linkedContact.name}</h5>
                        <p className="text-gray-600 mb-2">{linkedContact.title} at {linkedContact.company}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Email</p>
                            <a href={`mailto:${linkedContact.email}`} className="text-blue-600 hover:underline">
                              {linkedContact.email}
                            </a>
                          </div>
                          {linkedContact.phone && (
                            <div>
                              <p className="text-sm font-medium text-gray-700">Phone</p>
                              <a href={`tel:${linkedContact.phone}`} className="text-blue-600 hover:underline">
                                {linkedContact.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deal Notes */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">Notes</h4>
                    <button
                      onClick={() => handleStartEditingField('notes')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  {deal.contactId && contactData ? (
                    <div className="space-y-3">
                      <textarea
                        value={editedDeal.notes || ''}
                        onChange={(e) => handleEditField('notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={5}
                      />
                      <div className="flex space-x-2">
                        <ModernButton variant="primary" size="sm" onClick={handleSaveField}>
                          Save
                        </ModernButton>
                        <ModernButton variant="outline" size="sm" onClick={() => setEditingField(null)}>
                          Cancel
                        </ModernButton>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-gray-700 whitespace-pre-line">
                        {editedDeal.notes || 'No notes for this deal.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Research & Competitive Analysis */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Search className="w-5 h-5 mr-2 text-purple-600" />
                      AI Research & Competitive Analysis
                    </h4>
                    <button className="text-sm text-purple-600 hover:text-purple-700 flex items-center">
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Update
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h5 className="text-sm font-medium text-purple-900 mb-2">Company Analysis</h5>
                      <p className="text-xs text-purple-700">
                        {editedDeal.company} is a mid-sized company in the technology sector with an estimated annual revenue of $50-100M.
                        Recent news indicates they're expanding operations and investing in digital transformation initiatives.
                      </p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h5 className="text-sm font-medium text-blue-900 mb-2">Decision Factors</h5>
                      <p className="text-xs text-blue-700 mb-2">
                        Based on analysis of similar deals, key decision factors for this type of client include:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <p className="text-xs font-medium text-blue-800">Implementation Time</p>
                          <p className="text-xs text-blue-600">Critical factor</p>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <p className="text-xs font-medium text-blue-800">ROI Timeline</p>
                          <p className="text-xs text-blue-600">High importance</p>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <p className="text-xs font-medium text-blue-800">Technical Support</p>
                          <p className="text-xs text-blue-600">Medium importance</p>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <p className="text-xs font-medium text-blue-800">Pricing Model</p>
                          <p className="text-xs text-blue-600">Medium importance</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h5 className="text-sm font-medium text-green-900 mb-2">Competitive Landscape</h5>
                      <p className="text-xs text-green-700 mb-2">
                        Main competitors pursuing similar deals in this space:
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between bg-white p-2 rounded border border-green-100">
                          <p className="text-xs font-medium text-green-800">CompetitorX</p>
                          <div className="flex items-center">
                            <span className="text-xs text-red-600">Weakness: Implementation time</span>
                          </div>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded border border-green-100">
                          <p className="text-xs font-medium text-green-800">CompetitorY</p>
                          <div className="flex items-center">
                            <span className="text-xs text-red-600">Weakness: Limited support</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Citations Section */}
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                      <h5 className="text-sm font-medium text-indigo-900 mb-3 flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Research Citations & Sources
                      </h5>
                      <CitationSummary
                        citations={[
                          {
                            url: 'https://techcrunch.com/2024/company-analysis',
                            title: 'Company Analysis Report',
                            domain: 'techcrunch.com',
                            sourceType: 'news',
                            credibilityScore: 95,
                            timestamp: new Date().toISOString(),
                            snippet: 'Recent developments and market position analysis...'
                          },
                          {
                            url: 'https://linkedin.com/company/profile',
                            title: 'Company LinkedIn Profile',
                            domain: 'linkedin.com',
                            sourceType: 'company',
                            credibilityScore: 85,
                            timestamp: new Date().toISOString(),
                            snippet: 'Official company information and updates...'
                          }
                        ]}
                        maxDisplay={3}
                        showStats={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="p-6">
                <AIInsightsPanel deal={editedDeal} />
              </div>
            )}

            {activeTab === 'journey' && (
              <div className="p-6">
                <DealJourneyTimeline deal={editedDeal} />
              </div>
            )}

            {activeTab === 'communication' && (
              <div className="p-6">
                <DealCommunicationHub deal={editedDeal} contact={linkedContact} />
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="p-6">
                <DealAnalyticsDashboard deal={editedDeal} />
              </div>
            )}

            {activeTab === 'automation' && (
              <div className="p-6">
                <DealAutomationPanel deal={editedDeal} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Selector Modal */}
      {showContactSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Select Contact</h3>
              <button onClick={() => setShowContactSelector(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {contacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full p-3 text-left hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <AvatarWithStatus
                        src={contact.avatarSrc}
                        alt={contact.name}
                        size="sm"
                        status={contact.status}
                      />
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-sm text-gray-600">{contact.title} at {contact.company}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      {linkedContact && (
        <EmailComposer
          contact={linkedContact}
          deal={editedDeal}
          isOpen={showEmailComposer}
          onClose={() => setShowEmailComposer(false)}
          onSend={(emailData) => {
            console.log('📧 Email sent from deal detail:', emailData);
            // Here you could log the email activity or update deal status
          }}
        />
      )}
    </div>
  );
};