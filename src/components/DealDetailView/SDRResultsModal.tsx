import React from 'react';
import { X, Copy, Edit, Send, Brain, Target, Mail, CheckCircle } from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';

interface SDRResult {
  agentId: string;
  contactId: string;
  dealId: string | null;
  result: any;
}

interface SDRResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: SDRResult | null;
  onCopyEmail?: (subject: string, body: string) => void;
  onSendEmail?: (subject: string, body: string) => void;
  onEditEmail?: (subject: string, body: string) => void;
}

const SDR_AGENT_NAMES = {
  'sdr-data-enrichment': 'Data-Enrichment SDR',
  'sdr-competitor-aware': 'Competitor-Aware SDR',
  'sdr-objection-handling': 'Objection-Handling SDR',
  'sdr-follow-up': 'Follow-Up SDR',
  'sdr-high-intent': 'High-Intent SDR'
};

const SDR_AGENT_ICONS = {
  'sdr-data-enrichment': Brain,
  'sdr-competitor-aware': Target,
  'sdr-objection-handling': CheckCircle,
  'sdr-follow-up': Mail,
  'sdr-high-intent': Send
};

export const SDRResultsModal: React.FC<SDRResultsModalProps> = ({
  isOpen,
  onClose,
  result,
  onCopyEmail,
  onSendEmail,
  onEditEmail
}) => {
  if (!isOpen || !result) return null;

  const agentName = SDR_AGENT_NAMES[result.agentId as keyof typeof SDR_AGENT_NAMES] || result.agentId;
  const AgentIcon = SDR_AGENT_ICONS[result.agentId as keyof typeof SDR_AGENT_ICONS] || Brain;

  const handleCopy = (subject: string, body: string) => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    onCopyEmail?.(subject, body);
  };

  const renderEmailSection = (title: string, emailData: any, key: string) => {
    if (!emailData?.subject || !emailData?.body) return null;

    return (
      <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 dark:text-white flex items-center">
            <Mail className="w-4 h-4 mr-2 text-blue-600" />
            {title}
          </h4>
          <div className="flex items-center space-x-2">
            <ModernButton
              variant="outline"
              size="xs"
              onClick={() => handleCopy(emailData.subject, emailData.body)}
              className="flex items-center space-x-1"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </ModernButton>
            {onEditEmail && (
              <ModernButton
                variant="outline"
                size="xs"
                onClick={() => onEditEmail(emailData.subject, emailData.body)}
                className="flex items-center space-x-1"
              >
                <Edit className="w-3 h-3" />
                <span>Edit</span>
              </ModernButton>
            )}
            {onSendEmail && (
              <ModernButton
                variant="primary"
                size="xs"
                onClick={() => onSendEmail(emailData.subject, emailData.body)}
                className="flex items-center space-x-1"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </ModernButton>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject:</div>
            <div className="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 p-2 rounded border">
              {emailData.subject}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body:</div>
            <div className="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 p-3 rounded border max-h-48 overflow-y-auto whitespace-pre-wrap">
              {emailData.body}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInsights = (insights: any) => {
    if (!insights) return null;

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
        <h4 className="font-medium text-gray-900 dark:text-white flex items-center mb-3">
          <Target className="w-4 h-4 mr-2 text-blue-600" />
          Strategic Insights
        </h4>

        <div className="space-y-2">
          {insights.angles?.map((angle: string, index: number) => (
            <div key={index} className="flex items-start space-x-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{angle}</span>
            </div>
          ))}

          {insights.key_reasons_to_switch?.map((reason: string, index: number) => (
            <div key={index} className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{reason}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <AgentIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{agentName}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deal: {result.dealId || 'No deal linked'} • Contact: {result.contactId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          <div className="space-y-6">
            {/* Primary Email */}
            {renderEmailSection('Primary Email Draft', result.result?.email, 'primary')}

            {/* Objection Email (for competitor-aware) */}
            {renderEmailSection('Objection Response Draft', result.result?.objection_email, 'objection')}

            {/* Strategic Insights */}
            {renderInsights(result.result?.positioning)}

            {/* Raw Result (for debugging) */}
            <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
              <summary className="p-4 font-medium text-gray-900 dark:text-white cursor-pointer">
                Raw SDR Result (Debug)
              </summary>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <ModernButton variant="outline" onClick={onClose}>
            Close
          </ModernButton>
        </div>
      </div>
    </div>
  );
};