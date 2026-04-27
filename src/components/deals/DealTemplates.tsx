import React, { useState, useEffect } from 'react';
import { DealTemplate, Deal } from '../../types';
import { getAllTemplates, createTemplate, applyTemplate } from '../../services/dealTemplateService';
import { isFeatureEnabled } from '../../services/featureFlagService';
import { FileText, Plus, Star, Copy, Eye, Loader } from 'lucide-react';

interface DealTemplatesProps {
  onTemplateApplied: (deal: Deal) => void;
  contactId?: string;
  currentDeal?: Deal;
}

const DealTemplates: React.FC<DealTemplatesProps> = ({
  onTemplateApplied,
  contactId,
  currentDeal
}) => {
  const [templates, setTemplates] = useState<DealTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [featureEnabled, setFeatureEnabled] = useState(false);

  useEffect(() => {
    checkFeatureFlag();
    loadTemplates();
  }, []);

  const checkFeatureFlag = async () => {
    const enabled = await isFeatureEnabled('deal_templates_phase3');
    setFeatureEnabled(enabled);
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading deal templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = async (template: DealTemplate) => {
    if (!contactId) {
      alert('Please select a contact first');
      return;
    }

    setApplyingTemplate(template.id);
    try {
      const newDeal = await applyTemplate(template.id, contactId);
      if (newDeal) {
        onTemplateApplied(newDeal);

        // Update template usage count
        setTemplates(prev => prev.map(t =>
          t.id === template.id
            ? { ...t, usageCount: t.usageCount + 1 }
            : t
        ));
      }
    } catch (error) {
      console.error('Error applying template:', error);
      alert('Error applying template. Please try again.');
    } finally {
      setApplyingTemplate(null);
    }
  };

  const handleCreateFromCurrent = async () => {
    if (!currentDeal) return;

    const templateName = prompt('Enter template name:');
    if (!templateName) return;

    const templateDescription = prompt('Enter template description (optional):');

    try {
      const templateData = {
        title: currentDeal.title,
        value: currentDeal.value,
        stage: currentDeal.stage,
        priority: currentDeal.priority,
        notes: currentDeal.notes,
        tags: currentDeal.tags,
        customFields: currentDeal.customFields,
        socialProfiles: currentDeal.socialProfiles
      };

      const newTemplate = await createTemplate({
        name: templateName,
        description: templateDescription,
        templateData,
        isPublic: false
      });

      if (newTemplate) {
        setTemplates(prev => [newTemplate, ...prev]);
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Error creating template. Please try again.');
    }
  };

  if (!featureEnabled) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Deal Templates</h3>
        <p className="text-gray-600">
          This feature is not yet available. It will be enabled through feature flags when ready.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Deal Templates
          </h3>
          {currentDeal && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create from Current
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No templates available</p>
            <p className="text-sm">Create your first template to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {templates.map(template => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      {template.isPublic && (
                        <Star className="w-4 h-4 text-yellow-500 ml-2" />
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    )}
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span>Used {template.usageCount} times</span>
                      <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApplyTemplate(template)}
                      disabled={applyingTemplate === template.id || !contactId}
                      className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {applyingTemplate === template.id ? (
                        <Loader className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      Apply
                    </button>
                  </div>
                </div>

                {/* Template preview */}
                <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                  <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <span>Value: ${template.templateData.value?.toLocaleString() || 'N/A'}</span>
                    <span>Stage: {template.templateData.stage || 'N/A'}</span>
                    <span>Priority: {template.templateData.priority || 'N/A'}</span>
                    {template.templateData.tags && template.templateData.tags.length > 0 && (
                      <span>Tags: {template.templateData.tags.join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create template modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create Template from Current Deal</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will create a reusable template based on the current deal's configuration.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFromCurrent}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealTemplates;