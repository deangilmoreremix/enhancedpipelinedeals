import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { ModernButton } from '../ui/ModernButton';
import { 
  Brain, 
  User, 
  MessageSquare, 
  Target, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  Clock,
  Lightbulb,
  Zap,
  Award,
  RefreshCw,
  Loader2,
  Sparkles,
  Eye,
  Edit,
  Save
} from 'lucide-react';

interface PsychologicalProfilePanelProps {
  contact: Contact;
  onUpdate: (id: string, updates: Partial<Contact>) => Promise<Contact>;
}

export const PsychologicalProfilePanel: React.FC<PsychologicalProfilePanelProps> = ({ 
  contact, 
  onUpdate 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerateProfile = async () => {
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
          taskType: 'psychological-profile'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Profile generation failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract profile from AI response
      let profile;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        profile = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        profile = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format from AI service');
      }

      // Add generation timestamp
      profile.generatedAt = new Date();
      
      await onUpdate(contact.id, { psychologicalProfile: profile });
    } catch (error) {
      console.error('Failed to generate psychological profile:', error);
      
      // Fallback to mock profile
      const fallbackProfile = {
        personalityTraits: ['Professional', 'Goal-oriented'],
        communicationStyle: 'formal' as const,
        decisionMakingStyle: 'analytical' as const,
        motivations: ['Business growth', 'Efficiency gains'],
        potentialObjections: ['Cost concerns', 'Implementation timeline'],
        psychologicalTriggers: ['ROI data', 'Case studies'],
        influenceLevel: 'medium' as const,
        riskTolerance: 'medium' as const,
        urgencyLevel: 'planned' as const,
        generatedAt: new Date(),
        confidence: 40
      };
      
      await onUpdate(contact.id, { psychologicalProfile: fallbackProfile });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Psychological Profile</h2>
            <p className="text-gray-600">AI-powered personality and behavioral analysis for {contact.name}</p>
          </div>
        </div>
        
        {!contact.psychologicalProfile && (
          <ModernButton
            onClick={handleGenerateProfile}
            loading={isGenerating}
            variant="primary"
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            <Brain className="w-4 h-4 mr-2" />
            Generate Profile
            <Sparkles className="w-3 h-3 ml-2 text-yellow-300" />
          </ModernButton>
        )}
      </div>

      {contact.psychologicalProfile ? (
        <div className="space-y-6">
          {/* Profile Overview */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-900">Profile Overview</h3>
              <span className="text-sm text-purple-600 bg-white px-3 py-1 rounded-full">
                {contact.psychologicalProfile.confidence}% confidence
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">Communication Style</h4>
                <p className="text-purple-800 capitalize">{contact.psychologicalProfile.communicationStyle}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">Decision Making</h4>
                <p className="text-purple-800 capitalize">{contact.psychologicalProfile.decisionMakingStyle}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-2">Influence Level</h4>
                <p className="text-purple-800 capitalize">{contact.psychologicalProfile.influenceLevel}</p>
              </div>
            </div>
          </div>

          {/* Personality Traits */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Personality Traits
            </h3>
            <div className="flex flex-wrap gap-2">
              {contact.psychologicalProfile.personalityTraits.map((trait, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>

          {/* Motivations & Triggers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-green-600" />
                Key Motivations
              </h3>
              <div className="space-y-3">
                {contact.psychologicalProfile.motivations.map((motivation, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <p className="text-gray-700">{motivation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-yellow-600" />
                Psychological Triggers
              </h3>
              <div className="space-y-3">
                {contact.psychologicalProfile.psychologicalTriggers.map((trigger, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-gray-700">{trigger}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Potential Objections */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
              Potential Objections
            </h3>
            <div className="space-y-3">
              {contact.psychologicalProfile.potentialObjections.map((objection, index) => (
                <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-gray-700">{objection}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk & Urgency Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">Risk Tolerance</h4>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    contact.psychologicalProfile.riskTolerance === 'high' ? 'bg-red-500' :
                    contact.psychologicalProfile.riskTolerance === 'medium' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}></div>
                  <span className="capitalize text-gray-900">{contact.psychologicalProfile.riskTolerance}</span>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">Urgency Level</h4>
                <div className="flex items-center space-x-2">
                  <Clock className={`w-4 h-4 ${
                    contact.psychologicalProfile.urgencyLevel === 'immediate' ? 'text-red-600' :
                    contact.psychologicalProfile.urgencyLevel === 'planned' ? 'text-yellow-600' :
                    'text-green-600'
                  }`} />
                  <span className="capitalize text-gray-900">{contact.psychologicalProfile.urgencyLevel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Metadata */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Generated: {contact.psychologicalProfile.generatedAt.toLocaleDateString()}</span>
              <span>Confidence: {contact.psychologicalProfile.confidence}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Psychological Profile Available</h3>
          <p className="text-gray-500 mb-6">
            Generate a detailed psychological profile to understand {contact.name}'s personality, 
            communication preferences, and decision-making style.
          </p>
          <ModernButton
            onClick={handleGenerateProfile}
            loading={isGenerating}
            variant="primary"
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            <Brain className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating Profile...' : 'Generate Psychological Profile'}
            <Sparkles className="w-3 h-3 ml-2 text-yellow-300" />
          </ModernButton>
        </div>
      )}
    </div>
  );
};