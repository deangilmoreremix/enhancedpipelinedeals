import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { BaseModal } from '../modals/BaseModal';
import { ContactAnalytics } from './ContactAnalytics';
import { ContactEmailPanel } from './ContactEmailPanel';
import { CommunicationHub } from './CommunicationHub';
import { AutomationPanel } from './AutomationPanel';
import { ContactJourneyTimeline } from './ContactJourneyTimeline';
import { AIInsightsPanel } from './AIInsightsPanel';
import { PsychologicalProfilePanel } from './PsychologicalProfilePanel';
import { DetailedScoreAnalysisPanel } from './DetailedScoreAnalysisPanel';
import { BehavioralInsightsPanel } from './BehavioralInsightsPanel';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Globe, 
  Calendar, 
  MessageSquare,
  BarChart3,
  Zap,
  Activity,
  Target,
  Brain,
  Eye,
  TrendingUp,
  FileText,
  Star,
  Heart,
  Edit,
  ExternalLink,
  Linkedin,
  Twitter,
  Facebook,
  Crown,
  Award,
  X
} from 'lucide-react';

interface ContactDetailViewProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Contact>) => Promise<Contact>;
}

export const ContactDetailView: React.FC<ContactDetailViewProps> = ({
  contact,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'psychology' | 'analysis' | 'behavior' | 'communication' | 'journey' | 'automation' | 'analytics'>('overview');
  const [showPsychProfile, setShowPsychProfile] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'psychology', label: 'Psychology', icon: Brain },
    { id: 'analysis', label: 'Score Analysis', icon: FileText },
    { id: 'behavior', label: 'Behavior', icon: TrendingUp },
    { id: 'communication', label: 'Communication', icon: MessageSquare },
    { id: 'journey', label: 'Journey', icon: Activity },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }
  ];

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer': return 'bg-green-100 text-green-800';
      case 'prospect': return 'bg-blue-100 text-blue-800';
      case 'lead': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInterestColor = (level: string) => {
    switch (level) {
      case 'hot': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'cold': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-6xl"
      showClose={false}
    >
      <div className="flex flex-col h-[85vh]">
        {/* Contact Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-start space-x-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg">
                {contact.avatarSrc ? (
                  <img 
                    src={contact.avatarSrc}
                    alt={contact.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                    <User className="w-10 h-10 text-white" />
                  </div>
                )}
              </div>
              
              {/* AI Enhancement Indicators */}
              {contact.psychologicalProfile && (
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center shadow-lg">
                  <Brain className="w-3 h-3 text-white" />
                </div>
              )}
              
              {contact.isFavorite && (
                <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <Heart className="w-3 h-3 text-white" />
                </div>
              )}
              
              {contact.isTeamMember && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                  <Crown className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
                {contact.aiScore && (
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    contact.aiScore >= 80 ? 'bg-green-500' :
                    contact.aiScore >= 60 ? 'bg-blue-500' :
                    contact.aiScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {contact.aiScore}
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-lg text-gray-600">{contact.title}</p>
                <p className="text-gray-500 flex items-center">
                  <Building2 className="w-4 h-4 mr-2" />
                  {contact.company}
                  {contact.industry && <span className="ml-2 text-sm">• {contact.industry}</span>}
                </p>
                
                <div className="flex items-center space-x-4 mt-3">
                  <a 
                    href={`mailto:${contact.email}`}
                    className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {contact.email}
                  </a>
                  
                  {contact.phone && (
                    <a 
                      href={`tel:${contact.phone}`}
                      className="flex items-center text-green-600 hover:text-green-800 transition-colors"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      {contact.phone}
                    </a>
                  )}
                </div>
                
                <div className="flex items-center space-x-3 mt-3">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(contact.status)}`}>
                    {contact.status}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getInterestColor(contact.interestLevel)}`}>
                    {contact.interestLevel} interest
                  </span>
                  {contact.lastConnected && (
                    <span className="text-sm text-gray-500 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Last connected: {contact.lastConnected}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Enhanced Insights Summary */}
        {(contact.psychologicalProfile || contact.aiScoreRationale || contact.behavioralInsights) && (
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contact.psychologicalProfile && (
                <div className="bg-white rounded-lg p-3 border border-purple-200">
                  <h4 className="text-sm font-semibold text-purple-900 mb-1 flex items-center">
                    <Brain className="w-4 h-4 mr-1" />
                    Psychological Profile
                  </h4>
                  <p className="text-xs text-purple-700">
                    {contact.psychologicalProfile.communicationStyle} • {contact.psychologicalProfile.decisionMakingStyle}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Confidence: {contact.psychologicalProfile.confidence}%
                  </p>
                </div>
              )}
              
              {contact.aiScoreRationale && (
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1 flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    Score Analysis
                  </h4>
                  <p className="text-xs text-blue-700">
                    {contact.aiScoreRationale.keyFactors.length} factors analyzed
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {contact.aiScoreRationale.opportunityFlags.length} opportunities • {contact.aiScoreRationale.warningFlags.length} warnings
                  </p>
                </div>
              )}
              
              {contact.behavioralInsights && (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <h4 className="text-sm font-semibold text-green-900 mb-1 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Behavioral Insights
                  </h4>
                  <p className="text-xs text-green-700">
                    {contact.behavioralInsights.preferredChannels.slice(0, 2).join(', ')}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {contact.behavioralInsights.buyingSignals.length} buying signals detected
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {/* Show indicators for available enhanced data */}
                {tab.id === 'psychology' && contact.psychologicalProfile && (
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                )}
                {tab.id === 'analysis' && contact.aiScoreRationale && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
                {tab.id === 'behavior' && contact.behavioralInsights && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Full Name</label>
                      <p className="text-gray-900">{contact.name}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <a href={`mailto:${contact.email}`} className="text-blue-600 hover:text-blue-800">
                        {contact.email}
                      </a>
                    </div>
                    
                    {contact.phone && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Phone</label>
                        <a href={`tel:${contact.phone}`} className="text-green-600 hover:text-green-800">
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <span className={`inline-block px-2 py-1 text-sm font-medium rounded-md ${getStatusColor(contact.status)}`}>
                        {contact.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Company</label>
                      <p className="text-gray-900">{contact.company}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Title</label>
                      <p className="text-gray-900">{contact.title}</p>
                    </div>
                    
                    {contact.industry && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Industry</label>
                        <p className="text-gray-900">{contact.industry}</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Interest Level</label>
                      <span className={`inline-block px-2 py-1 text-sm font-medium rounded-md ${getInterestColor(contact.interestLevel)}`}>
                        {contact.interestLevel}
                      </span>
                    </div>
                  </div>
                </div>
                
                {contact.notes && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <label className="text-sm font-medium text-gray-500 block mb-2">Notes</label>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* AI Enhancement Summary */}
              {(contact.psychologicalProfile || contact.aiScoreRationale || contact.behavioralInsights) && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Brain className="w-5 h-5 mr-2 text-purple-600" />
                    ChatGPT-5 Enhanced Intelligence
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {contact.psychologicalProfile && (
                      <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <h4 className="font-medium text-purple-900 mb-2">Psychological Profile</h4>
                        <div className="space-y-2 text-sm">
                          <p><span className="font-medium">Style:</span> {contact.psychologicalProfile.communicationStyle}</p>
                          <p><span className="font-medium">Decision:</span> {contact.psychologicalProfile.decisionMakingStyle}</p>
                          <p><span className="font-medium">Influence:</span> {contact.psychologicalProfile.influenceLevel}</p>
                        </div>
                      </div>
                    )}
                    
                    {contact.aiScoreRationale && (
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <h4 className="font-medium text-blue-900 mb-2">Score Analysis</h4>
                        <div className="space-y-2 text-sm">
                          <p><span className="font-medium">Score:</span> {contact.aiScoreRationale.score}/100</p>
                          <p><span className="font-medium">Factors:</span> {contact.aiScoreRationale.keyFactors.length} analyzed</p>
                          <p><span className="font-medium">Actions:</span> {contact.aiScoreRationale.recommendedActions.length} recommended</p>
                        </div>
                      </div>
                    )}
                    
                    {contact.behavioralInsights && (
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <h4 className="font-medium text-green-900 mb-2">Behavioral Profile</h4>
                        <div className="space-y-2 text-sm">
                          <p><span className="font-medium">Channels:</span> {contact.behavioralInsights.preferredChannels.slice(0, 2).join(', ')}</p>
                          <p><span className="font-medium">Signals:</span> {contact.behavioralInsights.buyingSignals.length} detected</p>
                          <p><span className="font-medium">Risks:</span> {contact.behavioralInsights.disengagementRisks.length} identified</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'psychology' && (
            <PsychologicalProfilePanel contact={contact} onUpdate={onUpdate} />
          )}

          {activeTab === 'analysis' && (
            <DetailedScoreAnalysisPanel contact={contact} onUpdate={onUpdate} />
          )}

          {activeTab === 'behavior' && (
            <BehavioralInsightsPanel contact={contact} onUpdate={onUpdate} />
          )}

          {activeTab === 'communication' && (
            <CommunicationHub contact={contact} />
          )}

          {activeTab === 'journey' && (
            <ContactJourneyTimeline contact={contact} />
          )}

          {activeTab === 'automation' && (
            <AutomationPanel contact={contact} />
          )}

          {activeTab === 'analytics' && (
            <ContactAnalytics contact={contact} />
          )}
        </div>
      </div>
    </BaseModal>
  );
};