import React from 'react';
import { Brain, Target, AlertTriangle, Mail, Zap } from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';

interface SDRButtonGroupProps {
  relevantAgents: string[];
  onRunSDRAgent: (agentId: string) => void;
  isRunning?: boolean;
}

const SDR_AGENT_CONFIG = {
  'sdr-data-enrichment': {
    label: 'Enrich Contact',
    icon: Brain,
    color: 'purple',
    description: 'AI analyzes and enriches contact data'
  },
  'sdr-competitor-aware': {
    label: 'Competitor SDR',
    icon: Target,
    color: 'blue',
    description: 'Position against competitors'
  },
  'sdr-objection-handling': {
    label: 'Handle Objections',
    icon: AlertTriangle,
    color: 'red',
    description: 'Generate objection responses'
  },
  'sdr-follow-up': {
    label: 'Follow-Up SDR',
    icon: Mail,
    color: 'green',
    description: 'Create follow-up sequences'
  },
  'sdr-high-intent': {
    label: 'High-Intent SDR',
    icon: Zap,
    color: 'orange',
    description: 'Fast-track hot leads'
  }
};

export const SDRButtonGroup: React.FC<SDRButtonGroupProps> = ({
  relevantAgents,
  onRunSDRAgent,
  isRunning = false
}) => {
  if (relevantAgents.length === 0) return null;

  return (
    <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center space-x-1 text-xs font-medium text-blue-700 dark:text-blue-300">
        <Brain className="w-3 h-3" />
        <span>AI SDR:</span>
      </div>
      <div className="flex items-center space-x-1">
        {relevantAgents.slice(0, 3).map((agentId) => {
          const config = SDR_AGENT_CONFIG[agentId as keyof typeof SDR_AGENT_CONFIG];
          if (!config) return null;

          const Icon = config.icon;

          return (
            <ModernButton
              key={agentId}
              variant="outline"
              size="xs"
              onClick={() => onRunSDRAgent(agentId)}
              disabled={isRunning}
              className="flex items-center space-x-1 h-7 px-2 text-xs"
              title={config.description}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{config.label}</span>
            </ModernButton>
          );
        })}
        {relevantAgents.length > 3 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            +{relevantAgents.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
};