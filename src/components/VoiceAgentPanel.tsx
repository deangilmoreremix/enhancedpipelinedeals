import React, { useState } from 'react';
import { Mic, Play, Square, Download, Settings } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';

export const VoiceAgentPanel: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');

  const voiceMessages = [
    { id: 1, content: "Hi John, this is Sarah from SmartCRM. Just following up on the proposal we discussed.", duration: "0:32", status: "sent" },
    { id: 2, content: "Thanks for your time today. I'll send over the contract details within the hour.", duration: "0:28", status: "draft" },
    { id: 3, content: "Great news! Your account has been approved. Welcome to our platform.", duration: "0:35", status: "sent" }
  ];

  const handleRecord = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setCurrentMessage('');
    }
  };

  const handlePlay = (messageId: number) => {
    setIsPlaying(!isPlaying);
  };

  const handleGenerateVoice = async () => {
    // Simulate voice generation
    setTimeout(() => {
      setCurrentMessage("Voice message generated successfully!");
    }, 2000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Mic className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Voice Agent
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            AI-powered voice messaging for personalized outreach
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <ModernButton variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </ModernButton>
        </div>
      </div>

      {/* Voice Recording Section */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Record New Message</h4>
        <div className="flex items-center space-x-3">
          <ModernButton
            variant={isRecording ? "danger" : "primary"}
            size="sm"
            onClick={handleRecord}
            leftIcon={isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </ModernButton>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isRecording ? '🔴 Recording...' : 'Click to record voice message'}
          </div>
        </div>
        {currentMessage && (
          <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded border">
            <p className="text-sm text-gray-700 dark:text-gray-300">{currentMessage}</p>
          </div>
        )}
      </div>

      {/* AI Voice Generation */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">AI Voice Generation</h4>
        <div className="space-y-3">
          <textarea
            placeholder="Enter text to convert to voice..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            rows={3}
          />
          <div className="flex items-center space-x-3">
            <ModernButton
              variant="success"
              size="sm"
              onClick={handleGenerateVoice}
              leftIcon={<Play className="w-4 h-4" />}
            >
              Generate Voice
            </ModernButton>
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option>Sarah (Professional)</option>
              <option>Mike (Friendly)</option>
              <option>Emma (Enthusiastic)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Voice Messages History */}
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Voice Messages</h4>
        <div className="space-y-3">
          {voiceMessages.map((message) => (
            <div key={message.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex-1">
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{message.content}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{message.duration}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    message.status === 'sent'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {message.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-3">
                <ModernButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePlay(message.id)}
                  leftIcon={<Play className="w-4 h-4" />}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </ModernButton>
                <ModernButton
                  variant="ghost"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Download
                </ModernButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};