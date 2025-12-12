/**
 * Embedded Agent Interface Component
 * Compact, context-aware AI agent integration for detailed views
 */

import React, { useState, useEffect } from 'react';
import {
  Bot,
  MessageCircle,
  X,
  Send,
  Sparkles,
  Brain,
  TrendingUp,
  Users,
  Calendar,
  Target,
  AlertTriangle,
  BarChart3,
  Zap
} from 'lucide-react';
import { getAgentFramework } from '../../services/agentFramework';
import { AIAgent, AgentType } from '../../types/agent';
import { ModernButton } from '../ui/ModernButton';

interface EmbeddedAgentInterfaceProps {
  contextType: 'deal' | 'contact' | 'analytics' | 'pipeline';
  contextData?: any;
  isCompact?: boolean;
  className?: string;
}

interface RecommendedAgent {
  agent: AIAgent;
  relevance: number;
  reason: string;
}

export const EmbeddedAgentInterface: React.FC<EmbeddedAgentInterfaceProps> = ({
  contextType,
  contextData,
  isCompact = true,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [message, setMessage] = useState('');
  const [recommendedAgents, setRecommendedAgents] = useState<RecommendedAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const agentFramework = getAgentFramework();

  useEffect(() => {
    loadRecommendedAgents();
  }, [contextType, contextData]);

  const loadRecommendedAgents = async () => {
    try {
      const allAgents = await agentFramework.listAgents();
      const recommendations = getRecommendedAgents(allAgents, contextType, contextData);
      setRecommendedAgents(recommendations.slice(0, isCompact ? 3 : 6));
    } catch (error) {
      console.error('Failed to load recommended agents:', error);
    }
  };

  const getRecommendedAgents = (agents: AIAgent[], type: string, data?: any): RecommendedAgent[] => {
    const recommendations: RecommendedAgent[] = [];

    agents.forEach(agent => {
      let relevance = 0;
      let reason = '';

      switch (type) {
        case 'deal':
          if (agent.type === AgentType.DEAL_ANALYST) {
            relevance = 95;
            reason = 'Expert deal analysis and insights';
          } else if (agent.type === AgentType.RISK_ASSESSOR) {
            relevance = 90;
            reason = 'Risk assessment for this deal';
          } else if (agent.type === AgentType.COMMUNICATION_MANAGER) {
            relevance = 85;
            reason = 'Deal-specific communication assistance';
          } else if (agent.type === AgentType.SALES_ASSISTANT) {
            relevance = 80;
            reason = 'Sales pipeline optimization';
          }
          break;

        case 'contact':
          if (agent.type === AgentType.CONTACT_INTELLIGENCE) {
            relevance = 95;
            reason = 'Contact relationship insights';
          } else if (agent.type === AgentType.LEAD_QUALIFIER) {
            relevance = 90;
            reason = 'Lead qualification and scoring';
          } else if (agent.type === AgentType.COMMUNICATION_MANAGER) {
            relevance = 85;
            reason = 'Contact communication strategies';
          }
          break;

        case 'analytics':
          if (agent.type === AgentType.ANALYTICS_EXPERT) {
            relevance = 95;
            reason = 'Advanced analytics and reporting';
          } else if (agent.type === AgentType.ACHIEVEMENT_COACH) {
            relevance = 85;
            reason = 'Performance coaching and goals';
          } else if (agent.type === AgentType.RISK_ASSESSOR) {
            relevance = 80;
            reason = 'Risk analysis and trends';
          }
          break;

        case 'pipeline':
          if (agent.type === AgentType.SALES_ASSISTANT) {
            relevance = 95;
            reason = 'Pipeline management and automation';
          } else if (agent.type === AgentType.ANALYTICS_EXPERT) {
            relevance = 90;
            reason = 'Pipeline analytics and forecasting';
          } else if (agent.type === AgentType.CALENDAR_ASSISTANT) {
            relevance = 85;
            reason = 'Meeting and follow-up scheduling';
          }
          break;
      }

      if (relevance > 0) {
        recommendations.push({ agent, relevance, reason });
      }
    });

    return recommendations.sort((a, b) => b.relevance - a.relevance);
  };

  const handleSendMessage = async () => {
    if (!selectedAgent || !message.trim()) return;

    setIsLoading(true);
    try {
      // In a real implementation, this would send the message to the agent
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear message after sending
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAgentIcon = (type: AgentType) => {
    const icons: Record<string, any> = {
      [AgentType.SALES_ASSISTANT]: Target,
      [AgentType.LEAD_QUALIFIER]: Users,
      [AgentType.DEAL_ANALYST]: BarChart3,
      [AgentType.CONTACT_INTELLIGENCE]: Brain,
      [AgentType.COMMUNICATION_MANAGER]: MessageCircle,
      [AgentType.ANALYTICS_EXPERT]: TrendingUp,
      [AgentType.CALENDAR_ASSISTANT]: Calendar,
      [AgentType.RISK_ASSESSOR]: AlertTriangle,
      [AgentType.ACHIEVEMENT_COACH]: Zap
    };
    return icons[type] || Bot;
  };

  if (isCompact) {
    return (
      <div className={`relative ${className}`}>
        {/* Compact Agent Button */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {recommendedAgents.slice(0, 2).map(({ agent }) => {
              const Icon = getAgentIcon(agent.type);
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(agent);
                    setIsOpen(true);
                  }}
                  className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-800/30 dark:hover:to-purple-800/30 rounded-md border border-blue-200 dark:border-blue-700 transition-colors"
                  title={`Chat with ${agent.name}`}
                >
                  <Icon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300 hidden sm:inline">
                    {agent.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          <ModernButton
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="flex items-center space-x-1"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">AI Agents</span>
            <Sparkles className="w-3 h-3 text-purple-500" />
          </ModernButton>
        </div>

        {/* Embedded Chat Modal */}
        {isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedAgent ? selectedAgent.name : 'AI Agents'}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                {!selectedAgent ? (
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Recommended Agents</h4>
                    {recommendedAgents.map(({ agent, reason }) => {
                      const Icon = getAgentIcon(agent.type);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => setSelectedAgent(agent)}
                          className="w-full flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-left"
                        >
                          <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{agent.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{reason}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{selectedAgent.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAgent.description}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder={`Ask ${selectedAgent.name.split(' ')[0]}...`}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <ModernButton
                          onClick={handleSendMessage}
                          disabled={!message.trim() || isLoading}
                          loading={isLoading}
                          className="px-4 py-2"
                        >
                          <Send className="w-4 h-4" />
                        </ModernButton>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedAgent(null)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      ← Back to agents
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full interface for non-compact mode
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900 dark:text-white">AI Agent Assistant</span>
        </div>
        <Sparkles className="w-4 h-4 text-purple-500" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {recommendedAgents.map(({ agent, reason }) => {
          const Icon = getAgentIcon(agent.type);
          return (
            <button
              key={agent.id}
              onClick={() => {
                setSelectedAgent(agent);
                setIsOpen(true);
              }}
              className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-800/30 dark:hover:to-purple-800/30 rounded-lg border border-blue-200 dark:border-blue-700 transition-colors text-left"
            >
              <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{agent.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{reason}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Full Chat Modal */}
      {isOpen && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-900 dark:text-white">{selectedAgent.name}</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{selectedAgent.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedAgent.description}</p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    💡 <strong>Quick suggestions:</strong> Ask me about {contextType} analysis, insights, or next steps.
                  </p>
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={`Ask ${selectedAgent.name.split(' ')[0]} about this ${contextType}...`}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <ModernButton
                    onClick={handleSendMessage}
                    disabled={!message.trim() || isLoading}
                    loading={isLoading}
                    className="px-4 py-2"
                  >
                    <Send className="w-4 h-4" />
                  </ModernButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};