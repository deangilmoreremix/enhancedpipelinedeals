import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { Deal } from '../../types';
import { 
  Brain,
  Sparkles,
  Loader2,
  Users,
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  Target,
  Calendar,
  Lightbulb,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';

interface AICoachingPanelProps {
  entity: Contact | Deal;
  entityType: 'contact' | 'deal';
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

interface CoachingData {
  situationalAdvice: string;
  keyStrategies: string[];
  nextMeeting: {
    agenda: string[];
    talking_points: string[];
    avoid: string[];
  };
  riskMitigation: string[];
}

export const AICoachingPanel: React.FC<AICoachingPanelProps> = ({
  entity,
  entityType,
  isVisible = false,
  onToggleVisibility
}) => {
  const [showCoachingPanel, setShowCoachingPanel] = useState(isVisible);
  const [objectionInput, setObjectionInput] = useState('');
  const [objectionResponse, setObjectionResponse] = useState('');
  const [isHandlingObjection, setIsHandlingObjection] = useState(false);
  const [coachingData, setCoachingData] = useState<CoachingData | null>(null);
  const [isLoadingCoaching, setIsLoadingCoaching] = useState(false);

  // Entity type guards
  const isContact = (entity: Contact | Deal): entity is Contact => entityType === 'contact';
  const isDeal = (entity: Contact | Deal): entity is Deal => entityType === 'deal';

  const getEntityName = () => {
    if (isContact(entity)) {
      return entity.firstName || entity.name;
    } else {
      return entity.contact || entity.company;
    }
  };

  const getEntityCompany = () => {
    return entity.company;
  };

  const getEntityDetails = () => {
    if (isContact(entity)) {
      return {
        title: entity.title,
        industry: entity.industry,
        interestLevel: entity.interestLevel,
        status: entity.status
      };
    } else {
      return {
        stage: entity.stage,
        value: entity.value,
        probability: entity.probability,
        priority: entity.priority
      };
    }
  };

  const handleObjection = async () => {
    if (!objectionInput.trim()) return;
    
    setIsHandlingObjection(true);
    
    try {
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const entityName = getEntityName();
      const entityCompany = getEntityCompany();
      const details = getEntityDetails();
      
      let response = `Here's how to handle "${objectionInput}":\n\n`;
      
      response += `🎯 ACKNOWLEDGE: "I understand that ${objectionInput.toLowerCase()} is a key consideration for ${entityCompany}."\n\n`;
      
      response += `💡 REFRAME: "Let me show you how this investment typically pays for itself within 3-6 months through `;
      
      if (isContact(entity)) {
        response += `[specific benefit relevant to their role as ${entity.title}]."\n\n`;
        response += `📊 PROVIDE VALUE: "Companies similar to yours in ${entity.industry || 'your industry'} typically see:\n`;
      } else {
        response += `[specific benefit relevant to this ${entity.stage} stage deal]."\n\n`;
        response += `📊 PROVIDE VALUE: "Deals of similar size (${formatCurrency(entity.value)}) typically see:\n`;
      }
      
      response += `- 25% reduction in operational costs\n`;
      response += `- 40% improvement in efficiency\n`;
      response += `- ROI within the first quarter"\n\n`;
      
      response += `🤝 NEXT STEP: "Would it be helpful if I prepared a custom ROI analysis based on your specific situation?"`;
      
      setObjectionResponse(response);
    } catch (error) {
      console.error('Failed to handle objection:', error);
      setObjectionResponse('Failed to generate objection response. Please try again.');
    } finally {
      setIsHandlingObjection(false);
    }
  };

  const generateCoaching = async () => {
    setIsLoadingCoaching(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const entityName = getEntityName();
      const entityCompany = getEntityCompany();
      const details = getEntityDetails();
      
      const coaching: CoachingData = {
        situationalAdvice: '',
        keyStrategies: [],
        nextMeeting: {
          agenda: [],
          talking_points: [],
          avoid: []
        },
        riskMitigation: []
      };
      
      if (isContact(entity)) {
        // Contact-specific coaching
        coaching.situationalAdvice = `For a ${entity.interestLevel} interest ${entity.status} like ${entityName}, focus on ${
          entity.interestLevel === 'hot' ? 'immediate action and closing' :
          entity.interestLevel === 'medium' ? 'building value and urgency' :
          'education and relationship building'
        }.`;
        
        coaching.keyStrategies = [
          `Tailor messaging to ${entity.title} role responsibilities`,
          `Leverage ${entity.industry || 'industry'} specific examples`,
          entity.interestLevel === 'hot' ? 'Create urgency with time-sensitive offers' : 'Focus on value demonstration',
          'Build trust through credible references'
        ];
        
        coaching.nextMeeting.agenda = [
          'Review business objectives and pain points',
          'Present tailored solution overview',
          'Discuss implementation timeline'
        ];
        
        coaching.nextMeeting.talking_points = [
          `ROI specific to ${entity.title} role`,
          'Success stories from similar companies',
          'Implementation support process'
        ];
        
        coaching.nextMeeting.avoid = [
          'Generic feature presentations',
          'Overly technical details',
          'Pushy closing attempts'
        ];
        
        coaching.riskMitigation = [
          'Identify all decision makers involved',
          'Address budget and timeline concerns early',
          'Prepare competitive differentiation materials'
        ];
      } else {
        // Deal-specific coaching
        coaching.situationalAdvice = `For a ${entity.stage} stage deal worth ${formatCurrency(entity.value)}, focus on ${
          entity.stage === 'qualification' ? 'thorough discovery and requirement gathering' :
          entity.stage === 'proposal' ? 'value demonstration and objection handling' :
          entity.stage === 'negotiation' ? 'closing activities and contract finalization' :
          'maintaining relationship and expansion opportunities'
        }.`;
        
        coaching.keyStrategies = [
          'Emphasize competitive advantages',
          entity.probability < 70 ? 'Increase engagement frequency' : 'Maintain momentum',
          'Address stakeholder concerns proactively',
          'Create compelling business case'
        ];
        
        coaching.nextMeeting.agenda = [
          entity.stage === 'qualification' ? 'Deep-dive discovery session' :
          entity.stage === 'proposal' ? 'Proposal walkthrough' :
          'Contract terms discussion',
          'Address remaining concerns',
          'Define next steps and timeline'
        ];
        
        coaching.nextMeeting.talking_points = [
          'Value proposition alignment',
          'ROI demonstration',
          'Implementation support',
          'Success metrics and outcomes'
        ];
        
        coaching.nextMeeting.avoid = [
          'Overwhelming with features',
          'Aggressive closing tactics',
          'Unrealistic timeline promises'
        ];
        
        coaching.riskMitigation = [
          entity.probability < 50 ? 'Re-qualify opportunity and budget' : 'Maintain stakeholder engagement',
          'Prepare for competitive comparison',
          'Document all requirements clearly'
        ];
      }
      
      setCoachingData(coaching);
    } catch (error) {
      console.error('Failed to generate coaching:', error);
    } finally {
      setIsLoadingCoaching(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const clearObjectionResponse = () => {
    setObjectionResponse('');
    setObjectionInput('');
  };

  const togglePanel = () => {
    const newVisibility = !showCoachingPanel;
    setShowCoachingPanel(newVisibility);
    if (onToggleVisibility) {
      onToggleVisibility();
    }
    
    // Generate coaching data when panel is opened
    if (newVisibility && !coachingData) {
      generateCoaching();
    }
  };

  return (
    <div className="space-y-4">
      {/* Toggle Button */}
      <div className="flex justify-center">
        <button
          onClick={togglePanel}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors font-medium shadow-sm"
        >
          <Brain className="w-4 h-4" />
          <span>AI Sales Coach</span>
          {showCoachingPanel ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Coaching Panel */}
      {showCoachingPanel && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-indigo-900 flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {entityType === 'contact' ? 'Contact' : 'Deal'} Sales Coaching
            </h5>
            <button
              onClick={() => setShowCoachingPanel(false)}
              className="text-indigo-600 hover:text-indigo-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Objection Handler */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-indigo-700 mb-1">
                Handle Objection or Concern
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={objectionInput}
                  onChange={(e) => setObjectionInput(e.target.value)}
                  placeholder="e.g., 'Not in our budget right now'"
                  className="flex-1 px-2 py-1 border border-indigo-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleObjection();
                    }
                  }}
                />
                <button
                  onClick={handleObjection}
                  disabled={!objectionInput.trim() || isHandlingObjection}
                  className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  {isHandlingObjection ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Brain className="w-3 h-3" />
                  )}
                  <span>{isHandlingObjection ? 'Coaching...' : 'Coach'}</span>
                </button>
              </div>
            </div>
            
            {/* AI Response Display */}
            {objectionResponse && (
              <div className="p-3 bg-white rounded border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <h6 className="text-xs font-medium text-indigo-900 flex items-center">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Coach Response:
                  </h6>
                  <button
                    onClick={clearObjectionResponse}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Clear Response
                  </button>
                </div>
                <div className="text-xs text-indigo-800 whitespace-pre-line">
                  {objectionResponse}
                </div>
              </div>
            )}
            
            {/* Quick Coaching Tips */}
            <div className="p-2 bg-white rounded border border-indigo-200">
              <h6 className="text-xs font-medium text-indigo-900 mb-1">💡 Quick Tips for {getEntityName()}:</h6>
              <ul className="text-xs text-indigo-700 space-y-0.5">
                {isContact(entity) ? (
                  <>
                    <li>• {entity.title.toLowerCase().includes('ceo') ? 'Focus on business impact and ROI' : 
                           entity.title.toLowerCase().includes('technical') ? 'Emphasize technical benefits and integration' : 
                           'Highlight efficiency gains and team benefits'}</li>
                    <li>• Their {entity.interestLevel} interest level suggests {entity.interestLevel === 'hot' ? 'immediate follow-up' : 'nurturing approach'}</li>
                    <li>• Industry: {entity.industry || 'Unknown'} - tailor examples accordingly</li>
                  </>
                ) : (
                  <>
                    <li>• Deal stage: {entity.stage} - focus on {
                      entity.stage === 'qualification' ? 'discovery and requirements' :
                      entity.stage === 'proposal' ? 'value demonstration' :
                      entity.stage === 'negotiation' ? 'closing activities' :
                      'relationship maintenance'
                    }</li>
                    <li>• {entity.probability}% probability suggests {entity.probability >= 70 ? 'high priority closing focus' : 'continued nurturing needed'}</li>
                    <li>• Value: {formatCurrency(entity.value)} - {entity.value >= 50000 ? 'high-value deal requiring executive involvement' : 'standard deal process'}</li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Comprehensive Coaching Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h6 className="text-sm font-medium text-indigo-900">Comprehensive Sales Coaching</h6>
              <button
                onClick={generateCoaching}
                disabled={isLoadingCoaching}
                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingCoaching ? 'animate-spin' : ''}`} />
                {isLoadingCoaching ? 'Loading...' : 'Generate Coaching'}
              </button>
            </div>

            {isLoadingCoaching ? (
              <div className="text-center py-6">
                <Loader2 className="w-6 h-6 text-indigo-600 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-gray-600">AI Coach analyzing {entityType} context...</p>
              </div>
            ) : coachingData ? (
              <div className="space-y-4">
                {/* Situational Advice */}
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h5 className="text-sm font-medium text-indigo-900 mb-2 flex items-center">
                    <Lightbulb className="w-4 h-4 mr-1" />
                    Situational Advice
                  </h5>
                  <p className="text-sm text-indigo-800">{coachingData.situationalAdvice}</p>
                </div>

                {/* Key Strategies */}
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <h5 className="text-sm font-medium text-green-900 mb-2">Key Strategies</h5>
                  <div className="space-y-1">
                    {coachingData.keyStrategies.map((strategy, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-600 mt-1" />
                        <p className="text-sm text-green-800">{strategy}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Meeting Preparation */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Next Meeting Prep
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="font-medium text-blue-800 mb-1">Agenda</p>
                      {coachingData.nextMeeting.agenda.map((item, index) => (
                        <p key={index} className="text-blue-700">• {item}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium text-blue-800 mb-1">Talking Points</p>
                      {coachingData.nextMeeting.talking_points.map((point, index) => (
                        <p key={index} className="text-blue-700">• {point}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium text-red-800 mb-1">Avoid</p>
                      {coachingData.nextMeeting.avoid.map((item, index) => (
                        <p key={index} className="text-red-700">• {item}</p>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Risk Mitigation */}
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h5 className="text-sm font-medium text-yellow-900 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Risk Mitigation
                  </h5>
                  <div className="space-y-1">
                    {coachingData.riskMitigation.map((action, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Target className="w-3 h-3 text-yellow-600 mt-1" />
                        <p className="text-sm text-yellow-800">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Brain className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Click "Generate Coaching" for AI-powered sales advice</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AICoachingPanel;