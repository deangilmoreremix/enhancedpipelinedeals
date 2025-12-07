import React from 'react';
import { X, Copy, Send, Edit, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';

interface SDRResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: any;
  onCopyEmail?: (subject: string, body: string) => void;
  onSendEmail?: (subject: string, body: string) => void;
  onEditEmail?: (subject: string, body: string) => void;
}

export const SDRResultsModal: React.FC<SDRResultsModalProps> = ({
  isOpen,
  onClose,
  result,
  onCopyEmail,
  onSendEmail,
  onEditEmail
}) => {
  if (!isOpen || !result) return null;

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="w-6 h-6 text-green-500" />
    ) : (
      <XCircle className="w-6 h-6 text-red-500" />
    );
  };

  const getStatusColor = (success: boolean) => {
    return success
      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            {getStatusIcon(result.success)}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                SDR Agent Results
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {result.success ? 'Agent executed successfully' : 'Agent execution failed'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {result.success ? (
            <div className="space-y-6">
              {/* Agent Info */}
              <div className={`p-4 rounded-lg border ${getStatusColor(true)}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {result.agentName || 'SDR Agent'}
                  </h3>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {result.executionTime ? `${result.executionTime}ms` : 'Completed'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {result.message || 'Agent executed successfully'}
                </p>
              </div>

              {/* Email Content */}
              {result.emailData && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Generated Email
                  </h3>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject
                    </label>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-gray-900 dark:text-white font-medium">
                        {result.emailData.subject}
                      </p>
                    </div>
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Body
                    </label>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                      <pre className="text-gray-900 dark:text-white whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {result.emailData.body}
                      </pre>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {onCopyEmail && (
                      <ModernButton
                        variant="outline"
                        size="sm"
                        onClick={() => onCopyEmail(result.emailData.subject, result.emailData.body)}
                        className="flex items-center space-x-2"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copy Email</span>
                      </ModernButton>
                    )}

                    {onSendEmail && (
                      <ModernButton
                        variant="primary"
                        size="sm"
                        onClick={() => onSendEmail(result.emailData.subject, result.emailData.body)}
                        className="flex items-center space-x-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>Send Email</span>
                      </ModernButton>
                    )}

                    {onEditEmail && (
                      <ModernButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onEditEmail(result.emailData.subject, result.emailData.body)}
                        className="flex items-center space-x-2"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit & Send</span>
                      </ModernButton>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Metadata */}
              {result.metadata && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Execution Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(result.metadata).map(([key, value]) => (
                      <div key={key} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </div>
                        <div className="text-sm text-gray-900 dark:text-white mt-1">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`p-6 rounded-lg border ${getStatusColor(false)}`}>
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-6 h-6 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    Agent Execution Failed
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {result.error || 'An unknown error occurred during agent execution.'}
                  </p>
                  {result.metadata && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <strong>Agent:</strong> {result.agentId || 'Unknown'}<br />
                      <strong>Execution Time:</strong> {result.executionTime ? `${result.executionTime}ms` : 'N/A'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <ModernButton
            variant="outline"
            onClick={onClose}
          >
            Close
          </ModernButton>
        </div>
      </div>
    </div>
  );
};