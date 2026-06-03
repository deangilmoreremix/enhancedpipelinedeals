import React, { useState, useEffect } from 'react';
import { Deal, BulkDealAction, BulkActionResult } from '../../types';
import { executeBulkAction, previewBulkAction, validateBulkAction, getAvailableBulkActions } from '../../services/bulkDealActionsService';
import { CheckCircle, AlertCircle, Loader, Users, Edit, Tag, Calendar, Archive, Trash2, TrendingUp } from 'lucide-react';

interface BulkDealActionsProps {
  selectedDeals: Deal[];
  onActionComplete: (results: BulkActionResult[]) => void;
  onClose: () => void;
}

const BulkDealActions: React.FC<BulkDealActionsProps> = ({
  selectedDeals,
  onActionComplete,
  onClose
}) => {
  const [availableActions] = useState<BulkDealAction[]>(getAvailableBulkActions());
  const [selectedAction, setSelectedAction] = useState<BulkDealAction | null>(null);
  const [actionConfig, setActionConfig] = useState<Partial<BulkDealAction>>({});
  const [previewResults, setPreviewResults] = useState<any[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<BulkActionResult[]>([]);
  const [currentStep, setCurrentStep] = useState<'select' | 'configure' | 'preview' | 'execute' | 'results'>('select');

  const getActionIcon = (actionType: BulkDealAction['actionType']) => {
    switch (actionType) {
      case 'update_field': return <Edit className="w-4 h-4" />;
      case 'change_stage': return <TrendingUp className="w-4 h-4" />;
      case 'assign_owner': return <Users className="w-4 h-4" />;
      case 'add_tag': case 'remove_tag': return <Tag className="w-4 h-4" />;
      case 'schedule_followup': return <Calendar className="w-4 h-4" />;
      case 'archive': return <Archive className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      default: return <Edit className="w-4 h-4" />;
    }
  };

  const handleActionSelect = (action: BulkDealAction) => {
    setSelectedAction(action);
    setActionConfig({});
    setCurrentStep('configure');
  };

  const handleConfigChange = (field: string, value: any) => {
    setActionConfig(prev => ({ ...prev, [field]: value }));
  };

  const handlePreview = async () => {
    if (!selectedAction) return;

    setIsPreviewing(true);
    try {
      const configWithDefaults = { ...selectedAction, ...actionConfig };
      const validation = validateBulkAction(configWithDefaults);

      if (!validation.valid) {
        alert('Configuration errors:\n' + validation.errors.join('\n'));
        return;
      }

      const results = await previewBulkAction(
        selectedDeals.map(d => d.id),
        configWithDefaults
      );
      setPreviewResults(results);
      setCurrentStep('preview');
    } catch (error) {
      console.error('Error previewing bulk action:', error);
      alert('Error previewing action. Please try again.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedAction) return;

    setIsExecuting(true);
    try {
      const configWithDefaults = { ...selectedAction, ...actionConfig };
      const results = await executeBulkAction(
        selectedDeals.map(d => d.id),
        configWithDefaults
      );
      setExecutionResults(results);
      setCurrentStep('results');
      onActionComplete(results);
    } catch (error) {
      console.error('Error executing bulk action:', error);
      alert('Error executing action. Please try again.');
    } finally {
      setIsExecuting(false);
    }
  };

  const renderActionSelection = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">Select Bulk Action</h3>
      <div className="grid grid-cols-1 gap-3">
        {availableActions.map(action => (
          <button
            key={action.id}
            onClick={() => handleActionSelect(action)}
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
          >
            <div className={`p-2 rounded-lg mr-3 ${action.isDestructive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {getActionIcon(action.actionType)}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{action.name}</h4>
              <p className="text-sm text-gray-600">{action.description}</p>
              {action.isDestructive && (
                <span className="inline-block mt-1 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                  Destructive Action
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderActionConfiguration = () => {
    if (!selectedAction) return null;

    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Configure {selectedAction.name}</h3>
        <div className="space-y-4">
          {selectedAction.actionType === 'update_field' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field to Update
              </label>
              <select
                value={actionConfig.fieldName || ''}
                onChange={(e) => handleConfigChange('fieldName', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Select field...</option>
                <option value="priority">Priority</option>
                <option value="notes">Notes</option>
                <option value="customFields">Custom Fields</option>
              </select>
              {actionConfig.fieldName && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Value
                  </label>
                  {actionConfig.fieldName === 'priority' ? (
                    <select
                      value={actionConfig.fieldValue || ''}
                      onChange={(e) => handleConfigChange('fieldValue', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    >
                      <option value="">Select priority...</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={actionConfig.fieldValue || ''}
                      onChange={(e) => handleConfigChange('fieldValue', e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="Enter new value..."
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {selectedAction.actionType === 'change_stage' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Stage
              </label>
              <select
                value={actionConfig.targetStage || ''}
                onChange={(e) => handleConfigChange('targetStage', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="">Select stage...</option>
                <option value="qualification">Qualification</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="closed-won">Closed Won</option>
                <option value="closed-lost">Closed Lost</option>
              </select>
            </div>
          )}

          {selectedAction.actionType === 'assign_owner' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Team Member
              </label>
              <input
                type="text"
                value={actionConfig.targetOwnerId || ''}
                onChange={(e) => handleConfigChange('targetOwnerId', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Enter team member ID or name..."
              />
            </div>
          )}

          {(selectedAction.actionType === 'add_tag' || selectedAction.actionType === 'remove_tag') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {selectedAction.actionType === 'add_tag' ? 'Tags to Add' : 'Tags to Remove'}
              </label>
              <input
                type="text"
                value={actionConfig.tagsToAdd?.join(', ') || actionConfig.tagsToRemove?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                  handleConfigChange(selectedAction.actionType === 'add_tag' ? 'tagsToAdd' : 'tagsToRemove', tags);
                }}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Enter tags separated by commas..."
              />
            </div>
          )}

          {selectedAction.actionType === 'schedule_followup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Follow-up Date
              </label>
              <input
                type="date"
                value={actionConfig.followupDate ? actionConfig.followupDate.toISOString().split('T')[0] : ''}
                onChange={(e) => handleConfigChange('followupDate', new Date(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          )}

          {selectedAction.actionType === 'add_note' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note Text
              </label>
              <textarea
                value={actionConfig.noteText || ''}
                onChange={(e) => handleConfigChange('noteText', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={3}
                placeholder="Enter note to add to all selected deals..."
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPreview = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">Preview Changes</h3>
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
          <span className="text-sm text-yellow-800">
            This action will affect {selectedDeals.length} deal{selectedDeals.length !== 1 ? 's' : ''}.
            Please review the changes below before proceeding.
          </span>
        </div>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {previewResults.map(result => (
          <div key={result.dealId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <span className="text-sm text-gray-900">
              {selectedDeals.find(d => d.id === result.dealId)?.title || result.dealId}
            </span>
            <span className="text-sm text-gray-600">
              {String(result.currentValue)} → {String(result.newValue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderExecution = () => (
    <div className="text-center py-8">
      <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
      <h3 className="text-lg font-semibold mb-2">Executing Bulk Action</h3>
      <p className="text-gray-600">
        Applying {selectedAction?.name} to {selectedDeals.length} deals...
      </p>
    </div>
  );

  const renderResults = () => {
    const successCount = executionResults.filter(r => r.success).length;
    const failureCount = executionResults.filter(r => !r.success).length;

    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Action Results</h3>
        <div className="flex items-center mb-4">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          <span className="text-green-600 font-medium">
            {successCount} successful
          </span>
          {failureCount > 0 && (
            <>
              <span className="mx-2 text-gray-400">•</span>
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-600 font-medium">
                {failureCount} failed
              </span>
            </>
          )}
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {executionResults.map(result => (
            <div key={result.dealId} className="flex items-center p-2 bg-gray-50 rounded">
              {result.success ? (
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
              )}
              <span className="text-sm text-gray-900 flex-1">
                {selectedDeals.find(d => d.id === result.dealId)?.title || result.dealId}
              </span>
              {!result.success && (
                <span className="text-sm text-red-600">{result.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Bulk Deal Actions
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {selectedDeals.length} deal{selectedDeals.length !== 1 ? 's' : ''} selected
        </p>
      </div>

      <div className="p-6 overflow-y-auto max-h-[60vh]">
        {currentStep === 'select' && renderActionSelection()}
        {currentStep === 'configure' && renderActionConfiguration()}
        {currentStep === 'preview' && renderPreview()}
        {currentStep === 'execute' && renderExecution()}
        {currentStep === 'results' && renderResults()}
      </div>

      <div className="p-6 border-t bg-gray-50">
        <div className="flex justify-between">
          <button
            onClick={() => {
              if (currentStep === 'configure') setCurrentStep('select');
              else if (currentStep === 'preview') setCurrentStep('configure');
              else onClose();
            }}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
            disabled={isExecuting}
          >
            {currentStep === 'select' ? 'Cancel' : 'Back'}
          </button>

          {currentStep === 'configure' && (
            <button
              onClick={handlePreview}
              disabled={isPreviewing}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isPreviewing ? 'Previewing...' : 'Preview Changes'}
            </button>
          )}

          {currentStep === 'preview' && (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={`px-4 py-2 text-white rounded ${
                selectedAction?.isDestructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {isExecuting ? 'Executing...' : `Execute ${selectedAction?.name}`}
            </button>
          )}

          {currentStep === 'results' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkDealActions;