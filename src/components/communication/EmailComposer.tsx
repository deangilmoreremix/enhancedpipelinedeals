import React, { useState, useEffect } from 'react';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';
import { getEmailService, EmailTemplate, EmailData } from '../../services/emailService';
import { getEnhancedIntelligentAI } from '../../services/enhancedIntelligentAIService';
import { Mail, Send, Sparkles, FileText, X, Loader2, Wand2 } from 'lucide-react';

interface EmailComposerProps {
  deal?: Deal;
  contact?: Contact;
  isOpen: boolean;
  onClose: () => void;
  onSend?: (emailData: EmailData) => void;
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
  deal,
  contact,
  isOpen,
  onClose,
  onSend
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('introduction');
  const [emailData, setEmailData] = useState<EmailData>({
    to: '',
    subject: '',
    body: '',
    deal,
    contact
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  const emailService = getEmailService();
  const aiService = getEnhancedIntelligentAI();

  useEffect(() => {
    if (isOpen) {
      const availableTemplates = emailService.getAvailableTemplates();
      setTemplates(availableTemplates);

      // Generate initial email
      const generatedEmail = emailService.generateEmail(deal, contact, selectedTemplate);
      setEmailData(generatedEmail);
    }
  }, [isOpen, deal, contact, selectedTemplate]);

  const handleTemplateChange = (templateType: string) => {
    setSelectedTemplate(templateType);
    const generatedEmail = emailService.generateEmail(deal, contact, templateType);
    setEmailData(generatedEmail);
  };

  const handleGenerateAIEmail = async () => {
    if (!deal || !contact) return;

    setIsGenerating(true);
    try {
      const context = `Generate a professional sales email for deal: ${deal.title} with company: ${deal.company}. Current stage: ${deal.stage}, value: $${deal.value.toLocaleString()}. Focus on moving the deal forward with personalized content.`;

      const aiResponse = await aiService.generateEmail(contact, context, 'quality');

      if (aiResponse) {
        // Parse the AI response to extract subject and body
        const lines = aiResponse.split('\n');
        let subject = emailData.subject;
        let body = aiResponse;

        // Try to extract subject from the first line
        if (lines[0] && lines[0].toLowerCase().includes('subject:')) {
          subject = lines[0].replace(/subject:/i, '').trim();
          body = lines.slice(1).join('\n').trim();
        }

        setEmailData(prev => ({
          ...prev,
          subject,
          body
        }));
      }
    } catch (error) {
      console.error('Failed to generate AI email:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const success = await emailService.sendEmail(emailData);

      if (success && onSend) {
        onSend(emailData);
      }

      onClose();
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFieldChange = (field: keyof EmailData, value: string) => {
    setEmailData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Compose Email
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {deal ? `Regarding: ${deal.title}` : 'Send email'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Template
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => handleTemplateChange(template.type)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTemplate === template.type
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {template.type.charAt(0).toUpperCase() + template.type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Generate Button */}
            <div className="flex justify-between items-center">
              <button
                onClick={handleGenerateAIEmail}
                disabled={isGenerating || !deal || !contact}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                <span>Generate with AI</span>
                <Sparkles className="w-3 h-3" />
              </button>
            </div>

            {/* Email Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To
                </label>
                <input
                  type="email"
                  value={emailData.to}
                  onChange={(e) => handleFieldChange('to', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="recipient@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailData.subject}
                  onChange={(e) => handleFieldChange('subject', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Email subject"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  value={emailData.body}
                  onChange={(e) => handleFieldChange('body', e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-vertical"
                  placeholder="Compose your email..."
                />
              </div>
            </div>

            {/* Deal/Contact Context */}
            {(deal || contact) && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Context Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {deal && (
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Deal</p>
                      <p className="font-medium text-gray-900 dark:text-white">{deal.title}</p>
                      <p className="text-gray-600 dark:text-gray-400">{deal.company}</p>
                    </div>
                  )}
                  {contact && (
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Contact</p>
                      <p className="font-medium text-gray-900 dark:text-white">{contact.name}</p>
                      <p className="text-gray-600 dark:text-gray-400">{contact.email}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Email will open in your default email client
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !emailData.to || !emailData.subject}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Send Email</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};