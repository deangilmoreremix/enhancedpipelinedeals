lets /**
 * Voice Assistant Component using OpenAI Realtime API
 * Floating voice interface for CRM interactions
 */

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X, Loader2 } from 'lucide-react';
import { getVoiceAssistantService, VoiceEvent } from '../../services/voiceAssistantService';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  entityType?: 'contact' | 'deal' | 'company';
  entityId?: string;
  entityData?: any;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityData
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const voiceService = getVoiceAssistantService();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (isOpen) {
      initializeVoiceSession();
    } else {
      cleanupVoiceSession();
    }

    return () => {
      cleanupVoiceSession();
    };
  }, [isOpen]);

  useEffect(() => {
    // Set up event listeners
    const handleSessionStarted = (event: VoiceEvent) => {
      console.log('🎤 Voice session started:', event.sessionId);
      setSessionId(event.sessionId);
      setError(null);
    };

    const handleSessionEnded = (event: VoiceEvent) => {
      console.log('🎤 Voice session ended:', event.sessionId);
      setSessionId(null);
      setIsRecording(false);
      setIsProcessing(false);
    };

    const handleAudioReceived = (event: VoiceEvent) => {
      if (event.data?.transcript) {
        setTranscript(event.data.transcript);
        setIsProcessing(true);
      }
    };

    const handleFunctionCalled = (event: VoiceEvent) => {
      console.log('🔧 Function called via voice:', event.data);
      setIsProcessing(false);
      setResponse(`Executed: ${event.data.functionName}`);
    };

    const handleError = (event: VoiceEvent) => {
      console.error('🎤 Voice error:', event.data);
      setError(event.data?.error || 'Voice processing error');
      setIsProcessing(false);
    };

    voiceService.on('session_started', handleSessionStarted);
    voiceService.on('session_ended', handleSessionEnded);
    voiceService.on('audio_received', handleAudioReceived);
    voiceService.on('function_called', handleFunctionCalled);
    voiceService.on('error', handleError);

    return () => {
      voiceService.off('session_started', handleSessionStarted);
      voiceService.off('session_ended', handleSessionEnded);
      voiceService.off('audio_received', handleAudioReceived);
      voiceService.off('function_called', handleFunctionCalled);
      voiceService.off('error', handleError);
    };
  }, []);

  const initializeVoiceSession = async () => {
    try {
      setError(null);
      const newSessionId = await voiceService.startVoiceSession();
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Failed to start voice session:', error);
      setError('Failed to start voice session. Please check microphone permissions.');
    }
  };

  const cleanupVoiceSession = async () => {
    if (sessionId) {
      try {
        await voiceService.stopVoiceSession(sessionId);
      } catch (error) {
        console.error('Failed to stop voice session:', error);
      }
      setSessionId(null);
      setIsRecording(false);
      setIsProcessing(false);
      setTranscript('');
      setResponse('');
    }
  };

  const toggleRecording = async () => {
    if (!sessionId) return;

    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setIsProcessing(true);
    } else {
      // Start recording
      setIsRecording(true);
      setTranscript('');
      setResponse('');
      setError(null);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (isProcessing) return 'Processing...';
    if (isRecording) return 'Listening...';
    if (sessionId) return 'Ready to listen';
    return 'Initializing...';
  };

  const getStatusColor = () => {
    if (error) return 'text-red-400';
    if (isProcessing) return 'text-blue-400';
    if (isRecording) return 'text-green-400';
    if (sessionId) return 'text-gray-400';
    return 'text-yellow-400';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Main Voice Assistant Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                {isRecording ? (
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Volume2 className="w-4 h-4" />
                  </div>
                )}
                {isProcessing && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping"></div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-sm">Voice Assistant</h3>
                <p className={`text-xs ${getStatusColor()}`}>
                  {getStatusText()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Transcript */}
          {transcript && (
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">You said:</p>
              <p className="text-sm text-blue-900 dark:text-blue-100">{transcript}</p>
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
              <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">Assistant:</p>
              <p className="text-sm text-green-900 dark:text-green-100">{response}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-3">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">Error:</p>
              <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
            </div>
          )}

          {/* Voice Commands Help */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-2">Voice Commands:</p>
            <div className="grid grid-cols-1 gap-1 text-xs text-gray-500 dark:text-gray-500">
              {/* Contact Commands */}
              <div className="font-medium text-blue-600 dark:text-blue-400">Contacts:</div>
              <p>• "Analyze this contact" • "Enrich Sarah's data"</p>
              <p>• "Find contacts in California" • "Create new contact"</p>

              {/* Deal Commands */}
              <div className="font-medium text-green-600 dark:text-green-400">Deals:</div>
              <p>• "Analyze this deal" • "What's the probability?"</p>
              <p>• "Find deals over $50k" • "Update deal status"</p>

              {/* Communication */}
              <div className="font-medium text-purple-600 dark:text-purple-400">Communication:</div>
              <p>• "Email Sarah" • "Call John Smith"</p>
              <p>• "Generate proposal" • "Schedule meeting"</p>

              {/* Analytics */}
              <div className="font-medium text-orange-600 dark:text-orange-400">Analytics:</div>
              <p>• "Show pipeline health" • "Generate report"</p>
              <p>• "Team performance" • "Sales trends"</p>

              {/* Navigation */}
              <div className="font-medium text-red-600 dark:text-red-400">Navigation:</div>
              <p>• "Go to contacts" • "Show dashboard"</p>
              <p>• "Open analytics" • "Pipeline view"</p>

              {/* Data Management */}
              <div className="font-medium text-indigo-600 dark:text-indigo-400">Data:</div>
              <p>• "Import contacts" • "Export deals"</p>
              <p>• "Create record" • "Update information"</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4">
            {/* Record/Stop Button */}
            <button
              onClick={toggleRecording}
              disabled={!sessionId || isProcessing}
              className={`p-3 rounded-full transition-all duration-200 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse'
                  : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Mute/Unmute Button */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition-colors ${
                isMuted
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Context Info */}
          {(entityType || entityId) && (
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Context: {entityType} {entityId ? `(${entityId.slice(0, 8)}...)` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Audio Element (hidden) */}
        <audio ref={audioRef} className="hidden" />
      </div>

      {/* Voice Activity Indicator */}
      {isRecording && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
      )}
    </div>
  );
};

// Voice Assistant Button for integration
interface VoiceAssistantButtonProps {
  onClick: () => void;
  isActive: boolean;
  className?: string;
}

export const VoiceAssistantButton: React.FC<VoiceAssistantButtonProps> = ({
  onClick,
  isActive,
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all duration-200 relative ${
        isActive
          ? 'bg-blue-500 text-white shadow-lg'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      } ${className}`}
      title={isActive ? 'Voice Assistant Active' : 'Open Voice Assistant'}
    >
      <Mic className="w-4 h-4" />
      {isActive && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      )}
    </button>
  );
};

export default VoiceAssistant;