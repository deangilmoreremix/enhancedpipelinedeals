import React, { useState } from 'react';
import { AvatarWithStatus } from '../ui/AvatarWithStatus';
import { CustomizableAIToolbar } from '../ui/CustomizableAIToolbar';
import { Contact } from '../../types/contact';
import { EmailComposer } from '../communication/EmailComposer';
import { getEmailService } from '../../services/emailService';
import { getPhoneService } from '../../services/phoneService';
import { 
  Edit, 
  MoreHorizontal, 
  Mail, 
  Phone, 
  User, 
  BarChart, 
  ThumbsUp, 
  ThumbsDown,
  ExternalLink,
  Star,
  UserPlus,
  Crown,
  Target,
  Zap,
  Brain,
  Loader2,
  Sparkles,
  Heart,
  Camera,
  Wand2,
  Database,
  Globe,
  Plus,
  Search,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  ArrowRight,
  Activity,
  Calendar,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Eye
} from 'lucide-react';

interface AIEnhancedContactCardProps {
  contact: Contact;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onAddToTeam?: () => void;
  showTeamAction?: boolean;
  onAnalyze?: (contact: Contact) => Promise<boolean>;
  isAnalyzing?: boolean;
  onToggleFavorite?: (contact: Contact) => Promise<void>;
  onFindNewImage?: (contact: Contact) => Promise<void>;
  onEdit?: (contact: Contact) => void;
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
  'YouTube': 'bg-red-600',
  'TikTok': 'bg-gray-900',
  'Webinar': 'bg-indigo-500',
  'Conference': 'bg-yellow-600'
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
};

// Social platform definitions
const socialPlatforms = [
  { icon: Linkedin, color: 'bg-blue-500', name: 'LinkedIn', key: 'linkedin' },
  { icon: Globe, color: 'bg-purple-600', name: 'Website', key: 'website' },
  { icon: Twitter, color: 'bg-blue-400', name: 'Twitter', key: 'twitter' },
  { icon: Facebook, color: 'bg-blue-700', name: 'Facebook', key: 'facebook' },
  { icon: Instagram, color: 'bg-pink-500', name: 'Instagram', key: 'instagram' },
  { icon: MessageSquare, color: 'bg-green-500', name: 'WhatsApp', key: 'whatsapp' },
];

