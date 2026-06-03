import React, { useState, useEffect } from 'react';
import { WorkflowBuilder } from './WorkflowBuilder';
import {
  Workflow,
  WorkflowExecution,
  WorkflowAnalytics,
  EmailTemplate,
  WebhookConfiguration,
  AIAgentConfiguration
} from '../../types/workflow';
import { enhancedWorkflowService } from '../../services/enhancedWorkflowService';
import { isFeatureEnabled } from '../../services/featureFlagService';
import {
  Plus,
  Play,
  Pause,
  Settings,
  BarChart3,
  Mail,
  Globe,
  Bot,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  Copy,
  Eye
} from 'lucide-react';

export const EnhancedWorkflowPanel: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [analytics, setAnalytics] = useState<WorkflowAnalytics | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [webhookConfigs, setWebhookConfigs] = useState<WebhookConfiguration[]>([]);
  const [aiAgentConfigs, setAIAgentConfigs] = useState<AIAgentConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflows' | 'executions' | 'templates' | 'integrations'>('workflows');
  const [showBuilder, setShowBuilder] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    const enabled = await isFeatureEnabled('twenty_workflow_phase5');
    setFeatureEnabled(enabled);

    if (enabled) {
      await loadWorkflows();
      await loadTemplatesAndConfigs();
    }
    setLoading(false);
  };

  const loadWorkflows = async () => {
    const workflowData = await enhancedWorkflowService.getAllWorkflows();
    setWorkflows(workflowData);
  };

  const loadTemplatesAndConfigs = async () => {
    const [templates, webhooks, agents] = await Promise.all([
      enhancedWorkflowService.getEmailTemplates(),
      enhancedWorkflowService.getWebhookConfigs(),
      enhancedWorkflowService.getAIAgentConfigs()
    ]);

    setEmailTemplates(templates);
    setWebhookConfigs(webhooks);
    setAIAgentConfigs(agents);
  };

  const createNewWorkflow = () => {
    const newWorkflow: Workflow = {
      id: '',
      name: 'New Workflow',
      description: '',
      category: 'custom',
      steps: [],
      triggers: [],
      actions: [],
      settings: {
        isActive: false,
        priority: 'medium',
        maxExecutionTime: 3600,
        retryPolicy: { enabled: true, maxRetries: 3, retryDelay: 300 },
        notifications: { onSuccess: false, onFailure: true, onTimeout: true }
      },
      metadata: {
        version: 1,
        lastModified: new Date(),
        createdBy: 'current_user',
        usageCount: 0,
        successRate: 0,
        averageExecutionTime: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setSelectedWorkflow(newWorkflow);
    setShowBuilder(true);
  };

  const saveWorkflow = async () => {
    if (!selectedWorkflow) return;

    let savedWorkflow: Workflow | null;

    if (selectedWorkflow.id) {
      // Update existing
      const success = await enhancedWorkflowService.updateWorkflow(selectedWorkflow.id, selectedWorkflow);
      savedWorkflow = success ? selectedWorkflow : null;
    } else {
      // Create new
      savedWorkflow = await enhancedWorkflowService.createWorkflow(selectedWorkflow);
    }

    if (savedWorkflow) {
      await loadWorkflows();
      setSelectedWorkflow(savedWorkflow);
    }
  };

  const executeWorkflow = async () => {
    if (!selectedWorkflow) return;

    setIsExecuting(true);
    try {
      await enhancedWorkflowService.executeWorkflow(selectedWorkflow.id, {
        userId: 'current_user',
        inputData: {}
      });
      // Refresh executions
      await loadExecutions(selectedWorkflow.id);
    } catch (error) {
      console.error('Error executing workflow:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const loadExecutions = async (workflowId: string) => {
    const executionData = await enhancedWorkflowService.getWorkflowExecutions(workflowId, 20);
    setExecutions(executionData);
  };

  const loadAnalytics = async (workflowId: string) => {
    const analyticsData = await enhancedWorkflowService.getWorkflowAnalytics(workflowId);
    setAnalytics(analyticsData);
  };

  const deleteWorkflow = async (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      const success = await enhancedWorkflowService.deleteWorkflow(workflowId);
      if (success) {
        await loadWorkflows();
        if (selectedWorkflow?.id === workflowId) {
          setSelectedWorkflow(null);
          setShowBuilder(false);
        }
      }
    }
  };

  const toggleWorkflowStatus = async (workflow: Workflow) => {
    const updatedWorkflow = {
      ...workflow,
      settings: {
        ...workflow.settings,
        isActive: !workflow.settings.isActive
      }
    };

    const success = await enhancedWorkflowService.updateWorkflow(workflow.id, updatedWorkflow);
    if (success) {
      await loadWorkflows();
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-4/5"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Workflow Automation</h3>
        <p>Advanced workflow automation features are not yet available.</p>
      </div>
    );
  }

  if (showBuilder && selectedWorkflow) {
    return (
      <div className="h-full">
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedWorkflow.id ? 'Edit Workflow' : 'Create Workflow'}
            </h2>
            <p className="text-sm text-gray-600">{selectedWorkflow.name}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowBuilder(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={saveWorkflow}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save Workflow
            </button>
          </div>
        </div>

        <WorkflowBuilder
          workflow={selectedWorkflow}
          onWorkflowChange={setSelectedWorkflow}
          onSave={saveWorkflow}
          onExecute={executeWorkflow}
          isExecuting={isExecuting}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Workflow Automation</h1>
          <button
            onClick={createNewWorkflow}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-4">
          {[
            { key: 'workflows', label: 'Workflows', count: workflows.length },
            { key: 'executions', label: 'Executions', count: executions.length },
            { key: 'templates', label: 'Templates', count: emailTemplates.length + webhookConfigs.length + aiAgentConfigs.length },
            { key: 'integrations', label: 'Integrations' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === tab.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {activeTab === 'workflows' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map(workflow => (
              <div
                key={workflow.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                    <p className="text-sm text-gray-600">{workflow.description}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    workflow.settings.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {workflow.settings.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Category:</span>
                    <span className="font-medium capitalize">{workflow.category.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Steps:</span>
                    <span className="font-medium">{workflow.steps.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Triggers:</span>
                    <span className="font-medium">{workflow.triggers.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Success Rate:</span>
                    <span className="font-medium">{workflow.metadata.successRate.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedWorkflow(workflow);
                      setShowBuilder(true);
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    <Edit className="w-4 h-4 inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => toggleWorkflowStatus(workflow)}
                    className={`px-3 py-2 text-sm rounded ${
                      workflow.settings.isActive
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {workflow.settings.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteWorkflow(workflow.id)}
                    className="px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {workflows.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Settings className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Workflows Yet</h3>
                <p className="text-gray-600 mb-4">Create your first automated workflow to get started.</p>
                <button
                  onClick={createNewWorkflow}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Create Workflow
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'executions' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Workflow Executions</h3>
              <select
                onChange={(e) => loadExecutions(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">All Workflows</option>
                {workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {executions.map(execution => (
              <div key={execution.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {workflows.find(w => w.id === execution.workflowId)?.name || 'Unknown Workflow'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Trigger: {execution.triggerType} • Started: {execution.startedAt.toLocaleString()}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    execution.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : execution.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : execution.status === 'running'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {execution.status === 'completed' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {execution.status === 'failed' && <XCircle className="w-3 h-3 inline mr-1" />}
                    {execution.status === 'running' && <Clock className="w-3 h-3 inline mr-1" />}
                    {execution.status}
                  </div>
                </div>

                {execution.duration && (
                  <div className="text-sm text-gray-600 mb-2">
                    Duration: {Math.round(execution.duration / 1000)}s
                  </div>
                )}

                {execution.error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    Error: {execution.error.message}
                  </div>
                )}
              </div>
            ))}

            {executions.length === 0 && (
              <div className="text-center py-12">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Executions Yet</h3>
                <p className="text-gray-600">Workflow executions will appear here once workflows are triggered.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-6">
            {/* Email Templates */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Email Templates ({emailTemplates.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {emailTemplates.map(template => (
                  <div key={template.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <p className="text-sm text-gray-500">Subject: {template.subject}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Webhook Configurations */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                Webhook Configurations ({webhookConfigs.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {webhookConfigs.map(config => (
                  <div key={config.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{config.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{config.url}</p>
                    <p className="text-sm text-gray-500">Method: {config.method} • Events: {config.events.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Agent Configurations */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Bot className="w-5 h-5 mr-2" />
                AI Agent Configurations ({aiAgentConfigs.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiAgentConfigs.map(config => (
                  <div key={config.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{config.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{config.description}</p>
                    <p className="text-sm text-gray-500">Model: {config.model} • Tools: {config.tools.length}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Integrations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                  <h4 className="font-medium text-gray-900 mb-2">Email Integration</h4>
                  <p className="text-sm text-gray-600">Send automated emails via connected accounts</p>
                </div>
                <div className="text-center">
                  <Globe className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h4 className="font-medium text-gray-900 mb-2">Webhook Support</h4>
                  <p className="text-sm text-gray-600">Trigger workflows from external systems</p>
                </div>
                <div className="text-center">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                  <h4 className="font-medium text-gray-900 mb-2">AI Agent Integration</h4>
                  <p className="text-sm text-gray-600">Intelligent automation with AI capabilities</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Monitoring</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">SLA Monitoring</h4>
                  <p className="text-sm text-gray-600 mb-3">Track service level agreements and get alerted on breaches</p>
                  <div className="flex items-center text-sm text-gray-600">
                    <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />
                    <span>Active monitoring for critical workflows</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Analytics & Reporting</h4>
                  <p className="text-sm text-gray-600 mb-3">Detailed execution metrics and performance insights</p>
                  <div className="flex items-center text-sm text-gray-600">
                    <BarChart3 className="w-4 h-4 mr-1 text-blue-500" />
                    <span>Real-time dashboards and alerts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};