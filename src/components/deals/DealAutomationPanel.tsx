import React, { useState } from 'react';
import { Deal } from '../../types';
import { 
  Zap, 
  Mail, 
  Plus, 
  Settings, 
  Clock, 
  Calendar, 
  Play,
  Pause,
  Check,
  Edit,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Info,
  PlusCircle,
  Copy,
  Eye,
  ArrowRight,
  SlidersHorizontal,
  Brain,
  Target,
  DollarSign,
  Building2,
  FileText,
  User,
  X,
  RefreshCw,
  Sparkles,
  Phone,
  Briefcase
} from 'lucide-react';

interface DealAutomationPanelProps {
  deal: Deal;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  type: 'drip' | 'event' | 'date' | 'ai';
  status: 'active' | 'paused' | 'completed' | 'draft';
  progress?: number;
  steps: {
    id: string;
    type: 'email' | 'call' | 'task' | 'ai' | 'delay';
    name: string;
    details: string;
    status: 'pending' | 'active' | 'completed' | 'failed';
    scheduledAt?: Date;
    completedAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

export const DealAutomationPanel: React.FC<DealAutomationPanelProps> = ({ deal }) => {
  const [activeAutomations, setActiveAutomations] = useState<Automation[]>([
    {
      id: '1',
      name: 'Deal Progression Sequence',
      description: 'Automated sequence to move deal through pipeline stages',
      type: 'drip',
      status: 'active',
      progress: 60,
      steps: [
        {
          id: 's1',
          type: 'email',
          name: 'Proposal Follow-up',
          details: 'Send follow-up email asking for feedback on proposal',
          status: 'completed',
          scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        },
        {
          id: 's2',
          type: 'delay',
          name: 'Wait 3 Days',
          details: 'Wait 3 days before next step',
          status: 'completed',
          scheduledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
        },
        {
          id: 's3',
          type: 'task',
          name: 'Call to Discuss Proposal',
          details: 'Schedule call to discuss proposal and address questions',
          status: 'completed',
          scheduledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
        },
        {
          id: 's4',
          type: 'delay',
          name: 'Wait 5 Days',
          details: 'Wait 5 days before next step',
          status: 'active',
          scheduledAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
        },
        {
          id: 's5',
          type: 'email',
          name: 'Contract Draft',
          details: 'Send contract draft for review',
          status: 'pending',
          scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        }
      ],
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastRun: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    }
  ]);
  
  const [availableAutomations, setAvailableAutomations] = useState<Automation[]>([
    {
      id: '2',
      name: 'Negotiation Accelerator',
      description: 'Sequence to move deal through negotiation and close faster',
      type: 'drip',
      status: 'draft',
      steps: [
        {
          id: 's1',
          type: 'email',
          name: 'Negotiation Summary',
          details: 'Send email summarizing negotiation points',
          status: 'pending'
        },
        {
          id: 's2',
          type: 'task',
          name: 'Schedule Decision Call',
          details: 'Set up final decision call with stakeholders',
          status: 'pending'
        }
      ],
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    },
    {
      id: '3',
      name: 'Deal Risk Mitigation',
      description: 'AI-driven sequence to identify and address deal risks',
      type: 'ai',
      status: 'draft',
      steps: [
        {
          id: 's1',
          type: 'ai',
          name: 'Risk Analysis',
          details: 'AI analyzes deal for potential risks',
          status: 'pending'
        },
        {
          id: 's2',
          type: 'email',
          name: 'Risk Mitigation Plan',
          details: 'Send personalized risk mitigation strategy',
          status: 'pending'
        }
      ],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    }
  ]);
  
  const [expandedAutomations, setExpandedAutomations] = useState<string[]>(['1']);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedAutomations(prev => 
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };
  
  const activateAutomation = (id: string) => {
    // Move from available to active
    const automation = availableAutomations.find(a => a.id === id);
    if (automation) {
      const updated = { ...automation, status: 'active' as const };
      setAvailableAutomations(prev => prev.filter(a => a.id !== id));
      setActiveAutomations(prev => [...prev, updated]);
    }
  };
  
  const pauseAutomation = (id: string) => {
    setActiveAutomations(prev => 
      prev.map(a => a.id === id ? { ...a, status: 'paused' as const } : a)
    );
  };
  
  const resumeAutomation = (id: string) => {
    setActiveAutomations(prev => 
      prev.map(a => a.id === id ? { ...a, status: 'active' as const } : a)
    );
  };
  
  const deleteAutomation = (id: string) => {
    setActiveAutomations(prev => prev.filter(a => a.id !== id));
    setAvailableAutomations(prev => prev.filter(a => a.id !== id));
  };
  
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'call': return Phone;
      case 'task': return Check;
      case 'delay': return Clock;
      case 'ai': return Brain;
      default: return Mail;
    }
  };
  
  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'active': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };
  
  const getAutomationTypeIcon = (type: string) => {
    switch (type) {
      case 'drip': return Mail;
      case 'event': return Zap;
      case 'date': return Calendar;
      case 'ai': return Brain;
      default: return Mail;
    }
  };
  
  const getAutomationStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return Play;
      case 'paused': return Pause;
      case 'completed': return Check;
      case 'draft': return Edit;
      default: return Play;
    }
  };
  
  const getAutomationTypeColor = (type: string) => {
    switch (type) {
      case 'drip': return 'text-blue-600';
      case 'event': return 'text-purple-600';
      case 'date': return 'text-yellow-600';
      case 'ai': return 'text-indigo-600';
      default: return 'text-blue-600';
    }
  };
  
  const getAutomationStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'paused': return 'text-yellow-600';
      case 'completed': return 'text-blue-600';
      case 'draft': return 'text-gray-600';
      default: return 'text-green-600';
    }
  };
  
  const getAutomationTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'drip': return 'bg-blue-100 text-blue-800';
      case 'event': return 'bg-purple-100 text-purple-800';
      case 'date': return 'bg-yellow-100 text-yellow-800';
      case 'ai': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getAutomationStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const handleGenerateAutomation = () => {
    handleGenerateAutomationWithAI();
  };

  const handleGenerateAutomationWithAI = async () => {
    setAiGenerating(true);
    
    try {
      // Call the automation-builder edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/automation-builder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          dealData: {
            title: deal.title,
            company: deal.company,
            contact: deal.contact,
            value: deal.value,
            stage: deal.stage,
            probability: deal.probability,
            priority: deal.priority,
            dueDate: deal.dueDate,
            notes: deal.notes
          },
          automationGoal: 'Move to next stage',
          sequenceLength: 'Medium (5-7 steps)',
          communicationStyle: 'Consultative',
          taskType: 'generate-automation'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Automation generation failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract automation from AI response
      let automation;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        automation = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        automation = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format from AI service');
      }

      // Transform AI-generated automation to our format
      const newAutomation: Automation = {
        id: Date.now().toString(),
        name: automation.name || `${deal.title} AI Sequence`,
        description: automation.description || 'AI-generated automation sequence',
        type: 'ai',
        status: 'draft',
        steps: automation.steps.map((step: any, index: number) => ({
          id: `s${Date.now()}-${index + 1}`,
          type: step.type,
          name: step.name,
          details: step.details,
          status: 'pending' as const,
          scheduledAt: step.waitDays ? new Date(Date.now() + step.waitDays * 24 * 60 * 60 * 1000) : undefined
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setAvailableAutomations(prev => [...prev, newAutomation]);
      setShowAIBuilder(false);
      
    } catch (error) {
      console.error('❌ AI automation generation failed:', error);
      
      // Fallback to the original simulation
      const fallbackAutomation: Automation = {
        id: Date.now().toString(),
        name: `${deal.title} Fallback Sequence`,
        description: 'Fallback automation sequence (AI generation failed)',
        type: 'ai',
        status: 'draft',
        steps: [
          {
            id: `s${Date.now()}-1`,
            type: 'email',
            name: 'Follow-up Email',
            details: `Follow-up email for ${deal.company}`,
            status: 'pending'
          },
          {
            id: `s${Date.now()}-2`,
            type: 'delay',
            name: 'Wait 3 Days',
            details: 'Wait 3 days before next step',
            status: 'pending'
          },
          {
            id: `s${Date.now()}-3`,
            type: 'task',
            name: 'Schedule Call',
            details: 'Schedule follow-up call',
            status: 'pending'
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setAvailableAutomations(prev => [...prev, fallbackAutomation]);
      setShowAIBuilder(false);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-purple-600" />
          Deal Automations
        </h3>
        <div>
          <button 
            onClick={() => setIsCreatingNew(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            New Automation
          </button>
        </div>
      </div>
      
      {/* AI-Powered Automation Builder */}
      <div className="mb-6">
        <button 
          onClick={() => setShowAIBuilder(!showAIBuilder)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-colors shadow-md"
        >
          <div className="flex items-center">
            <div className="p-2 bg-white/20 rounded-lg mr-3">
              <Brain className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="font-semibold text-white">AI Automation Builder</h4>
              <p className="text-white/80 text-sm">Generate deal-specific automation sequence with AI</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 transition-transform ${showAIBuilder ? 'rotate-180' : ''}`} />
        </button>
        
        {showAIBuilder && (
          <div className="mt-3 p-6 bg-white rounded-xl border border-purple-200 shadow-sm">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Generate Deal-Specific Automation</h4>
            
            {aiGenerating ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <h5 className="text-lg font-medium text-gray-900 mb-2">AI is generating your automation...</h5>
                <p className="text-gray-600 max-w-md mx-auto">
                  Creating a personalized sequence based on {deal.title}'s profile, stage, and probability.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Automation Goal
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option>Move to Next Stage</option>
                      <option>Accelerate Closing</option>
                      <option>Overcome Objections</option>
                      <option>Increase Deal Value</option>
                      <option>Nurture Relationship</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deal Information to Include
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" id="include-stage" />
                        <label htmlFor="include-stage" className="ml-2 text-sm text-gray-700">
                          Stage: {deal.stage}
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" id="include-value" />
                        <label htmlFor="include-value" className="ml-2 text-sm text-gray-700">
                          Value: ${deal.value.toLocaleString()}
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" id="include-probability" />
                        <label htmlFor="include-probability" className="ml-2 text-sm text-gray-700">
                          Probability: {deal.probability}%
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input type="checkbox" className="h-4 w-4 text-blue-600 rounded" id="include-company" />
                        <label htmlFor="include-company" className="ml-2 text-sm text-gray-700">
                          Company: {deal.company}
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sequence Length
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option>Short (3-4 steps)</option>
                      <option>Medium (5-7 steps)</option>
                      <option>Long (8+ steps)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Communication Style
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option>Consultative</option>
                      <option>Direct</option>
                      <option>Educational</option>
                      <option>Value-Focused</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button 
                    onClick={() => setShowAIBuilder(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGenerateAutomation}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-colors text-sm font-medium flex items-center"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Generate with AI
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Active Automations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-medium text-gray-900">Active Automations</h4>
          <span className="text-sm text-gray-500">{activeAutomations.length} active</span>
        </div>
        
        {activeAutomations.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
            <Zap className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <h5 className="text-lg font-medium text-gray-700 mb-2">No Active Automations</h5>
            <p className="text-gray-500 text-sm mb-4">
              Start automating your deal progression
            </p>
            <button 
              onClick={() => setIsCreatingNew(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Automation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAutomations.map(automation => (
              <div key={automation.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Automation Header */}
                <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${automation.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {React.createElement(getAutomationTypeIcon(automation.type), { 
                          className: `w-5 h-5 ${getAutomationTypeColor(automation.type)}` 
                        })}
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h5 className="text-base font-medium text-gray-900">{automation.name}</h5>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getAutomationStatusBadgeColor(automation.status)}`}>
                            {automation.status.charAt(0).toUpperCase() + automation.status.slice(1)}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getAutomationTypeBadgeColor(automation.type)}`}>
                            {automation.type === 'drip' ? 'Sequence' : 
                             automation.type === 'event' ? 'Event-Based' : 
                             automation.type === 'date' ? 'Date-Based' : 'AI-Powered'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{automation.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {automation.status === 'active' ? (
                        <button 
                          onClick={() => pauseAutomation(automation.id)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="Pause Automation"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : automation.status === 'paused' ? (
                        <button 
                          onClick={() => resumeAutomation(automation.id)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="Resume Automation"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      ) : null}
                      
                      <button 
                        onClick={() => toggleExpand(automation.id)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      >
                        {expandedAutomations.includes(automation.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      
                      <button 
                        onClick={() => deleteAutomation(automation.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Automation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress Bar (if applicable) */}
                  {automation.progress !== undefined && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{automation.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${automation.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Expanded Steps */}
                {expandedAutomations.includes(automation.id) && (
                  <div className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h6 className="text-sm font-medium text-gray-700">Automation Steps</h6>
                      <button className="text-xs text-blue-600 hover:text-blue-800">
                        Edit Steps
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {automation.steps.map((step, index) => {
                        const StepIcon = getStepIcon(step.type);
                        
                        return (
                          <div key={step.id} className="flex items-start relative">
                            {/* Connector line between steps */}
                            {index < automation.steps.length - 1 && (
                              <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200"></div>
                            )}
                            
                            <div className={`relative flex-shrink-0 w-8 h-8 rounded-full border-2 ${
                              step.status === 'completed' ? 'border-green-500 bg-green-100' :
                              step.status === 'active' ? 'border-blue-500 bg-blue-100' :
                              step.status === 'failed' ? 'border-red-500 bg-red-100' :
                              'border-gray-300 bg-gray-100'
                            } flex items-center justify-center mr-4`}>
                              <StepIcon className={`w-4 h-4 ${getStepStatusColor(step.status)}`} />
                            </div>
                            
                            <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-3">
                              <div className="flex justify-between">
                                <h6 className="text-sm font-medium text-gray-900">{step.name}</h6>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  step.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  step.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                  step.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{step.details}</p>
                              
                              {step.scheduledAt && (
                                <div className="flex items-center mt-2 text-xs text-gray-500">
                                  <Clock className="w-3 h-3 mr-1" />
                                  <span>
                                    {step.status === 'completed' ? 'Completed' : 'Scheduled'} on {step.scheduledAt.toLocaleDateString()}
                                    {step.status === 'completed' && step.completedAt && ` at ${step.completedAt.toLocaleTimeString()}`}
                                  </span>
                                </div>
                              )}
                              
                              {/* Step Actions */}
                              {step.status === 'active' && (
                                <div className="mt-2 flex space-x-2">
                                  <button className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                    Mark Complete
                                  </button>
                                  <button className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                                    Reschedule
                                  </button>
                                </div>
                              )}
                              
                              {step.status === 'pending' && (
                                <button className="mt-2 text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                  View Details
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {automation.nextRun && (
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-500" />
                            Next: {automation.nextRun.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button className="text-sm text-blue-600 hover:text-blue-800">
                        View Full Automation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Available Automations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-medium text-gray-900">Recommended Automations</h4>
          <span className="text-sm text-gray-500">{availableAutomations.length} available</span>
        </div>
        
        {availableAutomations.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-gray-500 text-sm">No recommended automations</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {availableAutomations.map(automation => (
              <div key={automation.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    {React.createElement(getAutomationTypeIcon(automation.type), { 
                      className: `w-5 h-5 ${getAutomationTypeColor(automation.type)}` 
                    })}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h5 className="text-base font-medium text-gray-900 truncate">{automation.name}</h5>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getAutomationTypeBadgeColor(automation.type)}`}>
                        {automation.type === 'drip' ? 'Sequence' : 
                         automation.type === 'event' ? 'Event-Based' : 
                         automation.type === 'date' ? 'Date-Based' : 'AI-Powered'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{automation.description}</p>
                    
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        <span>{automation.steps.length} steps</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleExpand(automation.id)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => activateAutomation(automation.id)}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        >
                          Activate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Expanded Preview */}
                {expandedAutomations.includes(automation.id) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h6 className="text-xs font-medium text-gray-700 uppercase mb-2">Steps Preview</h6>
                    <div className="space-y-2">
                      {automation.steps.map((step, index) => {
                        const StepIcon = getStepIcon(step.type);
                        
                        return (
                          <div key={step.id} className="flex items-center space-x-2">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                              <StepIcon className="w-3 h-3 text-gray-600" />
                            </div>
                            <span className="text-xs text-gray-700">{step.name}</span>
                            {index < automation.steps.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Create New Automation Modal */}
      {isCreatingNew && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl font-semibold text-gray-900">Create New Automation</h4>
              <button 
                onClick={() => setIsCreatingNew(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Basic Info */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Automation Name
                </label>
                <input 
                  type="text" 
                  placeholder="e.g., Closing Sequence"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Describe the purpose of this automation"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Automation Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex flex-col items-center border border-blue-500 bg-blue-50 rounded-lg p-3 hover:bg-blue-100 transition-colors">
                    <Mail className="h-6 w-6 text-blue-600 mb-2" />
                    <span className="text-sm font-medium text-blue-600">Drip Sequence</span>
                  </button>
                  <button className="flex flex-col items-center border border-gray-300 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <Calendar className="h-6 w-6 text-yellow-600 mb-2" />
                    <span className="text-sm font-medium text-gray-700">Stage-Based</span>
                  </button>
                  <button className="flex flex-col items-center border border-gray-300 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <Target className="h-6 w-6 text-red-600 mb-2" />
                    <span className="text-sm font-medium text-gray-700">Event-Based</span>
                  </button>
                  <button className="flex flex-col items-center border border-gray-300 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <Brain className="h-6 w-6 text-indigo-600 mb-2" />
                    <span className="text-sm font-medium text-gray-700">AI-Powered</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Steps Builder */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-base font-medium text-gray-900">Automation Steps</h5>
                <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Add Step
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 bg-blue-100 rounded">
                        <Mail className="w-4 h-4 text-blue-600" />
                      </div>
                      <h6 className="text-sm font-medium text-gray-900">Value Proposition Email</h6>
                    </div>
                    <div className="flex space-x-1">
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Send email with personalized value proposition</p>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 bg-gray-200 rounded">
                        <Clock className="w-4 h-4 text-gray-600" />
                      </div>
                      <h6 className="text-sm font-medium text-gray-900">Wait 3 Days</h6>
                    </div>
                    <div className="flex space-x-1">
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Wait 3 days before next action</p>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 bg-blue-100 rounded">
                        <Phone className="w-4 h-4 text-blue-600" />
                      </div>
                      <h6 className="text-sm font-medium text-gray-900">Follow-up Call</h6>
                    </div>
                    <div className="flex space-x-1">
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">Schedule follow-up call to discuss next steps</p>
                </div>
                
                <button className="w-full border border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Another Step
                </button>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setIsCreatingNew(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // Handle save
                  setIsCreatingNew(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Save Automation
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Settings & Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-medium text-gray-900 flex items-center">
            <Settings className="w-4 h-4 mr-2 text-gray-600" />
            Automation Settings & Metrics
          </h4>
          <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center">
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            Configure
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <h5 className="text-sm font-medium text-gray-700 mb-1">Active Sequences</h5>
            <p className="text-2xl font-bold text-gray-900">{activeAutomations.length}</p>
            <p className="text-xs text-gray-500 mt-1">Running automations</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <h5 className="text-sm font-medium text-gray-700 mb-1">Steps Completed</h5>
            <p className="text-2xl font-bold text-gray-900">
              {activeAutomations.reduce((sum, a) => 
                sum + a.steps.filter(s => s.status === 'completed').length, 0
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">Completed automation steps</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <h5 className="text-sm font-medium text-gray-700 mb-1">Next Scheduled</h5>
            <p className="text-2xl font-bold text-gray-900">
              {activeAutomations[0]?.nextRun 
                ? activeAutomations[0].nextRun.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
                : 'None'
              }
            </p>
            <p className="text-xs text-gray-500 mt-1">Next automated action</p>
          </div>
        </div>
        
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 flex items-center space-x-3">
          <div className="p-2 rounded-full bg-yellow-100">
            <Info className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h5 className="text-sm font-medium text-yellow-800">Deal Stage Control</h5>
            <p className="text-xs text-yellow-700 mt-1">
              Automations are synchronized with the current deal stage: {deal.stage}.
              Stage changes may trigger or pause certain automation sequences.
            </p>
          </div>
          <button className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-lg text-xs font-medium hover:bg-yellow-300 transition-colors">
            Manage
          </button>
        </div>
      </div>
    </div>
  );
};