import React, { useState } from 'react';
import { Contact } from '../../types/contact';
import { ModernButton } from '../ui/ModernButton';
import { 
  FileText, 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Brain,
  Sparkles,
  Loader2,
  Target,
  Award
} from 'lucide-react';

interface DetailedScoreAnalysisPanelProps {
  contact: Contact;
  onUpdate: (id: string, updates: Partial<Contact>) => Promise<Contact>;
}

export const DetailedScoreAnalysisPanel: React.FC<DetailedScoreAnalysisPanelProps> = ({
  contact,
  onUpdate
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAnalysis = async () => {
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
            aiScore: contact.aiScore
          },
          taskType: 'detailed-score-analysis'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Analysis generation failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Extract analysis from AI response
      let analysis;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        analysis = JSON.parse(data.choices[0].message.content);
      } else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        analysis = JSON.parse(data.candidates[0].content.parts[0].text);
      } else {
        throw new Error('Invalid response format from AI service');
      }

      // Add generation timestamp
      analysis.generatedAt = new Date();
      
      await onUpdate(contact.id, { aiScoreRationale: analysis });
    } catch (error) {
      console.error('Failed to generate detailed score analysis:', error);
      
      // Fallback analysis
      const fallbackAnalysis = {
        score: contact.aiScore || 60,
        narrative: `Basic analysis for ${contact.name}. Enhanced AI analysis temporarily unavailable.`,
        keyFactors: [
          {
            factor: 'Basic Data Available',
            impact: 'neutral',
            weight: 50,
            explanation: 'Standard contact information is available for analysis.'
          }
        ],
        warningFlags: ['Enhanced analysis unavailable'],
        opportunityFlags: ['Contact ready for engagement'],
        recommendedActions: ['Schedule follow-up', 'Research company needs'],
        generatedAt: new Date(),
        aiProvider: 'Fallback Analysis'
      };
      
      await onUpdate(contact.id, { aiScoreRationale: fallbackAnalysis });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Detailed Score Analysis</h2>
            <p className="text-gray-600">AI-powered detailed analysis of contact scoring factors</p>
          </div>
        </div>
        
        {!contact.aiScoreRationale && (
          <ModernButton
            onClick={handleGenerateAnalysis}
            loading={isGenerating}
            variant="primary"
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            <Brain className="w-4 h-4 mr-2" />
            Generate Analysis
            <Sparkles className="w-3 h-3 ml-2 text-yellow-300" />
          </ModernButton>
        )}
      </div>

      {contact.aiScoreRationale ? (
        <div className="space-y-6">
          {/* Score Overview */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-blue-900">Score Overview</h3>
              <div className="flex items-center space-x-3">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl ${
                  contact.aiScoreRationale.score >= 80 ? 'bg-green-500' :
                  contact.aiScoreRationale.score >= 60 ? 'bg-blue-500' :
                  contact.aiScoreRationale.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  {contact.aiScoreRationale.score}
                </div>
                <span className="text-sm text-blue-600">
                  {contact.aiScoreRationale.aiProvider}
                </span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Analysis Narrative</h4>
              <p className="text-blue-800 leading-relaxed">{contact.aiScoreRationale.narrative}</p>
            </div>
          </div>

          {/* Key Factors */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Scoring Factors Analysis
            </h3>
            
            <div className="space-y-4">
              {contact.aiScoreRationale.keyFactors.map((factor, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{factor.factor}</h4>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        factor.impact === 'positive' ? 'bg-green-100 text-green-700' :
                        factor.impact === 'negative' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {factor.impact}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {factor.weight}% weight
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm">{factor.explanation}</p>
                  
                  {/* Visual weight indicator */}
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          factor.impact === 'positive' ? 'bg-green-500' :
                          factor.impact === 'negative' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`}
                        style={{ width: `${factor.weight}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opportunities & Warnings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Opportunity Flags */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Opportunity Flags
              </h3>
              <div className="space-y-3">
                {contact.aiScoreRationale.opportunityFlags.map((flag, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <p className="text-gray-900">{flag}</p>
                  </div>
                ))}
            {/* Warning Flags */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                Warning Flags
              </h3>
              <div className="space-y-3">
                {contact.aiScoreRationale.warningFlags.map((flag, index) => (
                  <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                    <p className="text-gray-900">{flag}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
              </div>
          {/* Recommended Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-blue-600" />
              Recommended Actions
            </h3>
            <div className="space-y-3">
              {contact.aiScoreRationale.recommendedActions.map((action, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                    {index + 1}
                  </div>
                  <p className="text-gray-900">{action}</p>
                </div>
              ))}
            </div>
          </div>
            </div>
          {/* Analysis Metadata */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Generated: {contact.aiScoreRationale.generatedAt.toLocaleDateString()}</span>
              <span>AI Provider: {contact.aiScoreRationale.aiProvider}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Detailed Analysis Available</h3>
          <p className="text-gray-500 mb-6">
            Generate a comprehensive score analysis to understand the factors behind {contact.name}'s AI score.
          </p>
          <ModernButton
            onClick={handleGenerateAnalysis}
            loading={isGenerating}
            variant="primary"
            className="bg-gradient-to-r from-blue-600 to-purple-600"
          >
            <Brain className="w-4 h-4 mr-2" />
            {isGenerating ? 'Generating Analysis...' : 'Generate Detailed Analysis'}
            <Sparkles className="w-3 h-3 ml-2 text-yellow-300" />
          </ModernButton>
        </div>
      )}
    </div>
  );
};