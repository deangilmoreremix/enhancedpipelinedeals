import React, { useState } from 'react';
import { WorkflowStep, WorkflowAction, ActionType, WorkflowCondition } from '../../types/workflow';
import { Plus, Trash2, Settings, Mail, Code, Globe, Bot, Clock, Filter, RotateCcw, Play } from 'lucide-react';

interface WorkflowStepsBuilderProps {
  steps: WorkflowStep[];
  onStepsChange: (steps: WorkflowStep[]) => void;
  onExecuteStep?: (stepId: string) => void;
}

export const WorkflowStepsBuilder: React.FC<WorkflowStepsBuilderProps> = ({
  steps,
  onStepsChange,
  onExecuteStep
}) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const addStep = (type: 'trigger' | 'action' | 'condition' | 'delay') => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      type,
      position: { x: 100, y: steps.length * 150 },
      connections: [],
      isActive: true
    };

    if (type === 'action') {
      newStep.action = {
        id: `action_${Date.now()}`,
        type: 'send_email',
        name: 'Send Email',
        description: 'Send an email notification',
        config: {}
      };
    }

    onStepsChange([...steps, newStep]);
    setExpandedStep(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    const updatedSteps = steps.map(s =>
      s.id === stepId ? { ...s, ...updates } : s
    );
    onStepsChange(updatedSteps);
  };

  const deleteStep = (stepId: string) => {
    const updatedSteps = steps.filter(s => s.id !== stepId);
    onStepsChange(updatedSteps.map(s => ({
      ...s,
      connections: s.connections.filter(conn => conn !== stepId)
    })));
    if (expandedStep === stepId) {
      setExpandedStep(null);
    }
  };

  const duplicateStep = (step: WorkflowStep) => {
    const newStep: WorkflowStep = {
      ...step,
      id: `step_${Date.now()}`,
      name: `${step.name} (Copy)`,
      position: {
        x: step.position.x + 20,
        y: step.position.y + 20
      },
      connections: []
    };

    onStepsChange([...steps, newStep]);
  };

  const getStepIcon = (step: WorkflowStep) => {
    switch (step.type) {
      case 'trigger':
        return <Plus className="w-4 h-4" />;
      case 'action':
        switch (step.action?.type) {
          case 'send_email':
            return <Mail className="w-4 h-4" />;
          case 'code':
            return <Code className="w-4 h-4" />;
          case 'http_request':
            return <Globe className="w-4 h-4" />;
          case 'ai_agent':
            return <Bot className="w-4 h-4" />;
          default:
            return <Play className="w-4 h-4" />;
        }
      case 'condition':
        return <Filter className="w-4 h-4" />;
      case 'delay':
        return <Clock className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const StepForm: React.FC<{ step: WorkflowStep }> = ({ step }) => {
    const action = step.action;

    return (
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Step Name
            </label>
            <input
              type="text"
              value={step.name}
              onChange={(e) => updateStep(step.id, { name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {step.type === 'action' && action && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Action Type
                </label>
                <select
                  value={action.type}
                  onChange={(e) => {
                    const newAction: WorkflowAction = {
                      ...action,
                      type: e.target.value as ActionType,
                      name: actionNameForType(e.target.value as ActionType)
                    };
                    updateStep(step.id, { action: newAction });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="send_email">Send Email</option>
                  <option value="create_record">Create Record</option>
                  <option value="update_record">Update Record</option>
                  <option value="search_records">Search Records</option>
                  <option value="code">Run Code</option>
                  <option value="http_request">HTTP Request</option>
                  <option value="ai_agent">AI Agent</option>
                  <option value="delay">Delay</option>
                  <option value="notification">Notification</option>
                </select>
              </div>

              {renderActionFields(step.id, action)}
            </>
          )}

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={step.isActive}
                onChange={(e) => updateStep(step.id, { isActive: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Active Step</span>
            </label>
          </div>
        </div>
      </div>
    );
  };

  const renderActionFields = (stepId: string, action: WorkflowAction) => {
    const actionConfig = action.config || {};

    switch (action.type) {
      case 'send_email':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Template
              </label>
              <select
                value={actionConfig.emailTemplate || ''}
                onChange={(e) => updateStep(stepId, {
                  action: {
                    ...action,
                    config: { ...actionConfig, emailTemplate: e.target.value }
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select template...</option>
                <option value="followup">Follow-up Template</option>
                <option value="notification">Notification Template</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={actionConfig.subject || ''}
                onChange={(e) => updateStep(stepId, {
                  action: {
                    ...action,
                    config: { ...actionConfig, subject: e.target.value }
                  }
                })}
                placeholder="Email subject"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case 'ai_agent':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                AI Agent Prompt
              </label>
              <textarea
                value={actionConfig.aiAgentPrompt || ''}
                onChange={(e) => updateStep(stepId, {
                  action: {
                    ...action,
                    config: { ...actionConfig, aiAgentPrompt: e.target.value }
                  }
                })}
                placeholder="Describe what the AI agent should do..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model
              </label>
              <select
                value={actionConfig.aiAgentModel || 'gpt-4'}
                onChange={(e) => updateStep(stepId, {
                  action: {
                    ...action,
                    config: { ...actionConfig, aiAgentModel: e.target.value }
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude">Claude</option>
              </select>
            </div>
          </div>
        );

      case 'http_request':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                HTTP Method
              </label>
              <select
                value={actionConfig.httpMethod || 'GET'}
                onChange={(e) => updateStep(stepId, {
                  action: {
                    ...action,
                    config: { ...actionConfig, httpMethod: e.target.value as any }
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL
              </label>
              <input
                type="url"
                value={actionConfig.httpUrl || ''}
                onChange={(e) => updateStep(stepId, {
                  action: {
                    ...action,
                    config: { ...actionConfig, httpUrl: e.target.value }
                  }
                })}
                placeholder="https://api.example.com/webhook"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <RotateCcw className="w-5 h-5 mr-2" />
          Workflow Steps
        </h3>
      </div>

      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => addStep('action')}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors flex items-center space-x-1"
          >
            <Plus className="w-3 h-3" />
            <span>Action</span>
          </button>
          <button
            onClick={() => addStep('condition')}
            className="px-3 py-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors flex items-center space-x-1"
          >
            <Filter className="w-3 h-3" />
            <span>Condition</span>
          </button>
          <button
            onClick={() => addStep('delay')}
            className="px-3 py-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors flex items-center space-x-1"
          >
            <Clock className="w-3 h-3" />
            <span>Delay</span>
          </button>
        </div>
      </div>

      <div>
        {steps.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No steps configured. Add steps to build your workflow.</p>
          </div>
        ) : (
          steps.map((step, index) => (
            <div key={step.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                    {index + 1}
                  </div>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    {getStepIcon(step)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {step.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {step.type}
                      {step.action?.type && ` - ${step.action.type.replace('_', ' ')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {onExecuteStep && step.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExecuteStep(step.id);
                      }}
                      className="p-1 text-gray-400 hover:text-green-600"
                      title="Execute step"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    step.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {step.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateStep(step);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Duplicate step"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteStep(step.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete step"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedStep === step.id && <StepForm step={step} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function actionNameForType(type: ActionType): string {
  switch (type) {
    case 'send_email': return 'Send Email';
    case 'create_record': return 'Create Record';
    case 'update_record': return 'Update Record';
    case 'search_records': return 'Search Records';
    case 'code': return 'Run Code';
    case 'http_request': return 'HTTP Request';
    case 'ai_agent': return 'AI Agent';
    case 'delay': return 'Delay';
    case 'notification': return 'Send Notification';
    default: return 'Action';
  }
}

export default WorkflowStepsBuilder;