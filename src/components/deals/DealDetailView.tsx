import React, { useState, useEffect } from 'react';
import { AvatarWithStatus } from '../ui/AvatarWithStatus';
import { ModernButton } from '../ui/ModernButton';
import { CustomizableAIToolbar } from '../ui/CustomizableAIToolbar';
import { AIResearchButton } from '../ui/AIResearchButton';
import { aiEnrichmentService, ContactEnrichmentData } from '../../services/aiEnrichmentService';
import { ContactJourneyTimeline } from '../contacts/ContactJourneyTimeline';
import { AIInsightsPanel } from '../contacts/AIInsightsPanel';
import { CommunicationHub } from '../contacts/CommunicationHub';
import { AutomationPanel } from '../contacts/AutomationPanel';
import { ContactAnalytics } from '../contacts/ContactAnalytics';
import { ContactEmailPanel } from '../contacts/ContactEmailPanel';
import { Contact } from '../../types/contact';
import { openEmailClient } from '../../utils/validation';
import { 
  X, Edit, Mail, Phone, Plus, MessageSquare, FileText, Calendar, MoreHorizontal, 
  User, Globe, Clock, Building, Tag, Star, ExternalLink, Brain, TrendingUp, 
  BarChart3, Zap, Users, Activity, Settings, Database, Shield, Target, 
  Smartphone, Video, Linkedin, Twitter, Facebook, Instagram, Save, 
  Ambulance as Cancel, Heart, HeartOff, MapPin, Briefcase, Award, 
  CheckCircle, AlertCircle, Wifi, WifiOff, Search, DollarSign, RefreshCw,
  Sparkles, Camera, Wand2
} from 'lucide-react';

interface ContactDetailViewProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<Contact>) => Promise<Contact>;
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
  'Cold Call': 'bg-gray-600'
};

const socialPlatforms = [
  { icon: MessageSquare, color: 'bg-green-500', name: 'WhatsApp', key: 'whatsapp' },
  { icon: Linkedin, color: 'bg-blue-500', name: 'LinkedIn', key: 'linkedin' },
  { icon: Mail, color: 'bg-blue-600', name: 'Email', key: 'email' },
  { icon: Twitter, color: 'bg-blue-400', name: 'Twitter', key: 'twitter' },
  { icon: Facebook, color: 'bg-blue-700', name: 'Facebook', key: 'facebook' },
  { icon: Instagram, color: 'bg-pink-500', name: 'Instagram', key: 'instagram' },
];