export const AIEnhancedContactCard: React.FC<AIEnhancedContactCardProps> = ({
  contact,
  isSelected,
  onSelect,
  onClick,
  onAddToTeam,
  showTeamAction = false,
  onAnalyze,
  isAnalyzing = false,
  onToggleFavorite,
  onFindNewImage,
  onEdit
}) => {
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [localAnalyzing, setLocalAnalyzing] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [localEnriching, setLocalEnriching] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showPsychProfile, setShowPsychProfile] = useState(false);
  
  // Track last enrichment (mock data if not provided)
  const [lastEnrichment, setLastEnrichment] = useState<any>(
    contact.aiScore ? { confidence: contact.aiScore } : null
  );

  const handleCardClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('a')) {
      return;
    }

    // Trigger AI analysis when card is clicked (if no AI score exists)
    if (!contact.aiScore) {
      try {
        const { getAIFunctionOrchestrator } = await import('../../services/aiFunctionOrchestrator');
        const orchestrator = getAIFunctionOrchestrator();

        // Run contact analysis in background
        setTimeout(async () => {
          await orchestrator.executeFunction('analyze_contact_profile', {
            contactId: contact.id,
            includeWebResearch: false, // Quick analysis for card click
            depth: 'basic'
          }, {
            userId: 'current-user',
            componentId: 'contact-card-click',
            entityType: 'contact',
            entityId: contact.id,
            timestamp: Date.now()
          });
        }, 500); // Small delay to not block UI
      } catch (error) {
        console.error('Background AI analysis failed:', error);
      }
    }

    onClick();
  };

  const handleAnalyzeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAnalyze || isAnalyzing || localAnalyzing) return;
    
    setLocalAnalyzing(true);
    try {
      await onAnalyze(contact);
      setLastEnrichment({ 
        confidence: Math.max(contact.aiScore || 0, 75),
        aiProvider: 'Hybrid AI (GPT-4o + Gemini)',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLocalAnalyzing(false);
    }
  };
  
  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleFavorite) return;
    
    try {
      await onToggleFavorite(contact);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };
  
  const handleFindImageClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onFindNewImage || isFinding) return;
    
    setIsFinding(true);
    try {
      await onFindNewImage(contact);
    } catch (error) {
      console.error('Failed to find new image:', error);
    } finally {
      setIsFinding(false);
    }
  };

  const handleAIEnrichClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (localEnriching) return;

    setLocalEnriching(true);
    try {
      // In a real implementation, this would call an AI enrichment service
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastEnrichment({
        confidence: Math.min((contact.aiScore || 0) + 10, 95),
        aiProvider: 'OpenAI GPT-4o',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Enrichment failed:', error);
    } finally {
      setLocalEnriching(false);
    }
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEmailComposer(true);
  };

  const handleEmailSend = (emailData: any) => {
    console.log('📧 Email sent from contact card:', emailData);
    // Here you could log the email activity or update contact status
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(contact);
    }
  };

  const handleCallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const phoneService = getPhoneService();

    // Use contact's phone number or a default
    const phoneNumber = contact.phone || '+1-555-0123'; // Default for demo

    try {
      const success = await phoneService.makeCall(phoneNumber, contact.name, contact.company);
      if (success) {
        console.log('📞 Call initiated successfully');
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
    }
  };

  const handleFeedbackClick = async (e: React.MouseEvent, feedbackType: 'positive' | 'negative') => {
    e.stopPropagation();

    try {
      // Log feedback for AI improvement
      console.log(`📊 AI Feedback: ${feedbackType} feedback for contact ${contact.id}`);

      // Here you could send feedback to your AI service for model improvement
      const feedbackData = {
        entityType: 'contact',
        entityId: contact.id,
        feedbackType,
        timestamp: new Date(),
        aiProvider: lastEnrichment?.aiProvider || 'AI Assistant',
        insightType: 'contact_analysis'
      };

      console.log('💾 Storing AI feedback:', feedbackData);

      // Show brief visual feedback
      alert(`Thank you for your feedback! ${feedbackType === 'positive' ? '👍' : '👎'} This helps improve our AI insights.`);

    } catch (error) {
      console.error('Failed to submit AI feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    }
  };

  const analyzing = isAnalyzing || localAnalyzing;

  // Ensure tags is always a safe array
  const safeTags = Array.isArray(contact.tags) ? contact.tags : [];

  // Ensure sources is always a safe array
  const safeSources = Array.isArray(contact.sources) ? contact.sources : [];

  // Get social profiles 
  const socialProfiles = contact.socialProfiles || {};

  // Custom fields (mock data if not provided)
  const customFields = contact.customFields || {
    "Acquisition Channel": contact.sources?.[0] || "Direct",
    "Engagement Level": "Medium"
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white dark:bg-gray-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group relative border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 overflow-hidden"
    >
      {/* Selection Checkbox */}
      <div className="absolute top-4 left-4 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="h-4 w-4 text-blue-600 dark:text-blue-500 rounded focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
        />
      </div>

      {/* Header Actions */}
      <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        {/* AI Analysis Button */}
        {onAnalyze && (
          <button 
            onClick={handleAnalyzeClick}
            disabled={analyzing}
            className={`p-2 rounded-lg transition-all duration-200 relative ${
              contact.aiScore 
                ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/60' 
                : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700'
            }`}
            title={contact.aiScore ? 'Re-analyze with AI' : 'Analyze with AI'}
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            {!contact.aiScore && !analyzing && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            )}
          </button>
        )}
        
        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            onClick={handleFavoriteClick}
            className={`p-2 rounded-lg transition-colors ${
              contact.isFavorite 
                ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30' 
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`w-4 h-4 ${contact.isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}

        {showTeamAction && onAddToTeam && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAddToTeam();
            }}
            className="p-2 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            title="Add to team"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        )}
        
        <button
          onClick={handleEditClick}
          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Edit contact"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            // Handle more actions
          }}
          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6">
        {/* Avatar and AI Score Section */}
        <div className="flex items-start justify-between mb-4 mt-4">
          <div className="text-center flex-1">
            <div className="relative inline-block mb-3">
              <AvatarWithStatus
                src={contact.avatarSrc}
                alt={contact.name}
                size="lg"
                status={contact.status}
              />
              
              {/* Analysis Loading Indicator */}
              {analyzing && (
                <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              
              {/* Favorite Badge */}
              {contact.isFavorite && (
                <div className="absolute -top-1 -left-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white">
                  <Heart className="w-2.5 h-2.5" />
                </div>
              )}
              
              {/* AI Enhancement Indicator */}
              {lastEnrichment && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-gray-800">
                  <Sparkles className="w-2 h-2" />
                </div>
              )}
              
              {/* AI Image Search Button */}
              {onFindNewImage && (
                <button 
                  onClick={handleFindImageClick}
                  disabled={isFinding}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full hover:from-purple-700 hover:to-blue-700 transition-colors shadow-lg relative"
                >
                  {isFinding ? (
                    <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{contact.name}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{contact.title}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">{contact.company}</p>
          </div>
          
          {/* AI Score Display */}
          <div className="flex flex-col items-center space-y-2">
            {contact.aiScore ? (
              <div className={`h-12 w-12 rounded-full ${getScoreColor(contact.aiScore)} text-white flex items-center justify-center font-bold text-lg shadow-lg ring-2 ring-white relative`}>
                {contact.aiScore}
                <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-300" />
              </div>
            ) : (
              <button
                onClick={handleAnalyzeClick}
                disabled={analyzing}
                className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center font-bold text-lg shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 hover:scale-110 relative"
                title="Click to get AI score"
              >
                {analyzing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Brain className="w-5 h-5" />
                )}
                {!analyzing && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse">
                    <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping"></div>
                  </div>
                )}
              </button>
            )}
            <span className="text-xs text-gray-500 font-medium">
              {contact.aiScore ? 'AI Score' : 'Click to Score'}
            </span>
          </div>
        </div>
        
        {/* AI Enhancement Notice - New Feature */}
        {lastEnrichment && (
          <div className="mb-4 p-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm">
            <div className="flex items-center justify-center space-x-2">
              <Sparkles className="w-3 h-3 text-purple-500 dark:text-purple-400" />
              <span className="text-xs font-medium text-purple-800 dark:text-purple-300">
                AI Enhanced{lastEnrichment.aiProvider ? ` (${lastEnrichment.aiProvider})` : ''}
              </span>
              {lastEnrichment.confidence && (
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  ({lastEnrichment.confidence}% confidence)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Interest Level */}
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${interestColors[contact.interestLevel]} animate-pulse`} />
          <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
            {interestLabels[contact.interestLevel]}
          </span>
        </div>

        {/* Sources */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Source</p>
          <div className="flex justify-center flex-wrap gap-1">
            {safeSources.map((source, index) => (
              <span
                key={index}
                className={`
                  ${sourceColors[source] || 'bg-gray-600'} 
                  text-white text-xs px-2 py-1 rounded-md font-medium hover:scale-110 transition-transform cursor-pointer
                `}
              >
                {source}
              </span>
            ))}
          </div>
        </div>

        {/* Interest Level Dots */}
        <div className="flex items-center justify-center space-x-1 mb-4">
          {Array.from({ length: 5 }, (_, i) => {
            const isActive = 
              (contact.interestLevel === 'hot' && i < 5) ||
              (contact.interestLevel === 'medium' && i < 3) ||
              (contact.interestLevel === 'low' && i < 2) ||
              (contact.interestLevel === 'cold' && i < 1);
            
            return (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  isActive 
                    ? `${interestColors[contact.interestLevel]} shadow-lg` 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            );
          })}
        </div>
        
        {/* AI Tools Section - NEW ENHANCED FEATURE */}
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center">
            <Brain className="w-3 h-3 mr-1 text-purple-600 dark:text-purple-400" />
            AI Assistant Tools
          </h4>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Lead Score */}
            <button 
              onClick={handleAnalyzeClick}
              disabled={analyzing}
              className="p-2 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-blue-300/50"
            >
              {analyzing ? (
                <Loader2 className="w-3 h-3 animate-spin mb-0.5" />
              ) : (
                <Target className="w-3 h-3 mb-0.5" />
              )}
              <span className="text-[10px]">Score</span>
            </button>
            
            {/* Email AI */}
            <button
              onClick={handleEmailClick}
              className="p-2 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-200 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-700 border-gray-200/50 dark:border-gray-700/50"
            >
              <Mail className="w-3 h-3 mb-0.5" />
              <span className="text-[10px] dark:text-gray-200">Email</span>
            </button>
            
            {/* AI Auto-Enrich */}
            <button
              onClick={handleAIEnrichClick}
              disabled={localEnriching}
              className="p-2 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 border-purple-300/50 col-span-2 relative"
            >
              {localEnriching ? (
                <Loader2 className="w-3 h-3 animate-spin mb-0.5" />
              ) : (
                <Wand2 className="w-3 h-3 mb-0.5" />
              )}
              <span className="text-[10px]">AI Auto-Enrich</span>
              {!localEnriching && (
                <Sparkles className="w-2 h-2 absolute top-1 right-1 text-yellow-300" />
              )}
            </button>
          </div>
        </div>

        {/* AI Insights Section */}
        {(contact.aiScore || contact.psychologicalProfile || contact.aiScoreRationale) && (
          <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                <BarChart className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" />
                ChatGPT-5 Insights
              </h4>
              <div className="flex space-x-1">
                <button
                  onClick={(e) => handleFeedbackClick(e, 'positive')}
                  className="p-1 bg-white dark:bg-gray-700 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  title="This AI insight was helpful"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => handleFeedbackClick(e, 'negative')}
                  className="p-1 bg-white dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="This AI insight was not helpful"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPsychProfile(!showPsychProfile);
                  }}
                  className="p-1 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-600 dark:text-gray-400 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                </button>
              </div>
            </div>
            
            {/* Enhanced AI Insights Display */}
            {contact.aiScoreRationale ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {contact.aiScoreRationale.narrative}
                </p>
                {showPsychProfile && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white dark:bg-gray-700 p-2 rounded border">
                        <p className="font-medium text-green-600 dark:text-green-400">Opportunities</p>
                        <p className="text-gray-600 dark:text-gray-300">{contact.aiScoreRationale.opportunityFlags.slice(0, 1).join(', ')}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-700 p-2 rounded border">
                        <p className="font-medium text-orange-600 dark:text-orange-400">Key Factors</p>
                        <p className="text-gray-600 dark:text-gray-300">{contact.aiScoreRationale.keyFactors.slice(0, 1).map(f => f.factor).join(', ')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {analyzing ? 'Advanced AI analysis in progress...' :
                 contact.aiScore >= 80 ? 'High conversion potential - prioritize for immediate follow-up.' :
                 contact.aiScore >= 60 ? 'Good engagement potential - schedule follow-up within 48 hours.' :
                 contact.aiScore >= 40 ? 'Moderate interest - nurture with valuable content.' :
                 'Low engagement - consider re-qualification.'}
              </p>
            )}
            
            <div className="mt-2 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-purple-500 dark:text-purple-400" />
              <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                {contact.aiScoreRationale ? 'Enhanced with ChatGPT-5' : 'AI-powered analysis'}
              </span>
            </div>
          </div>
        )}
        
        {/* Custom Fields - NEW FEATURE */}
        {customFields && Object.keys(customFields).length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center">
                <Database className="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400" />
                Custom Fields
              </h4>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCustomFields(!showCustomFields);
                }}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showCustomFields ? <ArrowRight className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(customFields).slice(0, showCustomFields ? Object.keys(customFields).length : 2).map(([key, value], index) => (
                <div key={index} className="bg-white dark:bg-gray-700 p-1.5 rounded border border-gray-100 dark:border-gray-600">
                  <p className="text-gray-500 dark:text-gray-400 text-[10px]">{key}</p>
                  <p className="text-gray-700 dark:text-gray-300 font-medium truncate">{value as string}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Profiles - NEW FEATURE */}
        {socialProfiles && Object.values(socialProfiles).some(Boolean) && (
          <div className="mb-4">
            <div className="flex justify-center space-x-2">
              {Array.isArray(socialPlatforms) && socialPlatforms.map((platform, index) => {
                const Icon = platform.icon;
                const profileUrl = socialProfiles[platform.key as keyof typeof socialProfiles];
                
                if (!profileUrl) return null;
                
                return (
                  <a 
                    key={index}
                    href={profileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`p-1.5 ${platform.color} rounded-lg text-white hover:opacity-90 transition-all`}
                    title={platform.name}
                  >
                    <Icon className="w-3 h-3" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Last Connected - NEW FEATURE */}
        {contact.lastConnected && (
          <div className="mb-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-center space-x-2">
              <Activity className="w-3 h-3 text-blue-500" />
              <p className="text-xs text-gray-600 dark:text-gray-300">
                <span className="font-medium">Last Connected:</span> {contact.lastConnected}
              </p>
            </div>
          </div>
        )}

        {/* AI Tools Section */}
        <div className="mb-4">
          <CustomizableAIToolbar
            entityType="contact"
            entityId={contact.id}
            entityData={contact}
            location="contactCards"
            layout="grid"
            size="sm"
            showCustomizeButton={true}
          />
        </div>

        {/* Traditional Action Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={handleEmailClick}
            className="flex items-center justify-center py-1.5 px-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300 rounded-full hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/50 dark:hover:to-blue-700/50 text-xs font-medium transition-all duration-200 border border-blue-200/50 dark:border-blue-600/50 shadow-sm"
          >
            <Mail size={11} className="mr-1" /> Email
          </button>
          <button
            onClick={handleCallClick}
            className="flex items-center justify-center py-1.5 px-2 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 text-green-700 dark:text-green-300 rounded-full hover:from-green-100 hover:to-green-200 dark:hover:from-green-800/50 dark:hover:to-green-700/50 text-xs font-medium transition-all duration-200 border border-green-200/50 dark:border-green-600/50 shadow-sm"
          >
            <Phone size={11} className="mr-1" /> Call
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex items-center justify-center py-1.5 px-2 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 text-purple-700 dark:text-purple-300 rounded-full hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800/50 dark:hover:to-purple-700/50 text-xs font-medium transition-all duration-200 border border-purple-200/50 dark:border-purple-600/50 shadow-sm"
          >
            <User size={11} className="mr-1" /> View
          </button>
        </div>

        {/* Team Action Button (if applicable) */}
        {showTeamAction && onAddToTeam && (
          <div className="mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToTeam();
              }}
              className="w-full flex items-center justify-center py-2 px-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 text-sm font-medium transition-all duration-200 shadow-sm"
            >
              <Crown className="w-4 h-4 mr-2" />
              Add to Team
            </button>
          </div>
        )}

        {/* Tags Display - NEW FEATURE */}
        {safeTags.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-1 justify-center">
              {safeTags.slice(0, 2).map((tag, index) => (
                <span 
                  key={index}
                  className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs rounded-full border border-blue-200 dark:border-blue-800"
                >
                  {tag}
                </span>
              ))}
              {safeTags.length > 2 && (
                <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-xs rounded-full border border-gray-200">
                  +{safeTags.length - 2}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Click indicator */}
        <div className="mt-3 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <p className="text-xs text-blue-500 font-medium">
            {analyzing ? 'AI analysis in progress...' : 
             localEnriching ? 'AI enrichment in progress...' :
             !contact.aiScore ? 'Click AI button to score • Click card for details' :
             'Click to view details'}
          </p>
        </div>
      </div>

      {/* Email Composer Modal */}
      <EmailComposer
        contact={contact}
        isOpen={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        onSend={handleEmailSend}
      />
    </div>
  );
};

export default AIEnhancedContactCard;