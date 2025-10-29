import React, { useState, useRef } from 'react';
import { Deal } from '../types';
import { CustomizableAIToolbar } from './ui/CustomizableAIToolbar';
import { EmailComposer } from './communication/EmailComposer';
import { getEmailService } from '../services/emailService';
import { getPhoneService } from '../services/phoneService';
import { Tooltip } from './ui/Tooltip';
import { 
  Calendar, 
  DollarSign, 
  User, 
  Building2, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  TrendingUp,
  Edit,
  Camera,
  Database,
  Globe,
  ExternalLink,
  ArrowRight,
  Activity,
  Plus,
  MoreHorizontal,
  Heart,
  Loader2,
  Brain,
  Sparkles,
  Target,
  Mail,
  Wand2,
  Phone,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Linkedin,
  Twitter,
  Facebook
} from 'lucide-react';

interface AIEnhancedDealCardProps {
  deal: Deal;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick: () => void;
  showAnalyzeButton?: boolean;
  onAnalyze?: (deal: Deal) => Promise<boolean>;
  onAIEnrich?: (deal: Deal) => Promise<boolean>;
  isAnalyzing?: boolean;
  onToggleFavorite?: (deal: Deal) => Promise<void>;
  onFindNewImage?: (deal: Deal) => Promise<void>;
  onEdit?: (deal: Deal) => void;
  isOpenAIFunctionCalling?: boolean;
  openAIResult?: any;
}

