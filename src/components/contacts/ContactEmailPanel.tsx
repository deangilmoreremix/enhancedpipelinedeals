import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { ModernButton } from '../ui/ModernButton';
import {
  Mail,
  Send,
  Save,
  RefreshCw,
  Eye,
  Edit,
  Calendar,
  Clock,
  User,
  Building2,
  Sparkles,
  Brain,
  Zap,
  FileText,
  Paperclip,
  Star,
  Trash2
} from 'lucide-react';

interface ContactEmailPanelProps {
  contact: Contact;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'introduction' | 'follow-up' | 'proposal' | 'closing';
}

const sampleTemplates: EmailTemplate[] = [
  {
    id: '1',
    name: 'Introduction Email',
    subject: 'Introduction - [Your Company]',
    body: `Hi {{firstName}},

I hope this email finds you well. I'm reaching out from [Your Company] as I believe our solutions could benefit {{company}}.

Based on your role as {{title}}, I think you'd be interested in how we help companies like yours achieve their goals.

Would you be available for a brief 15-minute call this week?

Best regards,
[Your Name]`,
    category: 'introduction'
  },
  {
    id: '2',
    name: 'Follow-up Email',
    subject: 'Following up on our conversation',
    body: `Hi {{firstName}},

Thank you for taking the time to speak with me about {{company}}'s needs. 

As discussed, I'm attaching some additional information that might be helpful for your evaluation.

Please let me know if you have any questions or if you'd like to schedule a follow-up meeting.

Best regards,
[Your Name]`,
    category: 'follow-up'
  }
];

export const ContactEmailPanel: React.FC<ContactEmailPanelProps> = ({ contact }) => {
  const [activeTab, setActiveTab] = useState<'compose' | 'templates' | 'history'>('compose');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const generateAIEmail = async () => {
    setIsGenerating(true);
    try {
      // Simulate AI generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const generatedSubject = `Partnership opportunity with ${contact.company}`;
      const generatedBody = `Hi ${contact.firstName},

I hope this email finds you well. I wanted to reach out regarding a potential partnership opportunity between our companies.

Given your role as ${contact.title} at ${contact.company}, I believe our solution could provide significant value to your team by:

• Streamlining your current processes
• Reducing operational costs by up to 30%
• Improving team productivity and efficiency

I'd love to schedule a brief call to discuss how we can help ${contact.company} achieve its objectives.

Would you be available for a 15-minute conversation this week?

Best regards,
[Your Name]

P.S. I've attached a case study from a similar company in the ${contact.industry || 'industry'} space that saw remarkable results.`;

      setSubject(generatedSubject);
      setBody(generatedBody);
    } catch (error) {
      console.error('Failed to generate email:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const useTemplate = (template: EmailTemplate) => {
    let populatedSubject = template.subject;
    let populatedBody = template.body;

    // Replace placeholders
    const replacements = {
      '{{firstName}}': contact.firstName || contact.name.split(' ')[0],
      '{{lastName}}': contact.lastName || contact.name.split(' ').slice(1).join(' '),
      '{{company}}': contact.company,
      '{{title}}': contact.title,
      '{{industry}}': contact.industry || 'industry'
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      populatedSubject = populatedSubject.replace(new RegExp(placeholder, 'g'), value);
      populatedBody = populatedBody.replace(new RegExp(placeholder, 'g'), value);
    });

    setSubject(populatedSubject);
    setBody(populatedBody);
    setSelectedTemplate(template);
    setActiveTab('compose');
  };

  const sendEmail = () => {
    const mailtoLink = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  };

  const tabs = [
    { id: 'compose', label: 'Compose', icon: Edit },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'history', label: 'History', icon: Clock }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-900">Email Communication</h3>
        <div className="flex items-center space-x-3">
          <ModernButton
            variant="primary"
            onClick={generateAIEmail}
            loading={isGenerating}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600"
          >
            <Brain className="w-4 h-4" />
            <span>AI Generate</span>
            <Sparkles className="w-3 h-3 text-yellow-300" />
          </ModernButton>
        </div>
      </div>

      {/* Contact Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900">{contact.name}</h4>
              <p className="text-blue-700 text-sm">{contact.title} at {contact.company}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-auto">
            <Mail className="w-4 h-4 text-blue-600" />
            <span className="text-blue-800 font-medium">{contact.email}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 border-l border-r border-t border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {activeTab === 'compose' && (
          <div className="p-6 space-y-4">
            {/* Selected Template Indicator */}
            {selectedTemplate && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-green-800 font-medium">Using template: {selectedTemplate.name}</span>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-green-600 hover:text-green-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Email Form */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To:</label>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {contact.firstName ? contact.firstName[0] : contact.name[0]}
                    </span>
                  </div>
                  <span className="font-medium">{contact.name}</span>
                  <span className="text-gray-500">&lt;{contact.email}&gt;</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email subject..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message:</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Compose your email..."
              />
            </div>

            {/* Email Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-3">
                <ModernButton variant="outline" size="sm">
                  <Paperclip className="w-4 h-4 mr-2" />
                  Attach
                </ModernButton>
                <ModernButton variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </ModernButton>
                <ModernButton variant="outline" size="sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </ModernButton>
              </div>
              <div className="flex items-center space-x-3">
                <ModernButton variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </ModernButton>
                <ModernButton
                  variant="primary"
                  onClick={sendEmail}
                  disabled={!subject || !body}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </ModernButton>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sampleTemplates.map(template => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{template.name}</h4>
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full capitalize mt-1">
                        {template.category}
                      </span>
                    </div>
                    <Star className="w-5 h-5 text-gray-300 hover:text-yellow-500 cursor-pointer" />
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700">Subject:</p>
                    <p className="text-sm text-gray-600 italic">{template.subject}</p>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 line-clamp-3">{template.body.substring(0, 150)}...</p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <ModernButton
                      variant="primary"
                      size="sm"
                      onClick={() => useTemplate(template)}
                      className="flex-1"
                    >
                      Use Template
                    </ModernButton>
                    <ModernButton variant="outline" size="sm">
                      <Eye className="w-4 h-4" />
                    </ModernButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6">
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-700 mb-2">No Email History</h4>
              <p className="text-gray-500">
                Email communication history with {contact.name} will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};