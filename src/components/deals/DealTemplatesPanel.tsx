import React, { useState, useEffect } from 'react';
import { DealTemplate, getAllTemplates } from '../../services/dealTemplateService';
import { isFeatureEnabled } from '../../services/featureFlagService';

/**
 * Deal Templates Panel - Twenty Feature
 * Allows users to browse and apply pre-built deal templates
 */
export const DealTemplatesPanel: React.FC = () => {
  const [templates, setTemplates] = useState<DealTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);

  useEffect(() => {
    const init = async () => {
      const enabled = await isFeatureEnabled('twenty_deal_templates');
      setFeatureEnabled(enabled);

      if (enabled) {
        const templateData = await getAllTemplates();
        setTemplates(templateData);
      }
      setLoading(false);
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!featureEnabled) {
    return (
      <div className="p-4 text-center text-gray-500">
        Deal Templates feature is not yet available.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Deal Templates</h3>

      {templates.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No templates available yet. Templates will be added soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                {template.name}
              </h4>
              {template.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {template.description}
                </p>
              )}
              <div className="mt-3 flex justify-between items-center">
                <span className={`text-xs px-2 py-1 rounded ${
                  template.is_public
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                }`}>
                  {template.is_public ? 'Public' : 'Private'}
                </span>
                <button
                  className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={() => {
                    // TODO: Implement template application
                    console.log('Apply template:', template.id);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};