import React, { useState } from 'react';
import {
  Brain, Target, AlertTriangle, Mail, Zap, MessageSquare,
  RotateCcw, Trophy, Linkedin, MessageCircle, Calendar,
  Users, Newspaper, Phone, Settings
} from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';
import { SDRAgentConfigurator } from '../sdr/SDRAgentConfigurator';
import { sdrPreferencesService } from '../../services/sdrPreferencesService';
import { SDRUserPreferences } from '../../types/sdr-config';

interface SDRButtonGroupProps {
  relevantAgents: string[];
  onRunSDRAgent: (agentId: string) => void;
  isRunning?: boolean;
  userId?: string;
}

const SDR_AGENT_CONFIG = {
  // Existing Production Agents
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
  },

  // New Reactivation Agents
  'sdr-bump-message': {
    label: 'Bump Message',
    icon: MessageSquare,
    color: 'cyan',
    description: 'Polite re-engagement for unresponsive prospects'
  },
  'sdr-reactivation': {
    label: 'Reactivation SDR',
    icon: RotateCcw,
    color: 'teal',
    description: 'Re-engage dormant prospects'
  },
  'sdr-winback': {
    label: 'Winback SDR',
    icon: Trophy,
    color: 'amber',
    description: 'Win back lost deals'
  },

  // Networking Agents
  'sdr-linkedin': {
    label: 'LinkedIn SDR',
    icon: Linkedin,
    color: 'blue',
    description: 'LinkedIn outreach follow-ups'
  },
  'sdr-whatsapp': {
    label: 'WhatsApp SDR',
    icon: MessageCircle,
    color: 'green',
    description: 'WhatsApp business messaging'
  },

  // Advanced Agents
  'sdr-event-based': {
    label: 'Event SDR',
    icon: Calendar,
    color: 'indigo',
    description: 'Capitalize on company events'
  },
  'sdr-referral': {
    label: 'Referral SDR',
    icon: Users,
    color: 'pink',
    description: 'Request referrals from satisfied contacts'
  },
  'sdr-newsletter-lead-in': {
    label: 'Newsletter SDR',
    icon: Newspaper,
    color: 'violet',
    description: 'Convert subscribers to prospects'
  },
  'sdr-cold-email': {
    label: 'Cold Email SDR',
    icon: Mail,
    color: 'slate',
    description: 'Personalized cold outreach sequences'
  }
};

export const SDRButtonGroup: React.FC<SDRButtonGroupProps> = ({
  relevantAgents,
  onRunSDRAgent,
  isRunning = false,
  userId = 'user-1' // Default for demo
}) => {
  const [configuringAgent, setConfiguringAgent] = useState<{ id: string; name: string; config?: SDRUserPreferences } | null>(null);

  const handleConfigureAgent = async (agentId: string) => {
    const config = SDR_AGENT_CONFIG[agentId as keyof typeof SDR_AGENT_CONFIG];
    if (!config) return;

    // Load existing user preferences
    const userPrefs = await sdrPreferencesService.getUserPreferences(userId, agentId);

    setConfiguringAgent({
      id: agentId,
      name: config.label,
      config: userPrefs || undefined
    });
  };

  const handleSaveConfiguration = async (preferences: any) => {
    if (!configuringAgent) return;

    await sdrPreferencesService.saveUserPreferences(userId, configuringAgent.id, preferences);
    setConfiguringAgent(null);
  };

  if (relevantAgents.length === 0) return null;

  return (
    <>
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
              <div key={agentId} className="flex items-center space-x-1">
                <ModernButton
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
                <button
                  onClick={() => handleConfigureAgent(agentId)}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                  title={`Configure ${config.label}`}
                >
                  <Settings className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {relevantAgents.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              +{relevantAgents.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Agent Configuration Modal */}
      {configuringAgent && (
        <SDRAgentConfigurator
          agentId={configuringAgent.id}
          agentName={configuringAgent.name}
          currentConfig={configuringAgent.config}
          onSave={handleSaveConfiguration}
          onClose={() => setConfiguringAgent(null)}
          isOpen={true}
        />
      )}
    </>
  );
};