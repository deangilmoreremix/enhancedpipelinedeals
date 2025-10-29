import React, { useState } from 'react';
import {
  BarChart3,
  Mail,
  TrendingUp,
  AlertTriangle,
  Navigation,
  FileText,
  Send,
  Calendar,
  DollarSign,
  Heart,
  UserPlus,
  Search,
  BarChart,
  Zap,
  Clock,
  GitBranch,
  PenTool,
  Video,
  FileSearch,
  Package,
  Settings,
  Plus,
  Brain,
  Target,
  Phone,
  MessageSquare,
  Wand2,
  Database,
  Globe,
  ArrowRight,
  Activity,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  X,
  Loader2,
  Mic
} from 'lucide-react';
import { getAIFunctionOrchestrator } from '../../services/aiFunctionOrchestrator';
import { VoiceAssistant, VoiceAssistantButton } from './VoiceAssistant';

interface QuickAIButtonProps {
  icon: React.ComponentType<any>;
  label: string;
  toolName: string;
  entityType: string;
  entityId: string;
  entityData: any;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
  className?: string;
  onClick?: () => void;
}

interface CustomizableAIToolbarProps {
  entityType: string;
  entityId: string;
  entityData: any;
  location: string;
  layout: 'grid' | 'row';
  size: 'sm' | 'md';
  showCustomizeButton?: boolean;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  BarChart3,
  Mail,
  TrendingUp,
  AlertTriangle,
  Navigation,
  FileText,
  Send,
  Calendar,
  DollarSign,
  Heart,
  UserPlus,
  Search,
  BarChart,
  Zap,
  Clock,
  GitBranch,
  PenTool,
  Video,
  FileSearch,
  Package,
  Settings,
  Plus,
  Brain,
  Target,
  Phone,
  MessageSquare,
  Wand2,
  Database,
  Globe,
  ArrowRight,
  Activity,
  CheckCircle,
  AlertCircle,
  Sparkles
};

const toolMapping: Record<string, string> = {
  'leadScoring': 'analyze_contact_profile',
  'emailPersonalization': 'generate_personalized_email',
  'contactEnrichment': 'enrich_contact_data',
  'dealRiskAssessment': 'comprehensive_deal_analysis',
  'nextBestAction': 'comprehensive_deal_analysis',
  'proposalGeneration': 'generate_personalized_email',
  'businessIntelligence': 'enrich_contact_data',
  'companyHealthScoring': 'comprehensive_deal_analysis',
  'opportunityIdentification': 'comprehensive_deal_analysis'
};

const defaultQuickActions = [
  { icon: 'BarChart3', label: 'Lead Score', toolName: 'leadScoring', variant: 'primary' },
  { icon: 'Mail', label: 'Email AI', toolName: 'emailPersonalization', variant: 'secondary' },
  { icon: 'Search', label: 'Enrich', toolName: 'contactEnrichment', variant: 'secondary' },
  { icon: 'TrendingUp', label: 'Insights', toolName: 'businessIntelligence', variant: 'secondary' }
];

