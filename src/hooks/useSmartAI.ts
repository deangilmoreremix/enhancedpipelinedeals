import { useState } from 'react';
import { Contact } from '../types/contact';
import { AIContactAnalysis } from '../types/contact';
import { getEnhancedIntelligentAI } from '../services/enhancedIntelligentAIService';

interface SmartAIHook {
  smartScoreContact: (contactId: string, contact: Contact, priority: 'low' | 'medium' | 'high') => Promise<AIContactAnalysis>;
  isAnalyzing: boolean;
  isEnhanced: boolean;
}

export const useSmartAI = (): SmartAIHook => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const intelligentAI = getEnhancedIntelligentAI();

  const smartScoreContact = async (
    contactId: string, 
    contact: Contact, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<AIContactAnalysis> => {
    setIsAnalyzing(true);
    
    try {
      console.log(`🧠 Enhanced Smart AI: Analyzing ${contact.name} with priority ${priority}`);
      
      // Map priority to AI service priority
      const aiPriority = priority === 'high' ? 'quality' : 
                       priority === 'medium' ? 'quality' : 'speed';
      
      // Use enhanced intelligent AI service
      const analysis = await intelligentAI.analyzeContact(contact, aiPriority);
      
      return {
        score: analysis.score,
        insights: analysis.insights || [],
        recommendations: analysis.recommendations || [],
        riskFactors: analysis.riskFactors || []
      };
    } catch (error) {
      console.error('Enhanced smart AI analysis failed:', error);
      
      // Fallback to basic analysis
      return {
        score: 60,
        insights: ['Basic analysis available'],
        recommendations: ['Schedule follow-up meeting'],
        riskFactors: ['AI analysis temporarily unavailable']
      };
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    smartScoreContact,
    isAnalyzing,
    isEnhanced: true
  };
};