export const AIEnhancedDealCard: React.FC<AIEnhancedDealCardProps> = ({
  deal,
  isSelected = false,
  onSelect,
  onClick,
  showAnalyzeButton = true,
  onAnalyze,
  onAIEnrich,
  isAnalyzing = false,
  onToggleFavorite,
  onFindNewImage,
  onEdit,
  isOpenAIFunctionCalling = false,
  openAIResult
}) => {
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [localAnalyzing, setLocalAnalyzing] = useState(false);
  const [localEnriching, setLocalEnriching] = useState(false);
  const [isFinding, setIsFinding] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // New state to track AI enrichment status
  const [lastEnrichment, setLastEnrichment] = useState<any>(
    deal.lastEnrichment || (deal.probability > 75 ? { confidence: deal.probability } : null)
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const isOverdue = deal.dueDate && new Date() > deal.dueDate;
  const isDueSoon = deal.dueDate && !isOverdue && 
    (deal.dueDate.getTime() - new Date().getTime()) < (7 * 24 * 60 * 60 * 1000);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'High Priority';
      case 'medium': return 'Medium Priority';
      case 'low': return 'Low Priority';
      default: return 'Normal Priority';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'qualification': return 'bg-blue-500';
      case 'proposal': return 'bg-indigo-500';
      case 'negotiation': return 'bg-purple-500';
      case 'closed-won': return 'bg-green-500';
      case 'closed-lost': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getScoreColor = (probability: number) => {
    if (probability >= 80) return 'bg-green-500';
    if (probability >= 60) return 'bg-blue-500';
    if (probability >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Generate avatar URLs based on company and contact names
  const getCompanyAvatar = (companyName: string) => {
    const seed = companyName.toLowerCase().replace(/\s+/g, '');
    return deal.companyAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444&textColor=ffffff`;
  };

  const getPersonAvatar = (personName: string) => {
    const seed = personName.toLowerCase().replace(/\s+/g, '');
    return deal.contactAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=3b82f6,8b5cf6,f59e0b,10b981,ef4444`;
  };

  const handleCardClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('a')) {
      return;
    }

    // Trigger AI analysis when card is clicked (if probability is low or not analyzed)
    if (deal.probability < 70) {
      try {
        const { getAIFunctionOrchestrator } = await import('../services/aiFunctionOrchestrator');
        const orchestrator = getAIFunctionOrchestrator();

        // Run comprehensive deal analysis in background
        setTimeout(async () => {
          await orchestrator.executeFunction('comprehensive_deal_analysis', {
            dealId: deal.id,
            includeMarketResearch: false, // Quick analysis for card click
            includeStakeholderAnalysis: false
          }, {
            userId: 'current-user',
            componentId: 'deal-card-click',
            entityType: 'deal',
            entityId: deal.id,
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
      // Call existing analyze function
      await onAnalyze(deal);

      // Additionally trigger AI function orchestrator
      const { getAIFunctionOrchestrator } = await import('../services/aiFunctionOrchestrator');
      const orchestrator = getAIFunctionOrchestrator();

      await orchestrator.executeFunction('comprehensive_deal_analysis', {
        dealId: deal.id,
        includeMarketResearch: true,
        includeStakeholderAnalysis: true
      }, {
        userId: 'current-user',
        componentId: 'deal-card-analyze',
        entityType: 'deal',
        entityId: deal.id,
        timestamp: Date.now()
      });

      setLastEnrichment({
        confidence: Math.max(deal.probability, 75),
        aiProvider: 'Hybrid AI (GPT-4o + Gemini)',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLocalAnalyzing(false);
    }
  };

  const handleAIEnrichClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAIEnrich || localEnriching) return;

    setLocalEnriching(true);
    try {
      // Call existing enrich function
      await onAIEnrich(deal);

      // Additionally trigger AI function orchestrator for enrichment
      const { getAIFunctionOrchestrator } = await import('../services/aiFunctionOrchestrator');
      const orchestrator = getAIFunctionOrchestrator();

      await orchestrator.executeFunction('enrich_contact_data', {
        contactId: deal.contact, // Use contact from deal
        includeSocialProfiles: true,
        includeCompanyResearch: true
      }, {
        userId: 'current-user',
        componentId: 'deal-card-enrich',
        entityType: 'deal',
        entityId: deal.id,
        timestamp: Date.now()
      });

      setLastEnrichment({
        confidence: Math.min(deal.probability + 10, 95),
        aiProvider: 'OpenAI GPT-4o',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Enrichment failed:', error);
    } finally {
      setLocalEnriching(false);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleFavorite) return;
    
    try {
      await onToggleFavorite(deal);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleFindImageClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onFindNewImage || isFinding) return;

    setIsFinding(true);
    try {
      await onFindNewImage(deal);
    } catch (error) {
      console.error('Failed to find new image:', error);
    } finally {
      setIsFinding(false);
    }
  };

  const handleEmailClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Trigger AI email generation before opening composer
    try {
      const { getAIFunctionOrchestrator } = await import('../services/aiFunctionOrchestrator');
      const orchestrator = getAIFunctionOrchestrator();

      await orchestrator.executeFunction('generate_personalized_email', {
        contactId: deal.contact,
        context: 'deal-followup',
        tone: 'professional'
      }, {
        userId: 'current-user',
        componentId: 'deal-card-email',
        entityType: 'deal',
        entityId: deal.id,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('AI email generation failed:', error);
    }

    setShowEmailComposer(true);
  };

  const handleEmailSend = (emailData: any) => {
    console.log('📧 Email sent from deal card:', emailData);
    // Here you could log the email activity or update deal status
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(deal);
    }
  };

  const handleCallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const phoneService = getPhoneService();

    // Use a default phone number for demo purposes
    const phoneNumber = '+1-555-0123'; // Default for demo

    try {
      const success = await phoneService.makeCall(phoneNumber, deal.contact, deal.title);
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
      console.log(`📊 AI Feedback: ${feedbackType} feedback for deal ${deal.id}`);

      // Here you could send feedback to your AI service for model improvement
      // For now, we'll just show a brief success indication

      // You could also store this feedback in the database for analysis
      const feedbackData = {
        entityType: 'deal',
        entityId: deal.id,
        feedbackType,
        timestamp: new Date(),
        aiProvider: lastEnrichment?.aiProvider || 'AI Assistant',
        insightType: 'probability_analysis'
      };

      console.log('💾 Storing AI feedback:', feedbackData);

      // Show brief visual feedback
      // This could be enhanced with a toast notification system
      alert(`Thank you for your feedback! ${feedbackType === 'positive' ? '👍' : '👎'} This helps improve our AI insights.`);

    } catch (error) {
      console.error('Failed to submit AI feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    }
  };

  // Get social profiles (mock data if not provided)
  const socialProfiles = deal.socialProfiles || {
    linkedin: deal.company ? `https://linkedin.com/company/${deal.company.toLowerCase().replace(/\s+/g, '-')}` : undefined,
    website: deal.company ? `https://${deal.company.toLowerCase().replace(/\s+/g, '')}.com` : undefined
  };

  // Custom fields (mock data if not provided)
  const customFields = deal.customFields || {
    "Deal Source": deal.tags?.[0] || "Direct",
    "Account Manager": "Alex Rivera"
  };

  // Social platform definitions
  const socialPlatforms = [
    { icon: Linkedin, color: 'bg-blue-500', name: 'LinkedIn', key: 'linkedin' },
    { icon: Globe, color: 'bg-purple-600', name: 'Website', key: 'website' },
    { icon: Twitter, color: 'bg-blue-400', name: 'Twitter', key: 'twitter' },
    { icon: Facebook, color: 'bg-blue-700', name: 'Facebook', key: 'facebook' },
  ];

  const analyzing = isAnalyzing || localAnalyzing;
  const enriching = localEnriching;

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group relative border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 overflow-hidden"
    >
      {/* Selection Checkbox */}
      {onSelect && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="h-4 w-4 text-blue-600 dark:text-blue-500 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
          />
        </div>
      )}

      {/* Header Actions */}
      <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        {/* AI Analysis Button - Prominently Featured */}
        {onAnalyze && showAnalyzeButton && (
          <Tooltip content={deal.probability > 70 ? 'Re-analyze with AI - Update win probability and insights' : 'AI Analysis - Generate win probability and strategic insights'} position="bottom">
            <button
              onClick={handleAnalyzeClick}
              disabled={analyzing}
              className={`p-2 rounded-lg transition-all duration-200 relative ${
                deal.probability > 70
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/60 border border-purple-200 dark:border-purple-700'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg dark:from-blue-600 dark:to-purple-600 dark:hover:from-blue-700 dark:hover:to-purple-700 border border-blue-400 dark:border-blue-500'
              }`}
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              {deal.probability < 70 && !analyzing && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              )}
            </button>
          </Tooltip>
        )}
        
        {/* Favorite Button */}
        {onToggleFavorite && (
          <Tooltip content={deal.isFavorite ? 'Remove from Favorites - Unmark this deal' : 'Add to Favorites - Quick access to important deals'} position="bottom">
            <button
              onClick={handleFavoriteClick}
              className={`p-2 rounded-lg transition-colors ${
                deal.isFavorite
                  ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-700'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${deal.isFavorite ? 'fill-current' : ''}`} />
            </button>
          </Tooltip>
        )}
        
        <Tooltip content="Edit Deal - Modify deal details, stage, and notes" position="bottom">
          <button
            onClick={handleEditClick}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
          >
            <Edit className="w-3 h-3" />
          </button>
        </Tooltip>
        <Tooltip content="More Actions - Additional options and workflows" position="bottom">
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </Tooltip>
      </div>

      <div className="p-6">
        {/* Company and Person Avatars with Deal Info */}
        <div className="flex items-start justify-between mb-4 mt-4 text-gray-900 dark:text-white">
          <div className="flex-1 min-w-0">
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
              {deal.title}
            </h3>
            
            {/* Company Info with Avatar */}
            <div className="flex items-center space-x-2 mb-2">
              <div className="relative">
                <img 
                  src={getCompanyAvatar(deal.company)}
                  alt={deal.company}
                  className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
                
                {/* Image search button */}
                {onFindNewImage && (
                  <Tooltip content="Update Company Avatar - Find a new profile image" position="right">
                    <button
                      onClick={handleFindImageClick}
                      disabled={isFinding}
                      className="absolute -bottom-1 -right-1 p-0.5 bg-blue-600 dark:bg-blue-700 text-white rounded-full hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors shadow-sm"
                    >
                      {isFinding ? (
                        <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Camera className="w-2 h-2" />
                      )}
                    </button>
                  </Tooltip>
                )}
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">{deal.company}</p>
              </div>
            </div>
            
            {/* Contact Person with Avatar */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <img 
                  src={getPersonAvatar(deal.contact)}
                  alt={deal.contact}
                  className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
                
                {/* Image search button */}
                {onFindNewImage && (
                  <Tooltip content="Update Contact Avatar - Find contact profile picture" position="right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="absolute -bottom-1 -right-1 p-0.5 bg-purple-600 dark:bg-purple-700 text-white rounded-full hover:bg-purple-700 dark:hover:bg-purple-800 transition-colors shadow-sm"
                    >
                      <Camera className="w-2 h-2" />
                    </button>
                  </Tooltip>
                )}
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                <p className="text-gray-600 dark:text-gray-400 text-xs">{deal.contact}</p>
              </div>
            </div>
            
            {/* Assigned Team Member */}
            {deal.assignedTo && (
              <div className="flex items-center space-x-1 mt-1">
                <User className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                  Assigned to {deal.assignedTo}
                </span>
              </div>
            )}
          </div>
          
          {/* Deal Score Display */}
          <div className="flex flex-col items-center space-y-2">
            <Tooltip content={`Win Probability: ${deal.probability}% - AI-calculated likelihood of closing this deal`} position="left">
              <div className={`h-12 w-12 rounded-full ${getScoreColor(deal.probability)} text-white flex items-center justify-center font-bold text-lg shadow-lg ring-2 ring-white relative`}>
                {deal.probability}%

                {/* Analysis Loading Indicator */}
                {analyzing && (
                  <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {/* AI Enhanced Indicator */}
                {deal.probability > 70 && (
                  <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-300" />
                )}

                {/* Favorite Badge */}
                {deal.isFavorite && (
                  <div className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg ring-1 ring-white">
                    <Heart className="w-2 h-2" />
                  </div>
                )}
              </div>
            </Tooltip>
            <span className="text-xs text-gray-500 font-medium">
              {analyzing ? 'Analyzing...' : 'Probability'}
            </span>
          </div>
        </div>

        {/* AI Enhancement Notice - New Feature */}
        {(lastEnrichment || isOpenAIFunctionCalling) && (
          <div className="mb-4 p-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm">
            <div className="flex items-center justify-center space-x-2">
              {isOpenAIFunctionCalling ? (
                <>
                  <Loader2 className="w-3 h-3 text-purple-600 dark:text-purple-400 animate-spin" />
                  <span className="text-xs font-medium text-purple-900 dark:text-purple-200">
                    OpenAI Function Calling...
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-purple-900 dark:text-purple-200">
                    AI Enhanced{lastEnrichment.aiProvider ? ` (${lastEnrichment.aiProvider})` : ''}
                  </span>
                  {lastEnrichment.confidence && (
                    <span className="text-xs text-purple-700 dark:text-purple-300">
                      ({lastEnrichment.confidence}% confidence)
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Priority Level */}
        <Tooltip content={`Priority: ${getPriorityLabel(deal.priority)} - Determines urgency and resource allocation`} position="top">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${getPriorityColor(deal.priority)} animate-pulse`} />
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
              {getPriorityLabel(deal.priority)}
            </span>
          </div>
        </Tooltip>

        {/* Deal Value and Stage */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Value & Stage</p>
          <div className="flex justify-center items-center space-x-3">
            <div className="text-center text-gray-900 dark:text-white">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(deal.value)}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Deal Value</p>
            </div>
            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>
            <div className="text-center">
              <span className={`${getStageColor(deal.stage)} text-white text-xs px-2 py-1 rounded-md font-medium`}>
                {deal.stage === 'closed-won' ? 'Won' :
                 deal.stage === 'closed-lost' ? 'Lost' :
                 deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1)}
              </span>
            </div>
          </div>
        </div>
        {/* AI Insights Section */}
        {/* Progress Dots */}
        <div className="flex items-center justify-center space-x-1 mb-4">
          {Array.from({ length: 5 }, (_, i) => {
            const isActive = i < Math.floor(deal.probability / 20);
            return (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  isActive 
                    ? `${getScoreColor(deal.probability)} shadow-lg` 
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                }`}
              />
            );
          })}
        </div>

        {/* Due Date Alert */}
        {deal.dueDate && (
          <div className={`mb-4 p-2 rounded-lg text-center ${
            isOverdue ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
            isDueSoon ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
            'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          }`}>
            <div className="flex items-center justify-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium">
                {isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'On Track'}
              </span>
            </div>
            <p className="text-xs mt-1">{deal.dueDate.toLocaleDateString()}</p>
          </div>
        )}

        {/* AI Tools Section - NEW ENHANCED FEATURE */}
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-center">
            <Brain className="w-3 h-3 mr-1 text-purple-600 dark:text-purple-400" />
            AI Assistant Tools
          </h4>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Lead Score */}
            <Tooltip content="AI Score - Calculate win probability based on deal characteristics" position="top">
              <button
                onClick={handleAnalyzeClick}
                disabled={analyzing}
                className="p-2 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 border-blue-300/50 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 dark:border-blue-500/50"
              >
                {analyzing ? (
                  <Loader2 className="w-3 h-3 animate-spin mb-0.5" />
                ) : (
                  <Target className="w-3 h-3 mb-0.5" />
                )}
                <span className="text-[10px]">Score</span>
              </button>
            </Tooltip>
            
            {/* Email AI */}
            <Tooltip content="AI Email - Generate personalized email with AI assistance" position="top">
              <button
                onClick={handleEmailClick}
                className="p-2 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-600 dark:hover:to-gray-500 border-gray-200/50 dark:border-gray-600/50"
              >
                <Mail className="w-3 h-3 mb-0.5" />
                <span className="text-[10px] text-gray-700 dark:text-gray-200">Email</span>
              </button>
            </Tooltip>
            
            {/* AI Auto-Enrich */}
            <Tooltip content="AI Enrich - Automatically enrich contact and company data from multiple sources" position="top">
              <button
                onClick={handleAIEnrichClick}
                disabled={localEnriching}
                className="p-2 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all duration-200 border shadow-sm hover:shadow-md hover:scale-105 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-700 dark:to-blue-700 text-white hover:from-purple-700 hover:to-blue-700 dark:hover:from-purple-800 dark:hover:to-blue-800 border-purple-300/50 dark:border-purple-500/50 col-span-2 relative"
              >
                {localEnriching ? (
                  <Loader2 className="w-3 h-3 animate-spin mb-0.5" />
                ) : (
                  <Wand2 className="w-3 h-3 mb-0.5" />
                )}
                <span className="text-[10px] text-white">AI Auto-Enrich</span>
                {!localEnriching && (
                  <Sparkles className="w-2 h-2 absolute top-1 right-1 text-yellow-300" />
                )}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <BarChart3 className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400" />
              AI Insights
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
            </div>
          </div> 
          <p className="text-xs text-gray-800 dark:text-gray-200">
            {analyzing ? 'AI analysis in progress...' :
             deal.probability >= 80 ? 'High conversion probability. Top priority for immediate follow-up.' :
             deal.probability >= 60 ? 'Good potential. Schedule follow-up meeting within 48 hours.' :
             deal.probability >= 40 ? 'Moderate potential. Continue nurturing with valuable content.' :
             'Lower probability. Focus on qualification and value demonstration.'}
          </p>
          <div className="mt-2 flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-purple-500" />
            <span className="text-xs text-purple-800 dark:text-purple-300 font-medium">AI-powered analysis</span>
          </div>
        </div>
        {/* Custom Fields - NEW FEATURE */}
        {/* Custom Fields - NEW FEATURE */}
        {customFields && Object.keys(customFields).length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                <Database className="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400" />
                Custom Fields
              </h4>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCustomFields(!showCustomFields);
                }}
                className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {showCustomFields ? <ArrowRight className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-900 dark:text-white">
              {Object.entries(customFields).slice(0, showCustomFields ? Object.keys(customFields).length : 2).map(([key, value], index) => (
                <div key={index} className="bg-white dark:bg-gray-700 p-1.5 rounded border border-gray-100 dark:border-gray-600">
                  <p className="text-gray-600 dark:text-gray-400 text-[10px]">{key}</p>
                  <p className="text-gray-800 dark:text-gray-200 font-medium truncate">{value as string}</p>
                </div>
              ))}
            </div>
          </div>
        )} 
        {/* Social Profiles - NEW FEATURE */}
        {/* Social Profiles - NEW FEATURE */}
        {socialProfiles && Object.values(socialProfiles).some(Boolean) && (
          <div className="mb-4">
            <div className="flex justify-center space-x-2">
              {socialPlatforms.map((platform, index) => {
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
                    className={`p-1.5 ${platform.color} rounded-lg text-white hover:opacity-90 transition-all shadow-sm`}
                    title={platform.name}
                  >
                    <Icon className="w-3 h-3" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
        {/* Last Activity - NEW FEATURE */}
        {/* Last Activity - NEW FEATURE */}
        {deal.lastActivity && (
          <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center space-x-2">
              <Activity className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-medium">Last Activity:</span> {deal.lastActivity}
              </p>
            </div>
          </div>
        )} 
        {/* AI Tools Section */}
        {/* AI Tools Section */}
        <div className="mb-4">
          <CustomizableAIToolbar
            entityType="deal"
            entityId={deal.id}
            entityData={deal}
            location="dealCards"
            layout="grid"
            size="sm"
            showCustomizeButton={true}
          />
        </div>
        {/* Action Buttons */}
        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={handleEmailClick}
            className="flex items-center justify-center py-1.5 px-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 text-blue-700 dark:text-blue-200 rounded-full hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/60 dark:hover:to-blue-700/60 text-xs font-medium transition-all duration-200 border border-blue-200/50 dark:border-blue-500/50 shadow-sm"
          >
            <Mail size={11} className="mr-1" /> Email
          </button>
          <button
            onClick={handleCallClick}
            className="flex items-center justify-center py-1.5 px-2 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/40 text-green-700 dark:text-green-200 rounded-full hover:from-green-100 hover:to-green-200 dark:hover:from-green-800/60 dark:hover:to-green-700/60 text-xs font-medium transition-all duration-200 border border-green-200/50 dark:border-green-500/50 shadow-sm"
          >
            <Phone size={11} className="mr-1" /> Call
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex items-center justify-center py-1.5 px-2 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/40 text-purple-700 dark:text-purple-200 rounded-full hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800/60 dark:hover:to-purple-700/60 text-xs font-medium transition-all duration-200 border border-purple-200/50 dark:border-purple-500/50 shadow-sm"
          >
            <Target size={11} className="mr-1" /> View
          </button>
        </div>
        {/* Tags Display */}
        {/* Tags Display */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-1 justify-center">
              {deal.tags.slice(0, 2).map((tag, index) => (
                <span 
                  key={index}
                  className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 text-xs rounded-full border border-blue-200 dark:border-blue-600"
                >
                  {tag}
                </span>
              ))}
              {deal.tags.length > 2 && (
                <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full border border-gray-200 dark:border-gray-600">
                  +{deal.tags.length - 2}
                </span>
              )}
            </div>
          </div>
        )}
        {/* Click indicator */}
        {/* Click indicator */}
        <div className="mt-3 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {analyzing ? 'AI analysis in progress...' : 
             enriching ? 'AI enrichment in progress...' :
             deal.probability <= 70 ? 'Click AI button to analyze • Click card for details' :
             'Click to view details'}
          </p>
        </div>
      </div>

      {/* Email Composer Modal */}
      <EmailComposer
        deal={deal}
        isOpen={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        onSend={handleEmailSend}
      />
    </div>
  );
}