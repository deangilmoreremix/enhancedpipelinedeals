/**
 * Agent Management Dashboard Component
 * Comprehensive interface for managing AI agents
 */

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  Settings,
  Activity,
  MessageCircle,
  TrendingUp,
  Users,
  Zap,
  Play,
  Pause,
  Trash2,
  Edit,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { getAgentFramework } from '../../services/agentFramework';
import { AIAgent, AgentType, AgentStatus } from '../../types/agent';
import { AgentChatInterface } from './AgentChatInterface';

export const AgentManagementDashboard: React.FC = () => {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<AgentType | 'all'>('all');

  const agentFramework = getAgentFramework();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const agentList = await agentFramework.listAgents();
      setAgents(agentList);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAgents = filter === 'all'
    ? agents
    : agents.filter(agent => agent.type === filter);

  const getAgentTypeColor = (type: AgentType) => {
    const colors = {
      [AgentType.SALES_ASSISTANT]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      [AgentType.LEAD_QUALIFIER]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      [AgentType.CUSTOMER_SUCCESS]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      [AgentType.RESEARCH_INTELLIGENCE]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      [AgentType.ADMINISTRATIVE]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    };
    return colors[type] || colors[AgentType.SALES_ASSISTANT];
  };

  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.ACTIVE:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case AgentStatus.INACTIVE:
        return <Pause className="w-4 h-4 text-gray-500" />;
      case AgentStatus.ERROR:
        return <XCircle className="w-4 h-4 text-red-500" />;
      case AgentStatus.LEARNING:
        return <Activity className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const toggleAgentStatus = async (agentId: string, currentStatus: AgentStatus) => {
    const newStatus = currentStatus === AgentStatus.ACTIVE ? AgentStatus.INACTIVE : AgentStatus.ACTIVE;

    try {
      await agentFramework.updateAgent(agentId, { status: newStatus });
      await loadAgents();
    } catch (error) {
      console.error('Failed to update agent status:', error);
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      return;
    }

    try {
      await agentFramework.deleteAgent(agentId);
      await loadAgents();
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const getOverallStats = () => {
    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => a.status === AgentStatus.ACTIVE).length;
    const totalInteractions = agents.reduce((sum, a) => sum + a.metrics.totalInteractions, 0);
    const avgSuccessRate = agents.length > 0
      ? agents.reduce((sum, a) => sum + (a.metrics.successfulActions / Math.max(a.metrics.totalInteractions, 1)), 0) / agents.length
      : 0;

    return {
      totalAgents,
      activeAgents,
      totalInteractions,
      avgSuccessRate: Math.round(avgSuccessRate * 100)
    };
  };

  const stats = getOverallStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading AI agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
              <Bot className="w-8 h-8 mr-3 text-blue-600" />
              AI Agent Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Manage and monitor your AI-powered assistants
            </p>
          </div>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Bot className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalAgents}</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Agents</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeAgents}</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Active Agents</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <MessageCircle className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalInteractions.toLocaleString()}</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Interactions</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-orange-600 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgSuccessRate}%</p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Success Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by type:</span>
          <div className="flex space-x-2">
            {[
              { value: 'all', label: 'All Agents' },
              { value: AgentType.SALES_ASSISTANT, label: 'Sales Assistant' },
              { value: AgentType.LEAD_QUALIFIER, label: 'Lead Qualifier' },
              { value: AgentType.CUSTOMER_SUCCESS, label: 'Customer Success' },
              { value: AgentType.RESEARCH_INTELLIGENCE, label: 'Research' },
              { value: AgentType.ADMINISTRATIVE, label: 'Administrative' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value as AgentType | 'all')}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAgents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            {/* Agent Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon(agent.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAgentTypeColor(agent.type)}`}>
                      {agent.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setChatAgentId(agent.id)}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                  title="Chat with agent"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedAgent(agent)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                  title="View details"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleAgentStatus(agent.id, agent.status)}
                  className={`p-1 rounded ${
                    agent.status === AgentStatus.ACTIVE
                      ? 'text-green-600 hover:text-green-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={agent.status === AgentStatus.ACTIVE ? 'Pause agent' : 'Activate agent'}
                >
                  {agent.status === AgentStatus.ACTIVE ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteAgent(agent.id)}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                  title="Delete agent"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Agent Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
              {agent.description}
            </p>

            {/* Agent Metrics */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {agent.metrics.totalInteractions}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Interactions</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {agent.metrics.averageResponseTime}ms
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Response</p>
              </div>
            </div>

            {/* Capabilities */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Capabilities:</p>
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.slice(0, 3).map((capability, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                  >
                    {capability.name}
                  </span>
                ))}
                {agent.capabilities.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                    +{agent.capabilities.length - 3} more
                  </span>
                )}
              </div>
            </div>

            {/* Last Active */}
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3 mr-1" />
              Last active: {agent.metrics.lastActive.toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No agents found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {filter === 'all'
              ? 'Create your first AI agent to get started.'
              : `No agents of type "${filter}" found.`
            }
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create Agent
          </button>
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedAgent.name}
                </h2>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Agent Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                  <p className="text-gray-600 dark:text-gray-400">{selectedAgent.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Type</h3>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${getAgentTypeColor(selectedAgent.type)}`}>
                      {selectedAgent.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Status</h3>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(selectedAgent.status)}
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {selectedAgent.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {selectedAgent.metrics.totalInteractions}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Interactions</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {selectedAgent.metrics.successfulActions}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Success</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedAgent.metrics.averageResponseTime}ms
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg Response</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.round(selectedAgent.metrics.userSatisfaction * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Satisfaction</p>
                    </div>
                  </div>
                </div>

                {/* Capabilities */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Capabilities</h3>
                  <div className="space-y-2">
                    {selectedAgent.capabilities.map((capability, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{capability.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{capability.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {capability.priority} priority
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {capability.cooldown}min cooldown
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      {chatAgentId && (
        <AgentChatInterface
          agentId={chatAgentId}
          isOpen={!!chatAgentId}
          onClose={() => setChatAgentId(null)}
        />
      )}
    </div>
  );
};