/**
 * Enhanced Smart AI Hook with GPT-5 Integration
 * Provides advanced AI capabilities through the secure gateway
 */

import { useState } from 'react';
import { Contact } from '../types/contact';
import { getEnhancedIntelligentAI } from '../services/enhancedIntelligentAIService';

interface EnhancedSmartAIAnalysis {
  results: {
    contact_scoring: {
      score: number;
      insights: string[];
      recommendations: string[];
      confidence: number;
      reasoningPath?: string;
    };
    psychological_profile?: any;
    detailed_analysis?: any;
    behavioral_insights?: any;
  };
  aiProvider: string;
  enhancedFeatures: boolean;
}

interface EnhancedSmartAIHook {
  smartScoreContact: (contactId: string, contact: Contact, priority?: 'low' | 'medium' | 'high') => Promise<EnhancedSmartAIAnalysis>;
  generatePsychologicalProfile: (contactId: string, contact: Contact) => Promise<any>;
  generateDetailedScoreAnalysis: (contactId: string, contact: Contact) => Promise<any>;
  generateBehavioralInsights: (contactId: string, contact: Contact) => Promise<any>;
  isAnalyzing: boolean;
  isGeneratingProfile: boolean;
  isGeneratingBehavior: boolean;
  systemStatus: any;
}

export const useEnhancedSmartAI = (): EnhancedSmartAIHook => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [isGeneratingBehavior, setIsGeneratingBehavior] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  const intelligentAI = getEnhancedIntelligentAI();

  const smartScoreContact = async (
    contactId: string, 
    contact: Contact, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<EnhancedSmartAIAnalysis> => {
    setIsAnalyzing(true);
    
    try {
      console.log(`🧠 Enhanced Smart AI: Analyzing ${contact.name} with priority ${priority}`);
      
      // Map priority to AI service priority
      const aiPriority = priority === 'high' ? 'quality' : 
                       priority === 'medium' ? 'quality' : 'speed';
      
      // Get enhanced analysis using intelligent routing
      const analysis = await intelligentAI.analyzeContact(contact, aiPriority);
      
      // Check system status
      const status = await intelligentAI.getSystemStatus();
      setSystemStatus(status);
      
      return {
        results: {
          contact_scoring: {
            score: analysis.score,
            insights: analysis.insights,
            recommendations: analysis.recommendations,
            confidence: analysis.confidenceLevel || 85,
            reasoningPath: analysis.reasoningPath
          }
        },
        aiProvider: status.availableProviders.includes('openai') ? '🤖 GPT-5 Enhanced' : '🧠 Gemini 2.0',
        enhancedFeatures: true
      };
    } catch (error) {
      console.error('Enhanced smart AI analysis failed:', error);
      
      // Fallback to basic analysis
      return {
        results: {
          contact_scoring: {
            score: 60,
            insights: ['Basic analysis available'],
            recommendations: ['Schedule follow-up meeting'],
            confidence: 40
          }
        },
        aiProvider: '🔄 Fallback Mode',
        enhancedFeatures: false
      };
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generatePsychologicalProfile = async (contactId: string, contact: Contact): Promise<any> => {
    setIsGeneratingProfile(true);
    
    try {
      console.log(`🧠 Generating psychological profile for ${contact.name}`);
      
      // This would be implemented in the OpenAI service
      const analysis = await intelligentAI.executeTask('psychological-profile', contact, { priority: 'quality' });
      
      return analysis;
    } catch (error) {
      console.error('Failed to generate psychological profile:', error);
      throw error;
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const generateDetailedScoreAnalysis = async (contactId: string, contact: Contact): Promise<any> => {
    setIsAnalyzing(true);
    
    try {
      console.log(`📊 Generating detailed score analysis for ${contact.name}`);
      
      const analysis = await intelligentAI.executeTask('detailed-score-analysis', contact, { priority: 'quality' });
      
      return analysis;
    } catch (error) {
      console.error('Failed to generate detailed score analysis:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateBehavioralInsights = async (contactId: string, contact: Contact): Promise<any> => {
    setIsGeneratingBehavior(true);
    
    try {
      console.log(`🎯 Generating behavioral insights for ${contact.name}`);
      
      // This would be implemented as a specific task
      const insights = await intelligentAI.executeTask('behavioral-insights', contact, { priority: 'quality' });
      
      return insights;
    } catch (error) {
      console.error('Failed to generate behavioral insights:', error);
      throw error;
    } finally {
      setIsGeneratingBehavior(false);
    }
  };

  return {
    smartScoreContact,
    generatePsychologicalProfile,
    generateDetailedScoreAnalysis,
    generateBehavioralInsights,
    isAnalyzing,
    isGeneratingProfile,
    isGeneratingBehavior,
    systemStatus
  };
};