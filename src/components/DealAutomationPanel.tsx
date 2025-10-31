import React, { useState } from 'react';
import { Deal } from '../types';
import { Zap, Clock, Mail, Phone, Calendar, MessageSquare, CheckCircle, Settings, Play, Pause, RotateCcw, Brain, Sparkles, Wand2 } from 'lucide-react';
import { getSupabaseService } from '../services/supabaseService';
import ResearchStatusOverlay from './ui/ResearchStatusOverlay';
import { ModernButton } from './ui/ModernButton';

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

  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [researchStatus, setResearchStatus] = useState<any>(null);

  const supabaseService = getSupabaseService();

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

  const handleGenerateAutomation = async () => {
    setAiGenerating(true);
    setResearchStatus({
      isVisible: true,
      statuses: [{
        id: 'automation-gen',
        stage: 'analyzing',
        message: '🧠 AI is analyzing your deal to create optimal automation...',
        progress: 0,
        timestamp: new Date()
      }]
    });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/deal-automation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          deal: {
            title: deal.title,
            company: deal.company,
            value: deal.value,
            stage: deal.stage,
            probability: deal.probability
          },
          automationGoal: 'Deal progression and nurturing',
          sequenceLength: 'Medium (5-7 steps)',
          communicationStyle: 'Professional consultative'
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
      const newAutomation: AutomationRule = {
        id: Date.now().toString(),
        name: automation.name || `${deal.title} AI Sequence`,
        description: automation.description || 'AI-generated automation sequence for deal progression',
        trigger: automation.trigger || 'Deal stage changes',
        action: automation.action || 'Execute automated sequence',
        status: 'paused',
        successCount: 0,
        lastRun: undefined
      };

      setAutomationRules(prev => [...prev, newAutomation]);
      setShowAIBuilder(false);

      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: 'automation-gen',
          stage: 'complete',
          message: '✅ AI automation generated successfully!',
          progress: 100,
          timestamp: new Date()
        }]
      });

    } catch (error) {
      console.error('Error generating automation:', error);
      setResearchStatus({
        isVisible: true,
        statuses: [{
          id: 'automation-gen',
          stage: 'error',
          message: '❌ Automation generation failed',
          progress: 0,
          timestamp: new Date()
        }]
      });
    } finally {
      setAiGenerating(false);
      setTimeout(() => setResearchStatus(null), 3000);
    }
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
    <>
      {/* Research Status Overlay */}
      {researchStatus && (
        <ResearchStatusOverlay
          isVisible={researchStatus.isVisible}
          statuses={researchStatus.statuses}
          onClose={() => setResearchStatus(null)}
          position="top-right"
          size="md"
        />
      )}

      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Zap className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
          Deal Automation
        </h3>
        <div className="flex space-x-2">
          <ModernButton
            variant="primary"
            size="sm"
            leftIcon={<Brain className="w-4 h-4" />}
            onClick={() => setShowAIBuilder(true)}
          >
            AI Generate
          </ModernButton>
          <ModernButton
            variant="secondary"
            size="sm"
            leftIcon={<Settings className="w-4 h-4" />}
          >
            Create Rule
          </ModernButton>
        </div>
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

      {/* AI Automation Builder */}
      {showAIBuilder && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
          <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-4">AI Automation Builder</h4>

          {aiGenerating ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h5 className="text-lg font-medium text-gray-900 dark:text-white mb-2">AI is generating your automation...</h5>
              <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                Creating a personalized automation sequence for {deal.title} at {deal.company}.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Automation Goal
                  </label>
                  <select className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option>Deal Qualification</option>
                    <option>Proposal Follow-up</option>
                    <option>Negotiation Support</option>
                    <option>Close Acceleration</option>
                    <option>Post-Close Engagement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Deal Information to Include
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" id="include-company" />
                      <label htmlFor="include-company" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Company: {deal.company}
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" id="include-value" />
                      <label htmlFor="include-value" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Deal Value: ${deal.value.toLocaleString()}
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" id="include-stage" />
                      <label htmlFor="include-stage" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Current Stage: {deal.stage}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAIBuilder(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateAutomation}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors flex items-center"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Automation
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Suggested Automations */}
      {!showAIBuilder && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
          <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-4">Suggested Automations</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Proposal Follow-up Sequence</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Automated follow-ups after proposal delivery</p>
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
                  <p className="font-medium text-gray-900 dark:text-white">Negotiation Reminders</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Keep negotiations on track with timely reminders</p>
                </div>
              </div>
              <button className="px-3 py-1 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors">
                Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};