/**
 * React hooks for Contact AI features
 * Provides easy integration with SmartAIOrchestrator for UI components
 */

import { useState, useCallback, useEffect } from 'react';
import { getContactAIService } from '../services/contactAIService';
import type {
  ContactAnalysisResult,
  LeadScoreResult,
  EmailComposeResult,
  WebResearchResult
} from '../services/contactAIService';
import type { SDRPersona } from '../services/smartAIOrchestrator';

interface UseContactAnalysisOptions {
  userId?: string;
  personaId?: string;
  onSuccess?: (result: ContactAnalysisResult) => void;
  onError?: (error: Error) => void;
}

export const useContactAnalysis = (options: UseContactAnalysisOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<ContactAnalysisResult | null>(null);

  const analyzeContact = useCallback(async (contactId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = getContactAIService();
      const analysisResult = await service.analyzeContact(
        contactId,
        options.userId,
        options.personaId
      );

      setResult(analysisResult);
      options.onSuccess?.(analysisResult);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Analysis failed');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  return {
    analyzeContact,
    result,
    isLoading,
    error,
    reset: () => {
      setResult(null);
      setError(null);
    }
  };
};

interface UseLeadScoringOptions {
  userId?: string;
  personaId?: string;
  onSuccess?: (result: LeadScoreResult) => void;
  onError?: (error: Error) => void;
}

export const useLeadScoring = (options: UseLeadScoringOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<LeadScoreResult | null>(null);

  const scoreLead = useCallback(async (
    contactId: string,
    scoringMode: 'SQL' | 'PQL' | 'MQL' = 'SQL'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = getContactAIService();
      const scoringResult = await service.scoreLead(
        contactId,
        scoringMode,
        options.userId,
        options.personaId
      );

      setResult(scoringResult);
      options.onSuccess?.(scoringResult);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Scoring failed');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const submitFeedback = useCallback(async (
    contactId: string,
    score: number,
    feedback: 'good' | 'bad'
  ) => {
    try {
      const service = getContactAIService();
      await service.submitAIScoreFeedback(contactId, score, feedback, options.userId);
    } catch (err) {
      console.warn('Failed to submit AI feedback:', err);
    }
  }, [options.userId]);

  return {
    scoreLead,
    submitFeedback,
    result,
    isLoading,
    error,
    reset: () => {
      setResult(null);
      setError(null);
    }
  };
};

interface UseEmailComposeOptions {
  userId?: string;
  personaId?: string;
  onSuccess?: (result: EmailComposeResult) => void;
  onError?: (error: Error) => void;
}

export const useEmailCompose = (options: UseEmailComposeOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<EmailComposeResult | null>(null);

  const composeEmail = useCallback(async (
    contactId: string,
    goal: string,
    tone: 'professional' | 'casual' | 'friendly' | 'formal' = 'professional'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = getContactAIService();
      const emailResult = await service.composeEmail(
        contactId,
        goal,
        tone,
        options.userId,
        options.personaId
      );

      setResult(emailResult);
      options.onSuccess?.(emailResult);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Email composition failed');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  return {
    composeEmail,
    result,
    isLoading,
    error,
    reset: () => {
      setResult(null);
      setError(null);
    }
  };
};

interface UseWebResearchOptions {
  userId?: string;
  personaId?: string;
  onSuccess?: (result: WebResearchResult) => void;
  onError?: (error: Error) => void;
}

export const useWebResearch = (options: UseWebResearchOptions = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<WebResearchResult | null>(null);

  const conductResearch = useCallback(async (contactId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = getContactAIService();
      const researchResult = await service.conductWebResearch(
        contactId,
        options.userId,
        options.personaId
      );

      setResult(researchResult);
      options.onSuccess?.(researchResult);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Web research failed');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  return {
    conductResearch,
    result,
    isLoading,
    error,
    reset: () => {
      setResult(null);
      setError(null);
    }
  };
};

export const useContactEnrichment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const enrichContact = useCallback(async (
    contactId: string,
    options: {
      includeSocialProfiles?: boolean;
      includeCompanyResearch?: boolean;
      userId?: string;
      personaId?: string;
    } = {}
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const service = getContactAIService();
      const result = await service.enrichContactData(
        contactId,
        options.includeSocialProfiles,
        options.includeCompanyResearch,
        options.userId,
        options.personaId
      );

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Contact enrichment failed');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    enrichContact,
    isLoading,
    error
  };
};

export const useSDRAssistant = () => {
  const [personas, setPersonas] = useState<SDRPersona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<SDRPersona | null>(null);

  useEffect(() => {
    const service = getContactAIService();
    setPersonas(service.getAvailablePersonas());
  }, []);

  const suggestPersona = useCallback((contactData: any, companyData: any) => {
    const service = getContactAIService();
    const suggested = service.suggestPersonaForLead(contactData, companyData);
    setSelectedPersona(suggested);
    return suggested;
  }, []);

  const getPersona = useCallback((personaId: string) => {
    const service = getContactAIService();
    return service.getPersona(personaId);
  }, []);

  return {
    personas,
    selectedPersona,
    setSelectedPersona,
    suggestPersona,
    getPersona
  };
};