import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { ModernButton } from '../ui/ModernButton';
import { 
  TrendingUp, 
  Activity, 
  MessageCircle, 
  Clock, 
  AlertTriangle,
  Brain,
  Sparkles,
  Loader2,
  Target,
  CheckCircle,
  Users,
  Calendar
} from 'lucide-react';

interface BehavioralInsightsPanelProps {
  contact: Contact;
  onUpdate: (id: string, updates: Partial<Contact>) => Promise<Contact>;
}

export const BehavioralInsightsPanel: React.FC<BehavioralInsightsPanelProps> = ({
  contact,
  onUpdate
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateInsights = async () => {
    setIsGenerating(true);
    try {
      // Call the contact-analyzer edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/contact-analyzer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          contact: {
            name: contact.name,
            title: contact.title,
            company: contact.company,
            industry: contact.industry,
            status: contact.status,
            interestLevel: contact.interestLevel,
            sources: contact.sources,
            notes: contact.notes,
            lastConnected: contact.lastConnected
          },
          taskType: 'behavioral-insights'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Insights generation failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract insights from AI response
      let insights;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        insights = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        insights = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format from AI service');
      }
      
      await onUpdate(contact.id, { behavioralInsights: insights });
    } catch (error) {
      console.error('Failed to generate behavioral insights:', error);
      
      // Fallback insights
      const fallbackInsights = {
        engagementPatterns: ['Professional engagement', 'Standard response patterns'],
        preferredChannels: ['Email', 'Phone'],
        responseTimings: ['Business hours'],
        contentPreferences: ['Industry insights', 'Business case studies'],
        buyingSignals: ['Professional engagement'],
        disengagementRisks: ['Limited analysis available'],
        bestContactTimes: ['Business hours (9 AM - 5 PM)'],
        engagementLevel: 50,
        responsePattern: 'Standard professional engagement',
        generatedAt: new Date().toISOString()
      };
      
      await onUpdate(contact.id, { behavioralInsights: fallbackInsights });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Behavioral Insights</h2>
            <p className="text-gray-600">AI-powered behavioral analysis and engagement patterns</p>
          </div>
        </div>
        
        {!contact.behavioralInsights && (
          <ModernButton
            onClick={handleGenerateInsights}
            loading={isGenerating}
            variant="primary"
            className="bg-gradient-to-r from-green-600 to-blue-600"
          >
            <Brain className="w-4 h-4 mr-2" />
            Generate Insights
            <Sparkles className="w-3 h-3 ml-2 text-yellow-300" />
          </ModernButton>
        )}
      </div>

      {contact.behavioralInsights ? (
        <div className="space-y-6">
          {/* Engagement Level */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200 p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-4">Engagement Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">Engagement Level</h4>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-600 h-3 rounded-full"
                      style={{ width: `${contact.behavioralInsights.engagementLevel}%` }}
                    ></div>
                  </div>
                  <span className="font-bold text-green-900">{contact.behavioralInsights.engagementLevel}%</span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">Response Pattern</h4>
                <p className="text-green-800">{contact.behavioralInsights.responsePattern}</p>
              </div>
            </div>
          </div>

          {/* Preferred Channels */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MessageCircle className="w-5 h-5 mr-2 text-blue-600" />
              Communication Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Preferred Channels</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {contact.behavioralInsights.preferredChannels.map((channel, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Best Contact Times</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {contact.behavioralInsights.bestContactTimes.map((time, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full flex items-center"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {time}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Content Preferences</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {contact.behavioralInsights.contentPreferences.map((content, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full"
                    >
                      {content}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Engagement Patterns */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-purple-600" />
              Engagement Patterns
            </h3>
            <div className="space-y-3">
              {contact.behavioralInsights.engagementPatterns.map((pattern, index) => (
                <div key={index} className="flex items-start space-x-2 p-3 bg-purple-50 rounded-lg">
                  <Activity className="w-4 h-4 text-purple-600 mt-0.5" />
                  <p className="text-gray-900">{pattern}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Buying Signals */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-green-600" />
              Buying Signals
            </h3>
            <div className="space-y-3">
              {contact.behavioralInsights.buyingSignals.map((signal, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                  <p className="text-gray-900">{signal}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Disengagement Risks */}
          {contact.behavioralInsights.disengagementRisks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                Disengagement Risks
              </h3>
              <div className="space-y-3">
                {contact.behavioralInsights.disengagementRisks.map((risk, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                    <p className="text-gray-900">{risk}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Timing Analysis */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Response Timing Insights
            </h3>
            <div className="space-y-3">
              {contact.behavioralInsights.responseTimings.map((timing, index) => (
                <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                  <p className="text-gray-900">{timing}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Behavioral Insights Available</h3>
          <p className="text-gray-500 mb-6">
            Generate behavioral insights to understand {contact.name}'s engagement patterns and communication preferences.
          </p>
          <ModernButton
            onClick={handleGenerateInsights}
            loading={isGenerating}
            variant="primary"
            className="bg-gradient-to-r from-green-600 to-blue-600"
          >
            <Brain className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating Insights...' : 'Generate Behavioral Analysis'}
            <Sparkles className="w-3 h-3 ml-2 text-yellow-300" />
          </ModernButton>
        </div>
      )}
    </div>
  );
};