const QuickAIButton: React.FC<QuickAIButtonProps> = ({
  icon: IconComponent,
  label,
  toolName,
  entityType,
  entityId,
  entityData,
  size = 'sm',
  variant = 'secondary',
  className = '',
  onClick
}) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleClick = async () => {
    if (onClick) {
      onClick();
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      // Execute AI tool based on toolName
      const toolResult = await executeAITool(toolName, entityType, entityData);
      setResult(toolResult);
    } catch (error) {
      console.error(`Failed to execute ${toolName}:`, error);
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const executeAITool = async (toolName: string, entityType: string, entityData: any): Promise<string> => {
    const orchestrator = getAIFunctionOrchestrator();
    const mappedFunctionName = toolMapping[toolName] || toolName;

    try {
      // Prepare parameters based on entity type and function
      const parameters: Record<string, any> = {
        contactData: entityData,
        dealData: entityData
      };

      // Add specific parameters based on function
      if (mappedFunctionName === 'analyze_contact_profile') {
        parameters.contactId = entityData.id;
        parameters.includeWebResearch = true;
        parameters.depth = 'comprehensive';
      } else if (mappedFunctionName === 'enrich_contact_data') {
        parameters.contactId = entityData.id;
        parameters.includeSocialProfiles = true;
        parameters.includeCompanyResearch = true;
      } else if (mappedFunctionName === 'comprehensive_deal_analysis') {
        parameters.dealId = entityData.id;
        parameters.includeMarketResearch = true;
        parameters.includeStakeholderAnalysis = true;
      } else if (mappedFunctionName === 'generate_personalized_email') {
        parameters.contactId = entityData.id;
        parameters.context = 'follow-up';
        parameters.tone = 'professional';
      }

      // Execute the AI function
      const result = await orchestrator.executeFunction(mappedFunctionName, parameters, {
        userId: 'current-user', // This should come from auth context
        componentId: 'customizable-ai-toolbar',
        entityType: entityType as 'contact' | 'deal' | 'company',
        entityId: entityData.id,
        timestamp: Date.now()
      });

      if (result.success) {
        // Format the result for display
        return formatAIResult(mappedFunctionName, result, entityData);
      } else {
        throw new Error(result.error || 'AI function execution failed');
      }
    } catch (error) {
      console.error(`AI Function execution failed for ${toolName}:`, error);
      throw error;
    }
  };

  const formatAIResult = (functionName: string, result: any, entityData: any): string => {
    switch (functionName) {
      case 'analyze_contact_profile':
        const analysis = result.data;
        return `Contact analysis complete. Score: ${analysis?.score || 'N/A'}/100. ${analysis?.insights?.length || 0} insights generated.`;

      case 'enrich_contact_data':
        const enrichment = result.data;
        return `Contact enriched with ${enrichment?.citations?.length || 0} sources. Confidence: ${Math.round((enrichment?.confidence || 0) * 100)}%.`;

      case 'comprehensive_deal_analysis':
        const dealAnalysis = result.data;
        return `Deal analysis complete. Probability: ${dealAnalysis?.probability || 'N/A'}%. ${dealAnalysis?.insights?.length || 0} insights and ${dealAnalysis?.recommendations?.length || 0} recommendations generated.`;

      case 'generate_personalized_email':
        const email = result.data;
        return `Email generated: "${email?.subject || 'Subject generated'}" with personalized content for ${entityData.name}.`;

      default:
        return `AI function ${functionName} executed successfully.`;
    }
  };

  const sizeClasses = size === 'sm' ? 'p-2 text-xs' : 'p-3 text-sm';
  const variantClasses = variant === 'primary' 
    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700' 
    : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 hover:from-gray-100 hover:to-gray-200';

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isExecuting}
        className={`
          ${sizeClasses} ${variantClasses} ${className}
          flex flex-col items-center justify-center rounded-lg font-medium transition-all duration-200
          border shadow-sm hover:shadow-md hover:scale-105 min-h-[3rem] disabled:opacity-50 disabled:cursor-not-allowed
          ${variant === 'primary' ? 'border-blue-300/50' : 'border-gray-200/50'}
          ${result ? 'ring-2 ring-green-300' : ''}
        `}
      >
        {isExecuting ? (
          <Loader2 size={size === 'sm' ? 12 : 16} className="mb-1 animate-spin" />
        ) : (
          <IconComponent size={size === 'sm' ? 12 : 16} className="mb-1" />
        )}
        <span className="leading-tight text-center">
          {isExecuting ? 'Running...' : label}
        </span>
      </button>

      {/* Result Tooltip */}
      {result && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
          <div className="flex items-start space-x-2">
            <CheckCircle size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">{result}</p>
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export const AIGoalsButton: React.FC<{
  entityType: string;
  entityId: string;
  entityData: any;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
  className?: string;
}> = ({ entityType, entityId, entityData, size = 'sm', variant = 'primary', className = '' }) => {
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [aiGoals, setAiGoals] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async () => {
    setShowGoalsModal(true);
    setIsGenerating(true);

    try {
      // Simulate AI goal generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate goals based on entity type and data
      const goals = generateAIGoals(entityType, entityData);
      setAiGoals(goals);
    } catch (error) {
      console.error('Failed to generate AI goals:', error);
      setAiGoals(['Failed to generate goals. Please try again.']);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAIGoals = (type: string, data: any): string[] => {
    if (type === 'contact') {
      const goals = [
        `Increase engagement with ${data.name} by scheduling a follow-up call within 3 days`,
        `Send personalized email campaign highlighting ${data.company}'s specific needs`,
        `Arrange a product demo tailored to ${data.industry || 'their industry'}`,
        `Develop a customized proposal addressing their pain points`,
        `Build relationship through LinkedIn networking and content sharing`
      ];
      return goals;
    } else if (type === 'deal') {
      const goals = [
        `Advance ${data.title} to the next stage by ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}`,
        `Increase deal probability to ${Math.min(data.probability + 20, 95)}% through targeted follow-up`,
        `Secure stakeholder buy-in from ${data.contact} and decision makers`,
        `Address any concerns and provide additional value propositions`,
        `Close the deal within the next ${Math.ceil(data.value / 10000)} weeks`
      ];
      return goals;
    }
    return ['Generate personalized goals based on entity data'];
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`
          ${className}
          flex items-center justify-center py-2 px-3
          bg-gradient-to-r from-indigo-500 to-purple-500 text-white
          rounded-lg hover:from-indigo-600 hover:to-purple-600
          ${size === 'sm' ? 'text-sm' : 'text-base'} font-medium
          transition-all duration-200 border border-indigo-300/50 shadow-sm hover:shadow-md hover:scale-105
        `}
      >
        <Target size={size === 'sm' ? 14 : 16} className="mr-2" />
        AI Goals
      </button>

      {/* AI Goals Modal */}
      {showGoalsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI-Generated Goals
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Smart objectives for {entityType} success
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGoalsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {isGenerating ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-indigo-600 mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Generating AI Goals...
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Analyzing {entityType} data to create personalized objectives
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Recommended Goals for {entityData.name || entityData.title}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {aiGoals.map((goal, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50"
                      >
                        <CheckCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {goal}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setShowGoalsModal(false)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        // Could implement goal tracking/saving functionality here
                        console.log('Saving AI goals:', aiGoals);
                        setShowGoalsModal(false);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-colors"
                    >
                      Save Goals
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const CustomizableAIToolbar: React.FC<CustomizableAIToolbarProps> = ({
  entityType,
  entityId,
  entityData,
  location,
  layout,
  size,
  showCustomizeButton = true
}) => {
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customQuickActions, setCustomQuickActions] = useState(defaultQuickActions);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

  return (
    <>
      <div className="space-y-3">
        {/* Voice Assistant Button */}
        <div className="flex items-center justify-between">
          <VoiceAssistantButton
            onClick={() => setShowVoiceAssistant(true)}
            isActive={showVoiceAssistant}
            className="flex-1 mr-2"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Voice Commands
          </span>
        </div>

        {/* AI Goals Button */}
        <AIGoalsButton
          entityType={entityType}
          entityId={entityId}
          entityData={entityData}
          size={size}
          variant="primary"
          className="w-full justify-center"
        />

        {/* Quick AI Actions Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {customQuickActions.map((action, index) => {
            const IconComponent = iconMap[action.icon as keyof typeof iconMap];
            return (
              <QuickAIButton
                key={index}
                icon={IconComponent}
                label={action.label}
                toolName={action.toolName}
                entityType={entityType}
                entityId={entityId}
                entityData={entityData}
                size={size}
                variant={action.variant as 'primary' | 'secondary'}
                className="w-full justify-center text-center"
              />
            );
          })}
        </div>

        {/* Customize Button */}
        {showCustomizeButton && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCustomizeModal(true)}
              className="flex-1 flex items-center justify-center py-2 px-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-lg hover:from-indigo-100 hover:to-purple-100 text-sm font-medium transition-all duration-200 border border-indigo-200/50 shadow-sm border-dashed mr-2"
            >
              <Plus size={14} className="mr-2" />
              Add Custom AI Goals
            </button>
            <button
              onClick={() => setShowCustomizeModal(true)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Customize buttons"
            >
              <Settings size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Voice Assistant */}
      <VoiceAssistant
        isOpen={showVoiceAssistant}
        onClose={() => setShowVoiceAssistant(false)}
        entityType={entityType as 'contact' | 'deal' | 'company'}
        entityId={entityId}
        entityData={entityData}
      />
    </>
  );
};