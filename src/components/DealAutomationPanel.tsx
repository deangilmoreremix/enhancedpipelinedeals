import React, { useState } from 'react';
import { Deal } from '../types';
import { Zap, Clock, Mail, Phone, Calendar, MessageSquare, CheckCircle, Settings, Play, Pause, RotateCcw } from 'lucide-react';

interface DealAutomationPanelProps {
  deal: Deal;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  status: 'active' | 'inactive' | 'paused';
  lastRun?: Date;
  successCount: number;
}

export const DealAutomationPanel: React.FC<DealAutomationPanelProps> = ({ deal }) => {
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Follow-up Email Sequence',
      description: 'Send automated follow-up emails based on deal stage',
      trigger: 'Deal stage changes',
      action: 'Send email sequence',
      status: 'active',
      lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      successCount: 15
    },
    {
      id: '2',
      name: 'Stale Deal Alert',
      description: 'Notify when deal hasn\'t been updated for 7 days',
      trigger: 'No activity for 7 days',
      action: 'Send notification',
      status: 'active',
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      successCount: 3
    },
    {
      id: '3',
      name: 'High-Value Deal Escalation',
      description: 'Escalate high-value deals to management',
      trigger: 'Deal value > $50K',
      action: 'Create task for manager',
      status: 'active',
      lastRun: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      successCount: 8
    },
    {
      id: '4',
      name: 'Proposal Reminder',
      description: 'Remind sales rep to send proposal after demo',
      trigger: 'Demo completed',
      action: 'Create reminder task',
      status: 'paused',
      successCount: 0
    }
  ]);

  const toggleRuleStatus = (ruleId: string) => {
    setAutomationRules(prev =>
      prev.map(rule =>
        rule.id === ruleId
          ? {
              ...rule,
              status: rule.status === 'active' ? 'paused' : 'active',
              lastRun: rule.status !== 'active' ? new Date() : rule.lastRun
            }
          : rule
      )
    );
  };

  const runRuleManually = (ruleId: string) => {
    setAutomationRules(prev =>
      prev.map(rule =>
        rule.id === ruleId
          ? { ...rule, lastRun: new Date(), successCount: rule.successCount + 1 }
          : rule
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'paused': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'inactive': return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'paused': return Pause;
      case 'inactive': return RotateCcw;
      default: return Settings;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Zap className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
          Deal Automation
        </h3>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
          <Settings className="w-4 h-4 inline mr-2" />
          Create Rule
        </button>
      </div>

      {/* Automation Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {automationRules.filter(r => r.status === 'active').length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Rules</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {automationRules.reduce((sum, rule) => sum + rule.successCount, 0)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Actions Taken</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Mail className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">24</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Emails Sent</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-orange-500 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">6</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tasks Created</p>
            </div>
          </div>
        </div>
      </div>

      {/* Automation Rules */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Automation Rules</h4>

        {automationRules.map((rule) => {
          const StatusIcon = getStatusIcon(rule.status);
          return (
            <div key={rule.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white">{rule.name}</h5>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(rule.status)}`}>
                      <StatusIcon className="w-3 h-3 inline mr-1" />
                      {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                    </span>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 mb-3">{rule.description}</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">Trigger</p>
                      <p className="text-gray-600 dark:text-gray-400">{rule.trigger}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">Action</p>
                      <p className="text-gray-600 dark:text-gray-400">{rule.action}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">Success Rate</p>
                      <p className="text-gray-600 dark:text-gray-400">{rule.successCount} executions</p>
                    </div>
                  </div>

                  {rule.lastRun && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Last run: {rule.lastRun.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => runRuleManually(rule.id)}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="Run manually"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleRuleStatus(rule.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.status === 'active'
                        ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/30'
                        : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/30'
                    }`}
                    title={rule.status === 'active' ? 'Pause rule' : 'Activate rule'}
                  >
                    {rule.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suggested Automations */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
        <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-4">Suggested Automations</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Welcome Email Sequence</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Send automated welcome emails to new contacts</p>
              </div>
            </div>
            <button className="px-3 py-1 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors">
              Enable
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Follow-up Reminders</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Remind sales team of pending follow-ups</p>
              </div>
            </div>
            <button className="px-3 py-1 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors">
              Enable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};