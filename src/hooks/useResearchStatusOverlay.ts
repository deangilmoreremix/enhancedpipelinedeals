import { useState, useEffect, useCallback } from 'react';
import { useAIResearch } from '../services/aiResearchService';

interface ResearchStatus {
  id: string;
  stage: 'researching' | 'analyzing' | 'synthesizing' | 'optimizing' | 'complete' | 'error';
  message: string;
  progress: number;
  timestamp: Date;
  sourceCount?: number;
  estimatedTimeRemaining?: number;
}

interface UseResearchStatusOverlayReturn {
  statuses: ResearchStatus[];
  isVisible: boolean;
  showOverlay: () => void;
  hideOverlay: () => void;
  clearCompleted: () => void;
  retryStatus: (statusId: string) => void;
}

export const useResearchStatusOverlay = (): UseResearchStatusOverlayReturn => {
  const [statuses, setStatuses] = useState<ResearchStatus[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const aiResearch = useAIResearch();

  useEffect(() => {
    // Subscribe to research status changes
    const unsubscribe = aiResearch.onStatusChange((newStatuses: ResearchStatus[]) => {
      setStatuses(newStatuses);

      // Auto-show overlay if there are active research operations
      const hasActiveResearch = newStatuses.some((status: ResearchStatus) =>
        status.stage !== 'complete' && status.stage !== 'error'
      );

      if (hasActiveResearch && !isVisible) {
        setIsVisible(true);
      }
    });

    return unsubscribe;
  }, [aiResearch, isVisible]);

  const showOverlay = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hideOverlay = useCallback(() => {
    setIsVisible(false);
  }, []);

  const clearCompleted = useCallback(() => {
    aiResearch.clearCompletedStatuses();
  }, [aiResearch]);

  const retryStatus = useCallback((statusId: string) => {
    // Find the failed status and retry the operation
    const failedStatus = statuses.find(s => s.id === statusId && s.stage === 'error');
    if (failedStatus) {
      // Extract operation details from status ID
      if (statusId.startsWith('company-')) {
        const companyName = statusId.replace('company-', '').split('-')[0];
        aiResearch.researchCompany(companyName);
      } else if (statusId.startsWith('contact-')) {
        const personName = statusId.replace('contact-', '').split('-')[0];
        aiResearch.findContactPerson(personName);
      }
    }
  }, [statuses, aiResearch]);

  return {
    statuses,
    isVisible,
    showOverlay,
    hideOverlay,
    clearCompleted,
    retryStatus
  };
};