export const ContactDetailView: React.FC<ContactDetailViewProps> = ({
  contact, 
  isOpen, 
  onClose, 
  onUpdate 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContact, setEditedContact] = useState<Contact>(contact);
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

  useEffect(() => {
    setEditedContact(contact);
  }, [contact]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'journey', label: 'Journey', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'communication', label: 'Communication', icon: MessageSquare },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'ai-insights', label: 'AI Insights', icon: Brain },
    { id: 'email', label: 'Email Tools', icon: Mail },
  ];

  const handleSave = async () => {
    if (onUpdate) {
      setIsSaving(true);
      try {
        const updated = await onUpdate(contact.id, editedContact);
        setEditedContact(updated);
        setIsEditing(false);
        setEditingField(null);
      } catch (error) {
        console.error('Failed to update contact:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleCancel = () => {
    setEditedContact(contact);
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
    const updatedContact = { ...editedContact, isFavorite: !editedContact.isFavorite };
    setEditedContact(updatedContact);
    
    if (onUpdate) {
      try {
        await onUpdate(contact.id, { isFavorite: updatedContact.isFavorite });
      } catch (error) {
        console.error('Failed to update favorite status:', error);
        // Revert on error
        setEditedContact(prev => ({ ...prev, isFavorite: !updatedContact.isFavorite }));
      }
    }
  };

  const handleEditField = (field: string, value: any) => {
    setEditedContact(prev => ({ ...prev, [field]: value }));
  };

  const handleStartEditingField = (field: string) => {
    setEditingField(field);
  };

  const handleSaveField = async () => {
    if (onUpdate && editingField) {
      try {
        let updates: Partial<Contact> = {};
        
        if (editingField.startsWith('social_')) {
          const platform = editingField.replace('social_', '');
          const socialProfiles = {
            ...(editedContact.socialProfiles || {}),
          };
          updates = { socialProfiles };
        } else if (editingField.startsWith('custom_')) {
          const fieldName = editingField.replace('custom_', '');
          const customFields = {
            ...(editedContact.customFields || {}),
          };
          updates = { customFields };
        } else {
          const fieldValue = editedContact[editingField as keyof Contact];
          updates = { [editingField]: fieldValue };
        }
        
        await onUpdate(contact.id, updates);
        setEditingField(null);
      } catch (error) {
        console.error('Failed to update field:', error);
      }
    }
  };

  const handleAddCustomField = () => {
    if (newFieldName && newFieldValue) {
      const customFields = {
        ...(editedContact.customFields || {}),
        [newFieldName]: newFieldValue
      };
      
      setEditedContact(prev => ({
        ...prev,
        customFields
      }));
      
      if (onUpdate) {
        onUpdate(contact.id, { customFields })
          .catch(error => console.error('Failed to add custom field:', error));
      }
      
      setNewFieldName('');
      setNewFieldValue('');
      setShowAddField(false);
    }
  };

  const handleRemoveCustomField = async (fieldName: string) => {
    const customFields = { ...(editedContact.customFields || {}) };
    if (!customFields) return;
    
    delete customFields[fieldName];
    
    setEditedContact(prev => ({
      ...prev,
      customFields
    }));
    
    if (onUpdate) {
      try {
        await onUpdate(contact.id, { customFields });
      } catch (error) {
        console.error('Failed to remove custom field:', error);
      }
    }
  };

  const handleAddSocialProfile = () => {
    if (selectedSocialPlatform && socialFieldValue) {
      const socialProfiles = {
        ...(editedContact.socialProfiles || {}),
        [selectedSocialPlatform]: socialFieldValue
      };
      
      setEditedContact(prev => ({
        ...prev,
        socialProfiles
      }));
      
      if (onUpdate) {
        onUpdate(contact.id, { socialProfiles })
          .catch(error => console.error('Failed to add social profile:', error));
      }
      
      setShowAddSocial(false);
      setSelectedSocialPlatform('');
      setSocialFieldValue('');
    }
  };

  const handleRemoveSocialProfile = async (platform: string) => {
    if (!editedContact.socialProfiles) return;
    
    const socialProfiles = { ...editedContact.socialProfiles };
    delete socialProfiles[platform];
    
    setEditedContact(prev => ({
      ...prev,
      socialProfiles
    }));
    
    if (onUpdate) {
      try {
        await onUpdate(contact.id, { socialProfiles });
      } catch (error) {
        console.error('Failed to remove social profile:', error);
      }
    }
  };

  const handleAddSourceToContact = () => {
    if (addSource && !editedContact.sources.includes(addSource)) {
      const sources = [...editedContact.sources, addSource];
      
      setEditedContact(prev => ({
        ...prev,
        sources
      }));
      
      if (onUpdate) {
        onUpdate(contact.id, { sources })
          .catch(error => console.error('Failed to add source:', error));
      }
      
      setShowAddSource(false);
      setAddSource('');
    }
  };

  const handleRemoveSource = async (source: string) => {
    const sources = editedContact.sources.filter(s => s !== source);
    
    setEditedContact(prev => ({
      ...prev,
      sources
    }));
    
    if (onUpdate) {
      try {
        await onUpdate(contact.id, { sources });
      } catch (error) {
        console.error('Failed to remove source:', error);
      }
    }
  };

  const handleChangeInterestLevel = async (level: 'hot' | 'medium' | 'low' | 'cold') => {
    setEditedContact(prev => ({
      ...prev,
      interestLevel: level
    }));
    
    if (onUpdate) {
      try {
        await onUpdate(contact.id, { interestLevel: level });
        setEditInterestLevel(false);
      } catch (error) {
        console.error('Failed to update interest level:', error);
        setEditedContact(prev => ({ ...prev, interestLevel: contact.interestLevel }));
      }
    }
  };

  const handleAnalyzeContact = async () => {
    setIsAnalyzing(true);
    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newScore = Math.floor(Math.random() * 40) + 60; // Random score between 60-100
      const updatedContact = { ...editedContact, aiScore: newScore };
      setEditedContact(updatedContact);
      
      if (onUpdate) {
        await onUpdate(contact.id, { aiScore: newScore });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAIEnrichment = async (enrichmentData: ContactEnrichmentData) => {
    setLastEnrichment(enrichmentData);
    setIsEnriching(true);
    
    try {
      // Apply enrichment data to contact
      const updates: any = {};
      
      if (enrichmentData.phone && !editedContact.phone) {
        updates.phone = enrichmentData.phone;
      }
      if (enrichmentData.industry && !editedContact.industry) {
        updates.industry = enrichmentData.industry;
      }
      if (enrichmentData.avatar && enrichmentData.avatar !== editedContact.avatarSrc) {
        updates.avatarSrc = enrichmentData.avatar;
      }
      if (enrichmentData.notes) {
        updates.notes = editedContact.notes ? 
          `${editedContact.notes}\n\nAI Research: ${enrichmentData.notes}` : 
          enrichmentData.notes;
      }
      
      // Social profiles
      if (enrichmentData.socialProfiles) {
        const socialUpdates: any = {};
        Object.entries(enrichmentData.socialProfiles).forEach(([key, value]) => {
          if (value && !editedContact.socialProfiles?.[key as keyof typeof editedContact.socialProfiles]) {
            socialUpdates[key] = value;
          }
        });
        if (Object.keys(socialUpdates).length > 0) {
          updates.socialProfiles = { ...editedContact.socialProfiles, ...socialUpdates };
        }
      }
      
      // Update AI score if provided
      if (enrichmentData.confidence) {
        updates.aiScore = Math.round(enrichmentData.confidence);
      }
      
      const updatedContact = { ...editedContact, ...updates };
      setEditedContact(updatedContact);
      
      if (onUpdate && Object.keys(updates).length > 0) {
        await onUpdate(contact.id, updates);
      }
      
    } catch (error) {
      console.error('Failed to apply enrichment:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleFindNewImage = async () => {
    try {
      setIsEnriching(true);
      const newImageUrl = await aiEnrichmentService.findContactImage(
        editedContact.name,
        editedContact.company
      );
      
      const updatedContact = { ...editedContact, avatarSrc: newImageUrl };
      setEditedContact(updatedContact);
      
      if (onUpdate) {
        await onUpdate(contact.id, { avatarSrc: newImageUrl });
      }
    } catch (error) {
      console.error('Failed to find new image:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSendEmail = () => {
    const result = openEmailClient(editedContact.email);

    if (!result.success) {
      console.error('Email error:', result.error);
      alert(result.error || 'Failed to open email client');
    }
  };

  const handleMakeCall = () => {
    if (!editedContact.phone) {
      alert('No phone number available for this contact');
      return;
    }

    try {
      window.location.href = `tel:${editedContact.phone}`;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to open phone dialer. Your device may not support this feature.');
    }
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
      {/* Enlarged Modal Container */}
      <div className="bg-white rounded-xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex animate-scale-in shadow-2xl">
        {/* Enhanced Customer Profile Sidebar */}
        <div className="w-80 bg-gradient-to-b from-gray-50 via-white to-gray-50 border-r border-gray-200 flex flex-col h-full">
          {/* Fixed Header with AI Features */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              Customer Profile
              <Sparkles className="w-4 h-4 ml-2 text-purple-500" />
            </h2>
            <div className="flex space-x-2">
              <AIResearchButton
                searchType="auto"
                searchQuery={{
                  email: editedContact.email,
                  firstName: editedContact.firstName,
                  lastName: editedContact.lastName,
                  company: editedContact.company,
                  linkedinUrl: editedContact.socialProfiles?.linkedin
                }}
                onDataFound={handleAIEnrichment}
                variant="outline"
                size="sm"
                className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200"
              />
              <button
                onClick={handleAnalyzeContact}
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
            {/* Avatar and Basic Info with AI Enhancement */}
            <div className="p-5 text-center border-b border-gray-100 bg-white">
              <div className="relative inline-block mb-4">
                <AvatarWithStatus
                  src={editedContact.avatarSrc}
                  alt={editedContact.name}
                  size="xl"
                  status={editedContact.status}
                />
                
                {/* AI Score Badge */}
                {editedContact.aiScore && (
                  <div className={`absolute -top-1 -right-1 h-7 w-7 rounded-full ${
                    editedContact.aiScore >= 80 ? 'bg-green-500' :
                    editedContact.aiScore >= 60 ? 'bg-blue-500' :
                    editedContact.aiScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  } text-white flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-white`}>
                    {editedContact.aiScore}
                  </div>
                )}
                
                {/* Favorite Badge */}
                {editedContact.isFavorite && (
                  <div className="absolute -top-1 -left-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white">
                    <Heart className="w-3 h-3" />
                  </div>
                )}
                
                {/* AI Enhancement Indicator */}
                {lastEnrichment && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white">
                    <Sparkles className="w-2.5 h-2.5" />
                  </div>
                )}
                
                {/* AI Image Search Button */}
                <button 
                  onClick={handleFindNewImage}
                  disabled={isEnriching}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 transition-colors shadow-lg relative"
                >
                  {isEnriching ? (
                    <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                </button>
              </div>
              
              {/* Name and Title */}
              <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{editedContact.name}</h3>
              <p className="text-gray-600 font-medium mb-1">{editedContact.title}</p>
              <p className="text-gray-500 text-sm">{editedContact.company}</p>
              {editedContact.industry && (
                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {editedContact.industry}
                </span>
              )}
              
              {/* AI Enhancement Badge */}
              {lastEnrichment && (
                <div className="mt-3 p-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <Sparkles className="w-3 h-3 text-purple-600" />
                    <span className="text-xs font-medium text-purple-900">
                      Enhanced with AI ({lastEnrichment.confidence}% confidence)
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
                  onClick={handleAnalyzeContact}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-blue-300/50"
                >
                  <BarChart3 className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Lead Score</span>
                </button>
                
                {/* Email AI */}
                <button 
                  onClick={handleSendEmail}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border-gray-200/50"
                >
                  <Mail className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Email AI</span>
                </button>
                
                {/* Enrich */}
                <button 
                  onClick={() => {
                    const searchQuery = {
                      email: editedContact.email,
                      firstName: editedContact.firstName,
                      lastName: editedContact.lastName,
                      company: editedContact.company
                    };
                    
                    handleAIEnrichment({
                      email: searchQuery.email,
                      firstName: searchQuery.firstName,
                      lastName: searchQuery.lastName,
                      company: searchQuery.company,
                      confidence: 75
                    });
                  }}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border-gray-200/50"
                >
                  <Search className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Enrich</span>
                </button>
                
                {/* Insights */}
                <button 
                  onClick={() => setActiveTab('ai-insights')}
                  className="p-3 flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 min-h-[3.5rem] bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200 border-gray-200/50"
                >
                  <TrendingUp className="w-4 h-4 mb-1" />
                  <span className="text-xs leading-tight text-center">Insights</span>
                </button>
              </div>

              {/* AI Auto-Enrich Button */}
              <button 
                onClick={() => {
                  if (lastEnrichment) {
                    handleAIEnrichment(lastEnrichment);
                  } else {
                    const mockEnrichment: ContactEnrichmentData = {
                      firstName: editedContact.firstName,
                      lastName: editedContact.lastName,
                      email: editedContact.email,
                      company: editedContact.company,
                      phone: editedContact.phone || `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
                      industry: editedContact.industry || ['Technology', 'Finance', 'Healthcare', 'Education'][Math.floor(Math.random() * 4)],
                      notes: "Auto-enriched with AI on " + new Date().toLocaleDateString(),
                      confidence: 85
                    };
                    handleAIEnrichment(mockEnrichment);
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
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-3 flex flex-col items-center hover:bg-blue-50 rounded-lg transition-all text-center"
                >
                  <Edit className="w-4 h-4 mb-1 text-blue-600" />
                  <span className="text-xs font-medium">Edit</span>
                </button>
                <button 
                  onClick={handleSendEmail}
                  className="p-3 flex flex-col items-center hover:bg-green-50 rounded-lg transition-all text-center"
                >
                  <Mail className="w-4 h-4 mb-1 text-green-600" />
                  <span className="text-xs font-medium">Email</span>
                </button>
                <button 
                  onClick={handleMakeCall}
                  className="p-3 flex flex-col items-center hover:bg-yellow-50 rounded-lg transition-all text-center"
                >
                  <Phone className="w-4 h-4 mb-1 text-yellow-600" />
                  <span className="text-xs font-medium">Call</span>
                </button>
                <button 
                  onClick={() => setShowAddField(true)}
                  className="p-3 flex flex-col items-center hover:bg-purple-50 rounded-lg transition-all text-center"
                >
                  <Plus className="w-4 h-4 mb-1 text-purple-600" />
                  <span className="text-xs font-medium">Add Field</span>
                </button>
                <button 
                  onClick={() => setActiveTab('journey')}
                  className="p-3 flex flex-col items-center hover:bg-orange-50 rounded-lg transition-all text-center"
                >
                  <FileText className="w-4 h-4 mb-1 text-orange-600" />
                  <span className="text-xs font-medium">Files</span>
                </button>
                <button 
                  onClick={() => window.open(`https://calendar.google.com/calendar/u/0/r/eventedit?text=Meeting+with+${editedContact.name}&details=${editedContact.company}`, '_blank')}
                  className="p-3 flex flex-col items-center hover:bg-indigo-50 rounded-lg transition-all text-center"
                >
                  <Calendar className="w-4 h-4 mb-1 text-indigo-600" />
                  <span className="text-xs font-medium">Meet</span>
                </button>
              </div>
            </div>

            {/* Contact Information */}
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                  <User className="w-4 h-4 mr-2 text-blue-500" />
                  Contact Info
                </h4>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Email */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3 h-3 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Email</p>
                      {editingField === 'email' ? (
                        <input
                          type="email"
                          value={editedContact.email}
                          onChange={(e) => handleEditField('email', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                          onBlur={handleSaveField}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">{editedContact.email}</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleStartEditingField('email')}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>

                {/* Phone */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Phone className="w-3 h-3 text-yellow-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Phone</p>
                      {editingField === 'phone' ? (
                        <input
                          type="tel"
                          value={editedContact.phone || ''}
                          onChange={(e) => handleEditField('phone', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                          onBlur={handleSaveField}
                          autoFocus
                          placeholder="+1-555-0123"
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{editedContact.phone || 'Not provided'}</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleStartEditingField('phone')}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>

                {/* Company */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building className="w-3 h-3 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Company</p>
                      {editingField === 'company' ? (
                        <input
                          type="text"
                          value={editedContact.company}
                          onChange={(e) => handleEditField('company', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                          onBlur={handleSaveField}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{editedContact.company}</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleStartEditingField('company')}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>

                {/* Social Media */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-6 h-6 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Globe className="w-3 h-3 text-pink-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Socials</p>
                      <div className="flex space-x-1 mt-1">
                        {socialPlatforms.slice(0, 4).map((social, index) => {
                          const Icon = social.icon;
                          const profileUrl = editedContact.socialProfiles?.[social.key];
                          return (
                            <div 
                              key={index} 
                              className={`${social.color} p-1 rounded-md text-white ${profileUrl ? '' : 'opacity-50'} hover:opacity-80 transition-opacity cursor-pointer`}
                              title={profileUrl ? `${social.name}: ${profileUrl}` : `Add ${social.name}`}
                              onClick={() => {
                                if (profileUrl) {
                                  window.open(profileUrl, '_blank');
                                } else {
                                  setShowAddSocial(true);
                                  setSelectedSocialPlatform(social.key);
                                }
                              }}
                            >
                              <Icon className="w-2.5 h-2.5" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAddSocial(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {showAddSocial && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">Platform</label>
                      <select
                        value={selectedSocialPlatform}
                        onChange={(e) => setSelectedSocialPlatform(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                      >
                        <option value="">Select platform...</option>
                        {socialPlatforms.map((platform) => (
                          <option key={platform.key} value={platform.key}>
                            {platform.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="block text-xs text-gray-500 mb-1">URL / Username</label>
                      <input
                        type="text"
                        value={socialFieldValue}
                        onChange={(e) => setSocialFieldValue(e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                        placeholder={selectedSocialPlatform === 'linkedin' ? 'https://linkedin.com/in/username' : ''}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleAddSocialProfile}
                        disabled={!selectedSocialPlatform || !socialFieldValue}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-medium disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddSocial(false);
                          setSelectedSocialPlatform('');
                          setSocialFieldValue('');
                        }}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Last Connected - Full Text Visible */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3 h-3 text-red-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Last Connected</p>
                      {editingField === 'lastConnected' ? (
                        <input
                          type="text"
                          value={editedContact.lastConnected || ''}
                          onChange={(e) => handleEditField('lastConnected', e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                          onBlur={handleSaveField}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-900 leading-tight">
                          {editedContact.lastConnected || '06/15/2023 at 7:16 pm'}
                        </p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleStartEditingField('lastConnected')}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interest Level & Sources */}
            <div className="p-4 bg-white">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Target className="w-4 h-4 mr-2 text-orange-500" />
                Lead Information
              </h4>
              
              {/* Interest Level */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Interest Level</p>
                  <button 
                    onClick={() => setEditInterestLevel(!editInterestLevel)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
                {editInterestLevel ? (
                  <div className="space-y-2 mb-2">
                    {(['hot', 'medium', 'low', 'cold'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => handleChangeInterestLevel(level)}
                        className={`flex items-center space-x-2 w-full text-left p-2 rounded-lg ${
                          editedContact.interestLevel === level 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${interestColors[level]}`} />
                        <span className="text-sm font-medium">{interestLabels[level]}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${interestColors[editedContact.interestLevel]} animate-pulse`} />
                      <span className="text-sm font-medium text-gray-900">{interestLabels[editedContact.interestLevel]}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: 5 }, (_, i) => {
                        const isActive = 
                          (editedContact.interestLevel === 'hot' && i < 5) ||
                          (editedContact.interestLevel === 'medium' && i < 3) ||
                          (editedContact.interestLevel === 'low' && i < 2) ||
                          (editedContact.interestLevel === 'cold' && i < 1);
                        
                        return (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              isActive 
                                ? `${interestColors[editedContact.interestLevel]} shadow-sm` 
                                : 'bg-gray-300'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Sources */}
              <div className="pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Sources</p>
                  <button 
                    onClick={() => setShowAddSource(true)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {editedContact.sources.map((source, index) => (
                    <div key={index} className="group relative">
                      <span
                        className={`
                          ${sourceColors[source] || 'bg-gray-600'} 
                          text-white text-xs px-2 py-1 rounded-md font-medium hover:opacity-90 transition-opacity cursor-pointer
                        `}
                      >
                        {source}
                      </span>
                      <button 
                        onClick={() => handleRemoveSource(source)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center"
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                </div>

                {showAddSource && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="mb-2">
                      <input
                        type="text"
                        value={addSource}
                        onChange={(e) => setAddSource(e.target.value)}
                        placeholder="Add source..."
                        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleAddSourceToContact}
                        disabled={!addSource}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-medium disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddSource(false)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                    {/* Quick Source Suggestions */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {['LinkedIn', 'Website', 'Email', 'Cold Call', 'Referral'].map(source => (
                        <button
                          key={source}
                          onClick={() => {
                            setAddSource(source);
                          }}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-xs"
                        >
                          {source}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                        flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
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
                  variant={editedContact.isFavorite ? "primary" : "outline"} 
                  size="sm" 
                  onClick={handleToggleFavorite}
                  className="flex items-center space-x-2"
                >
                  {editedContact.isFavorite ? <Heart className="w-4 h-4" /> : <HeartOff className="w-4 h-4" />}
                  <span>{editedContact.isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
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
                    <span>Edit Contact</span>
                  </ModernButton>
                )}
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 min-h-0">
            {activeTab === 'overview' && (
              <div className="p-6 space-y-6">
                {/* AI Enhancement Notice */}
                {lastEnrichment && (
                  <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-green-50 border border-purple-200 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-900">Contact Enhanced with AI Research</h4>
                        <p className="text-purple-700 text-sm">
                          This contact was enriched with additional information from OpenAI & Gemini research
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal Information */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                      <User className="w-5 h-5 mr-2 text-blue-500" />
                      Personal Information
                    </h4>
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { label: 'First Name', value: editedContact.firstName || editedContact.name.split(' ')[0], icon: User, field: 'firstName' },
                      { label: 'Last Name', value: editedContact.lastName || editedContact.name.split(' ').slice(1).join(' '), icon: User, field: 'lastName' },
                      { label: 'Email', value: editedContact.email, icon: Mail, field: 'email' },
                      { label: 'Phone', value: editedContact.phone || 'Not provided', icon: Phone, field: 'phone' },
                      { label: 'Title', value: editedContact.title, icon: Building, field: 'title' },
                      { label: 'Company', value: editedContact.company, icon: Building, field: 'company' },
                      { label: 'Industry', value: editedContact.industry || 'Not specified', icon: Tag, field: 'industry' },
                      { label: 'Status', value: editedContact.status, icon: Activity, field: 'status' }
                    ].map((field, index) => {
                      const Icon = field.icon;
                      return (
                        <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                              <Icon className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">{field.label}</p>
                              {isEditing || editingField === field.field ? (
                                <input
                                  type="text"
                                  value={editedContact[field.field as keyof Contact] as string || ''}
                                  onChange={(e) => handleEditField(field.field, e.target.value)}
                                  onBlur={() => editingField === field.field && handleSaveField()}
                                  className="text-gray-900 bg-white border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus={editingField === field.field}
                                />
                              ) : (
                                <p className="text-gray-900">{field.value}</p>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleStartEditingField(field.field)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Social Profiles */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Globe className="w-5 h-5 mr-2 text-green-500" />
                      Social Profiles
                    </h4>
                    <button 
                      onClick={() => setShowAddSocial(true)} 
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {socialPlatforms.map((platform, index) => {
                      const Icon = platform.icon;
                      const profileUrl = editedContact.socialProfiles?.[platform.key];
                      
                      return (
                        <div key={index} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className={`${platform.color} p-2 rounded-lg`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{platform.name}</p>
                            {editingField === `social_${platform.key}` ? (
                              <input
                                type="text"
                                value={editedContact.socialProfiles?.[platform.key] || ''}
                                onChange={(e) => {
                                  const socialProfiles = {
                                    ...(editedContact.socialProfiles || {}),
                                    [platform.key]: e.target.value
                                  };
                                  handleEditField('socialProfiles', socialProfiles);
                                }}
                                onBlur={handleSaveField}
                                className="w-full text-xs border border-gray-300 rounded-md px-2 py-1"
                                autoFocus
                              />
                            ) : profileUrl ? (
                              <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                                View Profile
                              </a>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowAddSocial(true);
                                  setSelectedSocialPlatform(platform.key);
                                }}
                                className="text-xs text-gray-500 hover:text-blue-600"
                              >
                                Add {platform.name}
                              </button>
                            )}
                          </div>
                          {profileUrl && (
                            <button
                              onClick={() => handleStartEditingField(`social_${platform.key}`)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Database className="w-5 h-5 mr-2 text-purple-500" />
                      Custom Fields
                    </h4>
                    <button 
                      onClick={() => setShowAddField(true)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {editedContact.customFields && Object.keys(editedContact.customFields).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(editedContact.customFields).map(([key, value], index) => (
                        <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{key}</p>
                            {editingField === `custom_${key}` ? (
                              <input
                                type="text"
                                value={String(editedContact.customFields?.[key] || '')}
                                onChange={(e) => {
                                  const customFields = {
                                    ...(editedContact.customFields || {}),
                                    [key]: e.target.value
                                  };
                                  handleEditField('customFields', customFields);
                                }}
                                onBlur={handleSaveField}
                                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1"
                                autoFocus
                              />
                            ) : (
                              <p className="text-gray-900">{String(value)}</p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleStartEditingField(`custom_${key}`)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleRemoveCustomField(key)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No custom fields added</p>
                  )}
                  
                  {showAddField && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Field name"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Field value"
                          value={newFieldValue}
                          onChange={(e) => setNewFieldValue(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex space-x-3">
                          <ModernButton 
                            variant="primary" 
                            size="sm" 
                            onClick={handleAddCustomField}
                            disabled={!newFieldName || !newFieldValue}
                          >
                            Add Field
                          </ModernButton>
                          <ModernButton 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowAddField(false)}
                          >
                            Cancel
                          </ModernButton>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'journey' && (
              <div className="p-6">
                <ContactJourneyTimeline contact={editedContact} />
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="p-6">
                <ContactAnalytics contact={editedContact} />
              </div>
            )}

            {activeTab === 'communication' && (
              <div className="p-6">
                <CommunicationHub contact={editedContact} />
              </div>
            )}

            {activeTab === 'automation' && (
              <div className="p-6">
                <AutomationPanel contact={editedContact} />
              </div>
            )}

            {activeTab === 'ai-insights' && (
              <div className="p-6">
                <AIInsightsPanel contact={editedContact} />
              </div>
            )}

            {activeTab === 'email' && (
              <div className="p-6">
                <ContactEmailPanel contact={editedContact} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};