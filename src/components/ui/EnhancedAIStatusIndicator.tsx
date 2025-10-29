import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface AIStatus {
  isActive: boolean;
  operation?: string;
  progress?: number;
  status?: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
}

export const EnhancedAIStatusIndicator: React.FC = () => {
  const [aiStatus, setAiStatus] = useState<AIStatus>({
    isActive: false,
    status: 'idle'
  });

  useEffect(() => {
    const handleAIEvent = (event: CustomEvent<AIStatus>) => {
      setAiStatus(event.detail);
    };

    window.addEventListener('ai-status-change' as any, handleAIEvent);

    return () => {
      window.removeEventListener('ai-status-change' as any, handleAIEvent);
    };
  }, []);

  if (!aiStatus.isActive) {
    return null;
  }

  const getStatusIcon = () => {
    switch (aiStatus.status) {
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Brain className="w-5 h-5" />;
    }
  };

  const getStatusColor = () => {
    switch (aiStatus.status) {
      case 'processing':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-purple-500';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`${getStatusColor()} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 animate-in slide-in-from-bottom-4 duration-300`}>
        {getStatusIcon()}
        <div className="flex flex-col">
          {aiStatus.operation && (
            <span className="font-medium text-sm">{aiStatus.operation}</span>
          )}
          {aiStatus.message && (
            <span className="text-xs opacity-90">{aiStatus.message}</span>
          )}
        </div>
        {aiStatus.progress !== undefined && (
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">{aiStatus.progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
