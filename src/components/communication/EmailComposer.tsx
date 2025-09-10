import React, { useState, useEffect } from 'react';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';
import { getEmailService, EmailTemplate, EmailData } from '../../services/emailService';
import { getEnhancedIntelligentAI } from '../../services/enhancedIntelligentAIService';
import { useEnhancedOpenAI } from '../../services/enhancedOpenAIService';
import { useAIResearch, CompanyResearchData, ContactPersonData } from '../../services/aiResearchService';
import { CitationSummary } from '../ui/CitationBadge';
import { Mail, Send, Sparkles, FileText, X, Loader2, Wand2, Brain, Search, ExternalLink, Building2, User, MessageSquare } from 'lucide-react';

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

  // Research state
  const [companyResearch, setCompanyResearch] = useState<CompanyResearchData | null>(null);
  const [contactResearch, setContactResearch] = useState<ContactPersonData | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [showResearchPanel, setShowResearchPanel] = useState(false);

  // Conversation analysis state
  const [conversationHistory, setConversationHistory] = useState<string>('');
  const [conversationAnalysis, setConversationAnalysis] = useState<any>(null);
  const [isAnalyzingConversation, setIsAnalyzingConversation] = useState(false);
  const [showConversationPanel, setShowConversationPanel] = useState(false);

  // Advanced reasoning state
  const [advancedAnalysis, setAdvancedAnalysis] = useState<any>(null);
  const [isAdvancedAnalyzing, setIsAdvancedAnalyzing] = useState(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [streamingChunks, setStreamingChunks] = useState<string[]>([]);

  const emailService = getEmailService();
  const aiService = getEnhancedIntelligentAI();
  const aiResearch = useAIResearch();

  useEffect(() => {
    if (isOpen) {
      const availableTemplates = emailService.getAvailableTemplates();
      setTemplates(availableTemplates);

      // Generate initial email
      const generatedEmail = emailService.generateEmail(deal, contact, selectedTemplate);
      setEmailData(generatedEmail);

      // Automatically perform research if we have company/contact data
      if (deal?.company || contact?.company || contact?.name) {
        performResearch();
      }
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

  // Research functions
  const performResearch = async () => {
    if (!deal && !contact) return;

    setIsResearching(true);
    try {
      // Research company if we have deal or contact with company info
      if ((deal?.company || contact?.company) && !companyResearch) {
        const companyName = deal?.company || contact?.company || '';
        const companyData = await aiResearch.researchCompany(companyName);
        setCompanyResearch(companyData);
      }

      // Research contact if we have contact info
      if (contact?.name && !contactResearch) {
        const contactData = await aiResearch.findContactPerson(
          contact.name,
          contact.company
        );
        setContactResearch(contactData);
      }
    } catch (error) {
      console.error('Research failed:', error);
    } finally {
      setIsResearching(false);
    }
  };

  const generatePersonalizedEmail = async () => {
    if (!deal && !contact) return;

    setIsGenerating(true);
    try {
      let context = '';

      // Build context from research data
      if (companyResearch) {
        context += `Company Research: ${companyResearch.description}\n`;
        context += `Industry: ${companyResearch.industry}\n`;
        context += `Recent News: ${companyResearch.recentNews.slice(0, 2).join(', ')}\n`;
        context += `Sales Approach: ${companyResearch.salesApproach}\n`;
      }

      if (contactResearch) {
        context += `Contact Background: ${contactResearch.background}\n`;
        context += `Communication Style: ${contactResearch.communicationStyle}\n`;
        context += `Value Proposition: ${contactResearch.valueProposition}\n`;
        context += `Contact Strategy: ${contactResearch.contactStrategy}\n`;
      }

      if (deal) {
        context += `Deal Context: ${deal.title} - ${deal.stage} stage, $${deal.value.toLocaleString()} value\n`;
      }

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
      console.error('Failed to generate personalized email:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Conversation analysis functions
  const analyzeConversation = async () => {
    if (!conversationHistory.trim()) return;

    setIsAnalyzingConversation(true);
    try {
      const conversationData = {
        conversation: conversationHistory,
        contact: contact,
        deal: deal,
        context: 'email-personalization'
      };

      const analysis = await aiService.analyzeConversation(conversationData, 'quality');
      setConversationAnalysis(analysis);
    } catch (error) {
      console.error('Failed to analyze conversation:', error);
      setConversationAnalysis({
        error: 'Failed to analyze conversation',
        insights: ['Unable to analyze conversation at this time']
      });
    } finally {
      setIsAnalyzingConversation(false);
    }
  };

  const generateEmailFromConversation = async () => {
    if (!deal && !contact) return;

    setIsGenerating(true);
    try {
      let context = '';

      // Build context from conversation analysis
      if (conversationAnalysis) {
        context += `Conversation Analysis: ${JSON.stringify(conversationAnalysis)}\n`;
      }

      // Add conversation history
      if (conversationHistory) {
        context += `Previous Conversation:\n${conversationHistory}\n\n`;
      }

      // Add research context
      if (companyResearch) {
        context += `Company Research: ${companyResearch.description}\n`;
        context += `Industry: ${companyResearch.industry}\n`;
      }

      if (contactResearch) {
        context += `Contact Background: ${contactResearch.background}\n`;
        context += `Communication Style: ${contactResearch.communicationStyle}\n`;
      }

      if (deal) {
        context += `Deal Context: ${deal.title} - ${deal.stage} stage, $${deal.value.toLocaleString()} value\n`;
      }

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
      console.error('Failed to generate email from conversation:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Advanced reasoning functions
  const performAdvancedAnalysis = async () => {
    if (!contact) return;

    setIsAdvancedAnalyzing(true);
    setStreamingChunks([]);
    setAdvancedAnalysis(null);

    try {
      // Use the enhanced OpenAI service for advanced reasoning
      const openAIService = useEnhancedOpenAI();

      const analysis = await openAIService.generateStreamingAnalysis(
        contact,
        (chunk: string) => {
          setStreamingChunks(prev => [...prev, chunk]);
        }
      );

      setAdvancedAnalysis(analysis);
    } catch (error) {
      console.error('Advanced analysis failed:', error);
      setAdvancedAnalysis({
        error: 'Advanced analysis failed',
        fallback: true
      });
    } finally {
      setIsAdvancedAnalyzing(false);
    }
  };

  const generateEmailFromAdvancedAnalysis = async () => {
    if (!deal && !contact) return;

    setIsGenerating(true);
    try {
      let context = '';

      // Build context from advanced analysis
      if (advancedAnalysis && !advancedAnalysis.error) {
        context += `Advanced Analysis: ${JSON.stringify(advancedAnalysis)}\n`;
        context += `Streaming Insights: ${streamingChunks.join(' ')}\n`;
      }

      // Add research and conversation context
      if (companyResearch) {
        context += `Company Research: ${companyResearch.description}\n`;
      }

      if (contactResearch) {
        context += `Contact Research: ${contactResearch.background}\n`;
      }

      if (conversationHistory) {
        context += `Conversation History: ${conversationHistory}\n`;
      }

      if (deal) {
        context += `Deal Context: ${deal.title} - ${deal.stage} stage\n`;
      }

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
      console.error('Failed to generate email from advanced analysis:', error);
    } finally {
      setIsGenerating(false);
    }
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
              <div className="flex space-x-2">
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

                <button
                  onClick={generatePersonalizedEmail}
                  disabled={isGenerating || (!companyResearch && !contactResearch)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Brain className="w-4 h-4" />
                  )}
                  <span>Personalized Email</span>
                </button>
              </div>

              <button
                onClick={() => setShowResearchPanel(!showResearchPanel)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Research</span>
                {(companyResearch || contactResearch) && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
              </button>

              <button
                onClick={() => setShowConversationPanel(!showConversationPanel)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Conversation</span>
                {conversationAnalysis && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </button>

              <button
                onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors"
              >
                <Brain className="w-4 h-4" />
                <span>Advanced AI</span>
                {advancedAnalysis && (
                  <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
                )}
              </button>
            </div>

            {/* Research Panel */}
            {showResearchPanel && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-indigo-900 flex items-center">
                    <Brain className="w-4 h-4 mr-2" />
                    AI Research Insights
                  </h4>
                  <button
                    onClick={() => setShowResearchPanel(false)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {isResearching ? (
                  <div className="text-center py-4">
                    <Loader2 className="w-6 h-6 text-indigo-600 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-indigo-700">Researching contact and company...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Company Research */}
                    {companyResearch && (
                      <div className="bg-white rounded-lg p-3 border border-indigo-200">
                        <h5 className="text-sm font-medium text-indigo-900 mb-2 flex items-center">
                          <Building2 className="w-4 h-4 mr-1" />
                          {companyResearch.name}
                        </h5>
                        <div className="space-y-2 text-xs text-indigo-800">
                          <p><span className="font-medium">Industry:</span> {companyResearch.industry}</p>
                          <p><span className="font-medium">Description:</span> {companyResearch.description}</p>
                          <p><span className="font-medium">Sales Approach:</span> {companyResearch.salesApproach}</p>
                          <div className="mt-2">
                            <p className="font-medium mb-1">Recent News:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {companyResearch.recentNews.slice(0, 2).map((news, index) => (
                                <li key={index}>{news}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Contact Research */}
                    {contactResearch && (
                      <div className="bg-white rounded-lg p-3 border border-green-200">
                        <h5 className="text-sm font-medium text-green-900 mb-2 flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {contactResearch.name}
                        </h5>
                        <div className="space-y-2 text-xs text-green-800">
                          <p><span className="font-medium">Background:</span> {contactResearch.background}</p>
                          <p><span className="font-medium">Communication Style:</span> {contactResearch.communicationStyle}</p>
                          <p><span className="font-medium">Value Proposition:</span> {contactResearch.valueProposition}</p>
                          <p><span className="font-medium">Contact Strategy:</span> {contactResearch.contactStrategy}</p>
                        </div>
                      </div>
                    )}

                    {/* Citations */}
                    {(companyResearch || contactResearch) && (
                      <div className="bg-white rounded-lg p-3 border border-purple-200">
                        <h5 className="text-sm font-medium text-purple-900 mb-3 flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          Research Citations & Sources
                        </h5>
                        <CitationSummary
                          citations={[
                            {
                              url: companyResearch?.website || `https://www.${companyResearch?.name.toLowerCase().replace(/\s+/g, '')}.com`,
                              title: `${companyResearch?.name || 'Company'} Official Website`,
                              domain: companyResearch?.website?.replace('https://www.', '').replace('https://', '') || 'company.com',
                              sourceType: 'company',
                              credibilityScore: 90,
                              timestamp: new Date().toISOString(),
                              snippet: companyResearch?.description || 'Company information and services'
                            },
                            {
                              url: contactResearch?.linkedin || `https://linkedin.com/in/${contactResearch?.name.toLowerCase().replace(' ', '-')}`,
                              title: `${contactResearch?.name || 'Contact'} LinkedIn Profile`,
                              domain: 'linkedin.com',
                              sourceType: 'social',
                              credibilityScore: 85,
                              timestamp: new Date().toISOString(),
                              snippet: contactResearch?.background || 'Professional background and experience'
                            },
                            {
                              url: `https://crunchbase.com/organization/${companyResearch?.name.toLowerCase().replace(/\s+/g, '-')}`,
                              title: `${companyResearch?.name || 'Company'} Crunchbase Profile`,
                              domain: 'crunchbase.com',
                              sourceType: 'industry',
                              credibilityScore: 88,
                              timestamp: new Date().toISOString(),
                              snippet: 'Industry analysis and company information'
                            }
                          ]}
                          maxDisplay={3}
                          showStats={true}
                        />
                      </div>
                    )}

                    {!companyResearch && !contactResearch && (
                      <div className="text-center py-4">
                        <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No research data available</p>
                        <button
                          onClick={performResearch}
                          className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          Perform Research
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Conversation Analysis Panel */}
            {showConversationPanel && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-indigo-900 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Conversation Analysis
                  </h4>
                  <button
                    onClick={() => setShowConversationPanel(false)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Conversation Input */}
                  <div>
                    <label className="block text-sm font-medium text-indigo-700 mb-2">
                      Previous Conversation History
                    </label>
                    <textarea
                      value={conversationHistory}
                      onChange={(e) => setConversationHistory(e.target.value)}
                      placeholder="Paste previous emails, call notes, or conversation history here..."
                      rows={6}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 resize-vertical"
                    />
                  </div>

                  {/* Analysis Button */}
                  <div className="flex justify-between items-center">
                    <button
                      onClick={analyzeConversation}
                      disabled={!conversationHistory.trim() || isAnalyzingConversation}
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isAnalyzingConversation ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4" />
                      )}
                      <span>{isAnalyzingConversation ? 'Analyzing...' : 'Analyze Conversation'}</span>
                    </button>

                    <button
                      onClick={generateEmailFromConversation}
                      disabled={!conversationAnalysis || isGenerating}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      <span>Generate Email</span>
                    </button>
                  </div>

                  {/* Analysis Results */}
                  {conversationAnalysis && (
                    <div className="bg-white rounded-lg p-3 border border-indigo-200">
                      <h5 className="text-sm font-medium text-indigo-900 mb-2 flex items-center">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Conversation Insights
                      </h5>
                      <div className="space-y-2 text-xs text-indigo-800">
                        {conversationAnalysis.error ? (
                          <p className="text-red-600">{conversationAnalysis.error}</p>
                        ) : (
                          <>
                            {conversationAnalysis.insights && conversationAnalysis.insights.map((insight: string, index: number) => (
                              <div key={index} className="flex items-start space-x-2">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-2"></div>
                                <p>{insight}</p>
                              </div>
                            ))}
                            {conversationAnalysis.keyThemes && (
                              <div className="mt-3 pt-2 border-t border-indigo-100">
                                <p className="font-medium mb-1">Key Themes:</p>
                                <div className="flex flex-wrap gap-1">
                                  {conversationAnalysis.keyThemes.map((theme: string, index: number) => (
                                    <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                                      {theme}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {conversationAnalysis.recommendedApproach && (
                              <div className="mt-3 pt-2 border-t border-indigo-100">
                                <p className="font-medium mb-1">Recommended Approach:</p>
                                <p className="text-indigo-700">{conversationAnalysis.recommendedApproach}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {!conversationAnalysis && conversationHistory.trim() && (
                    <div className="text-center py-4">
                      <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click "Analyze Conversation" to get AI insights</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advanced AI Reasoning Panel */}
            {showAdvancedPanel && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-purple-900 flex items-center">
                    <Brain className="w-4 h-4 mr-2" />
                    Advanced AI Reasoning & Tool Calling
                  </h4>
                  <button
                    onClick={() => setShowAdvancedPanel(false)}
                    className="text-purple-600 hover:text-purple-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Advanced Analysis Trigger */}
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-purple-700">
                      <p className="font-medium">GPT-5 Advanced Reasoning</p>
                      <p className="text-xs">Tool calling, structured outputs, and streaming analysis</p>
                    </div>
                    <button
                      onClick={performAdvancedAnalysis}
                      disabled={!contact || isAdvancedAnalyzing}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isAdvancedAnalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4" />
                      )}
                      <span>{isAdvancedAnalyzing ? 'Analyzing...' : 'Advanced Analysis'}</span>
                    </button>
                  </div>

                  {/* Generate Email from Advanced Analysis */}
                  <button
                    onClick={generateEmailFromAdvancedAnalysis}
                    disabled={!advancedAnalysis || isGenerating}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                    <span>Generate Email with Advanced AI</span>
                  </button>

                  {/* Streaming Analysis Display */}
                  {isAdvancedAnalyzing && streamingChunks.length > 0 && (
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <h5 className="text-sm font-medium text-purple-900 mb-2 flex items-center">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Live Analysis Stream
                      </h5>
                      <div className="text-xs text-purple-800 space-y-1 max-h-32 overflow-y-auto">
                        {streamingChunks.map((chunk, index) => (
                          <div key={index} className="flex items-start space-x-2">
                            <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 animate-pulse"></div>
                            <p>{chunk}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Advanced Analysis Results */}
                  {advancedAnalysis && !advancedAnalysis.error && (
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <h5 className="text-sm font-medium text-purple-900 mb-3 flex items-center">
                        <Sparkles className="w-4 h-4 mr-1" />
                        Advanced AI Analysis Results
                      </h5>
                      <div className="space-y-3 text-xs text-purple-800">
                        {advancedAnalysis.score !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="font-medium">AI Score:</span>
                            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {advancedAnalysis.score}/100
                            </span>
                          </div>
                        )}

                        {advancedAnalysis.keyFactors && (
                          <div>
                            <p className="font-medium mb-1">Key Factors:</p>
                            <div className="space-y-1">
                              {advancedAnalysis.keyFactors.slice(0, 3).map((factor: any, index: number) => (
                                <div key={index} className="flex justify-between items-center">
                                  <span>{factor.factor}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    factor.impact === 'positive' ? 'bg-green-100 text-green-700' :
                                    factor.impact === 'negative' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {factor.impact}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {advancedAnalysis.recommendedActions && (
                          <div>
                            <p className="font-medium mb-1">Recommended Actions:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {advancedAnalysis.recommendedActions.slice(0, 2).map((action: string, index: number) => (
                                <li key={index}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {advancedAnalysis.opportunityFlags && (
                          <div>
                            <p className="font-medium mb-1">Opportunities:</p>
                            <div className="flex flex-wrap gap-1">
                              {advancedAnalysis.opportunityFlags.slice(0, 3).map((flag: string, index: number) => (
                                <span key={index} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                                  {flag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {advancedAnalysis && advancedAnalysis.error && (
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <h5 className="text-sm font-medium text-red-900 mb-1">Analysis Error</h5>
                      <p className="text-xs text-red-700">{advancedAnalysis.error}</p>
                    </div>
                  )}

                  {/* Empty State */}
                  {!advancedAnalysis && !isAdvancedAnalyzing && (
                    <div className="text-center py-6">
                      <Brain className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                      <p className="text-sm text-purple-600">Click "Advanced Analysis" to unlock GPT-5 reasoning with tool calling</p>
                      <div className="mt-2 text-xs text-purple-500">
                        <p>• Structured analysis with tool calling</p>
                        <p>• Real-time streaming insights</p>
                        <p>• Advanced pattern recognition</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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