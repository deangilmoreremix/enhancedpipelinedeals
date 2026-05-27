import React, { useState } from 'react';
import { WorkflowTrigger, TriggerType, WorkflowCondition } from '../../types/workflow';
import { Zap, Clock, Calendar as CalendarIcon, Globe, Webhook, AlertTriangle, Settings, Plus, Trash2 } from 'lucide-react';

interface WorkflowTriggerConfiguratorProps {
  triggers: WorkflowTrigger[];
  onTriggersChange: (triggers: WorkflowTrigger[]) => void;
  availableRecordTypes?: Array<'deal' | 'contact' | 'company' | 'task'>;
}

export const WorkflowTriggerConfigurator: React.FC<WorkflowTriggerConfiguratorProps> = ({
  triggers,
  onTriggersChange,
  availableRecordTypes = ['deal', 'contact', 'task']
}) => {
  const [expandedTrigger, setExpandedTrigger] = useState<string | null>(null);

  const addTrigger = () => {
    const newTrigger: WorkflowTrigger = {
      id: `trigger_${Date.now()}`,
      type: 'record_created',
      name: 'New Trigger',
      description: 'Triggers when a new record is created',
      config: {
        recordType: 'deal'
      },
      isActive: true
    };

    onTriggersChange([...triggers, newTrigger]);
    setExpandedTrigger(newTrigger.id);
  };

  const updateTrigger = (triggerId: string, updates: Partial<WorkflowTrigger>) => {
    const updatedTriggers = triggers.map(t =>
      t.id === triggerId ? { ...t, ...updates } : t
    );
    onTriggersChange(updatedTriggers);
  };

  const deleteTrigger = (triggerId: string) => {
    const updatedTriggers = triggers.filter(t => t.id !== triggerId);
    onTriggersChange(updatedTriggers);
    if (expandedTrigger === triggerId) {
      setExpandedTrigger(null);
    }
  };

  const getTriggerIcon = (type: TriggerType) => {
    switch (type) {
      case 'record_created':
      case 'record_updated':
      case 'record_deleted':
        return <Zap className="w-4 h-4" />;
      case 'stage_changed':
        return <Settings className="w-4 h-4" />;
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      case 'webhook':
        return <Webhook className="w-4 h-4" />;
      case 'sla_breach':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const TriggerForm: React.FC<{ trigger: WorkflowTrigger }> = ({ trigger }) => {
    const config = trigger.config || {};
    const conditions = trigger.conditions || [];

    return (
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Trigger Type
          </label>
          <select
            value={trigger.type}
            onChange={(e) => updateTrigger(trigger.id, {
              type: e.target.value as TriggerType,
              description: getTriggerDescription(e.target.value as TriggerType)
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="record_created">Record Created</option>
            <option value="record_updated">Record Updated</option>
            <option value="record_deleted">Record Deleted</option>
            <option value="stage_changed">Stage Changed</option>
            <option value="scheduled">Scheduled</option>
            <option value="webhook">Webhook</option>
            <option value="sla_breach">SLA Breach</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Record Type
          </label>
          <select
            value={config.recordType || 'deal'}
            onChange={(e) => updateTrigger(trigger.id, {
              config: { ...config, recordType: e.target.value as any }
            })}
            disabled={!['record_created', 'record_updated', 'record_deleted', 'stage_changed'].includes(trigger.type)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {availableRecordTypes.map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </select>
        </div>

        {trigger.type === 'stage_changed' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Stage
              </label>
              <input
                type="text"
                value={config.fromStage || ''}
                onChange={(e) => updateTrigger(trigger.id, {
                  config: { ...config, fromStage: e.target.value }
                })}
                placeholder="e.g., qualification"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                To Stage
              </label>
              <input
                type="text"
                value={config.toStage || ''}
                onChange={(e) => updateTrigger(trigger.id, {
                  config: { ...config, toStage: e.target.value }
                })}
                placeholder="e.g., proposal"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {trigger.type === 'scheduled' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency
              </label>
              <select
                value={config.schedule?.frequency || 'daily'}
                onChange={(e) => updateTrigger(trigger.id, {
                  config: {
                    ...config,
                    schedule: { ...config.schedule, frequency: e.target.value as any }
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <input
                type="time"
                value={config.schedule?.time || ''}
                onChange={(e) => updateTrigger(trigger.id, {
                  config: {
                    ...config,
                    schedule: { ...config.schedule, time: e.target.value }
                  }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {trigger.type === 'sla_breach' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SLA Type
            </label>
            <select
              value={config.slaType || 'response_time'}
              onChange={(e) => updateTrigger(trigger.id, {
                config: { ...config, slaType: e.target.value as any }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="response_time">Response Time</option>
              <option value="stage_duration">Stage Duration</option>
              <option value="milestone_deadline">Milestone Deadline</option>
            </select>
          </div>
        )}

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={trigger.isActive}
              onChange={(e) => updateTrigger(trigger.id, { isActive: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Active Trigger</span>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <Zap className="w-5 h-5 mr-2" />
          Workflow Triggers
        </h3>
        <button
          onClick={addTrigger}
          className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
          title="Add trigger"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div>
        {triggers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No triggers configured. Add a trigger to start the workflow.</p>
          </div>
        ) : (
          triggers.map(trigger => (
            <div key={trigger.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => setExpandedTrigger(expandedTrigger === trigger.id ? null : trigger.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    {getTriggerIcon(trigger.type)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {trigger.type.replace('_', ' ').replace(/_/g, ' ')}
                      {trigger.config?.recordType && `: ${trigger.config.recordType}`}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {trigger.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    trigger.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {trigger.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTrigger(trigger.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete trigger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedTrigger === trigger.id && <TriggerForm trigger={trigger} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function getTriggerDescription(type: TriggerType): string {
  switch (type) {
    case 'record_created':
      return 'Triggers when a new record is created';
    case 'record_updated':
      return 'Triggers when a record is updated';
    case 'record_deleted':
      return 'Triggers when a record is deleted';
    case 'stage_changed':
      return 'Triggers when a deal stage changes';
    case 'scheduled':
      return 'Triggers on a schedule';
    case 'webhook':
      return 'Triggers from an external webhook';
    case 'sla_breach':
      return 'Triggers when an SLA is breached';
    default:
      return 'Workflow trigger';
  }
}

export default WorkflowTriggerConfigurator;