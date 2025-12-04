import React, { useState } from 'react';
import { BookOpen, Plus, Play, Edit, Copy, Trash2, Star, Clock, Users, Target } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';

export const PlaybooksPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'sequences' | 'analytics'>('templates');

  const playbooks = [
    {
      id: 1,
      name: "Enterprise Sales Playbook",
      description: "Complete sequence for enterprise deals over $50K",
      category: "Enterprise",
      steps: 12,
      success: 78,
      lastUsed: "2 days ago",
      starred: true
    },
    {
      id: 2,
      name: "SMB Quick Close",
      description: "Fast-track playbook for small business deals",
      category: "SMB",
      steps: 6,
      success: 85,
      lastUsed: "1 day ago",
      starred: false
    },
    {
      id: 3,
      name: "Product Demo Follow-up",
      description: "Nurture sequence after product demonstrations",
      category: "Nurture",
      steps: 8,
      success: 72,
      lastUsed: "5 hours ago",
      starred: true
    },
    {
      id: 4,
      name: "Competitor Switch Playbook",
      description: "Convert prospects from competitors",
      category: "Competitive",
      steps: 15,
      success: 65,
      lastUsed: "1 week ago",
      starred: false
    }
  ];

  const sequences = [
    {
      id: 1,
      name: "Initial Outreach",
      status: "active",
      deals: 24,
      completion: 89,
      nextStep: "Follow-up Email"
    },
    {
      id: 2,
      name: "Demo Follow-up",
      status: "active",
      deals: 12,
      completion: 67,
      nextStep: "Proposal Review"
    },
    {
      id: 3,
      name: "Contract Negotiation",
      status: "paused",
      deals: 5,
      completion: 40,
      nextStep: "Final Terms"
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            Sales Playbooks
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Automated sales sequences and proven playbooks
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <ModernButton variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
            New Playbook
          </ModernButton>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'templates', label: 'Templates', count: playbooks.length },
          { id: 'sequences', label: 'Active Sequences', count: sequences.length },
          { id: 'analytics', label: 'Analytics' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === tab.id
                ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count && (
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {playbooks.map((playbook) => (
            <div key={playbook.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{playbook.name}</h4>
                    {playbook.starred && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-medium">
                      {playbook.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{playbook.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center">
                      <Target className="w-3 h-3 mr-1" />
                      {playbook.steps} steps
                    </span>
                    <span className="flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      {playbook.success}% success
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {playbook.lastUsed}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <ModernButton variant="ghost" size="sm" leftIcon={<Play className="w-4 h-4" />}>
                    Run
                  </ModernButton>
                  <ModernButton variant="ghost" size="sm" leftIcon={<Edit className="w-4 h-4" />}>
                    Edit
                  </ModernButton>
                  <ModernButton variant="ghost" size="sm" leftIcon={<Copy className="w-4 h-4" />}>
                    Copy
                  </ModernButton>
                </div>
              </div>
            </div>
          ))}

          {/* Create New Playbook Card */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer">
            <Plus className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">Create New Playbook</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Build a custom sales sequence from scratch</p>
          </div>
        </div>
      )}

      {/* Sequences Tab */}
      {activeTab === 'sequences' && (
        <div className="space-y-4">
          {sequences.map((sequence) => (
            <div key={sequence.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{sequence.name}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sequence.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {sequence.status}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {sequence.deals} active deals
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {sequence.completion}% Complete
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Next: {sequence.nextStep}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                <div
                  className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${sequence.completion}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <ModernButton variant="outline" size="sm">
                    View Details
                  </ModernButton>
                  <ModernButton variant="outline" size="sm">
                    Edit Sequence
                  </ModernButton>
                </div>
                <ModernButton
                  variant={sequence.status === 'active' ? 'danger' : 'success'}
                  size="sm"
                >
                  {sequence.status === 'active' ? 'Pause' : 'Resume'}
                </ModernButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Sequences</span>
                <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">12</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">+3 from last week</div>
            </div>

            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Avg. Completion</span>
                <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">73%</div>
              <div className="text-xs text-green-600 dark:text-green-400">+5% from last month</div>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Deals</span>
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">156</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Across all sequences</div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Top Performing Playbooks</h4>
            <div className="space-y-3">
              {playbooks.slice(0, 3).map((playbook, index) => (
                <div key={playbook.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-sm font-medium text-indigo-700 dark:text-indigo-400">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{playbook.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{playbook.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">{playbook.success}%</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">success rate</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};