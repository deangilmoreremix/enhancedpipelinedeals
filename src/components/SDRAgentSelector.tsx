import React, { useEffect, useState } from 'react';
import { ModernButton } from './ui/ModernButton';
import { SDR_AGENTS } from '../components/sdr/sdrAgentsConfig';

interface SDRAgent {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

interface SDRAgentSelectorProps {
  contactId?: string;
  pipelineId?: string;
  onAgentSelected?: (agent: SDRAgent) => void;
  selectedAgentId?: string;
}

export function SDRAgentSelector({
  contactId,
  pipelineId,
  onAgentSelected,
  selectedAgentId
}: SDRAgentSelectorProps) {
  const [agents, setAgents] = useState<SDRAgent[]>(SDR_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<SDRAgent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (selectedAgentId) {
      const agent = agents.find(a => a.id === selectedAgentId);
      setSelectedAgent(agent || null);
    }
  }, [selectedAgentId, agents]);

  const filteredAgents = filter === 'all'
    ? agents
    : agents.filter(agent => agent.category.toLowerCase() === filter.toLowerCase());

  const categories = ['all', ...Array.from(new Set(agents.map(a => a.category)))];

  const handleAgentSelect = async (agent: SDRAgent) => {
    setSelectedAgent(agent);
    setIsLoading(true);

    try {
      // Save agent assignment
      const endpoint = contactId ? 'assignContactAgent' : 'assignPipelineAgent';
      const body = contactId
        ? { contact_id: contactId, agent_id: agent.id }
        : { pipeline_id: pipelineId, agent_id: agent.id };

      const response = await fetch(`/.netlify/functions/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        console.log('✅ SDR Agent assigned successfully');
        if (onAgentSelected) {
          onAgentSelected(agent);
        }
      } else {
        console.error('❌ Failed to assign SDR agent');
      }
    } catch (error) {
      console.error('❌ Error assigning SDR agent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Select SDR Agent
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose the AI SDR agent that will handle communications for this {contactId ? 'contact' : 'pipeline'}
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {category === 'all' ? 'All Agents' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {filteredAgents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => handleAgentSelect(agent)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedAgent?.id === agent.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div className="text-blue-600 dark:text-blue-400">
                {agent.icon}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {agent.name}
                </h4>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  {agent.category}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {agent.description}
            </p>
          </div>
        ))}
      </div>

      {/* Selected Agent Summary */}
      {selectedAgent && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="font-semibold text-green-900 dark:text-green-200">
              {selectedAgent.name} Assigned
            </h4>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            This SDR agent will now handle all communications for this {contactId ? 'contact' : 'pipeline'}.
            The agent will use the assigned persona and follow its specialized workflow.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Assigning SDR agent...
          </span>
        </div>
      )}
    </div>
  );
}