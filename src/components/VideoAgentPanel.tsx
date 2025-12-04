import React, { useState } from 'react';
import { Video, Play, Square, Download, Upload, Settings, Wand2 } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';

export const VideoAgentPanel: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentVideo, setCurrentVideo] = useState('');

  const videoContent = [
    { id: 1, title: "Product Demo Overview", duration: "2:34", status: "completed", thumbnail: "🎬" },
    { id: 2, title: "Customer Success Story", duration: "1:45", status: "processing", thumbnail: "📈" },
    { id: 3, title: "Feature Walkthrough", duration: "3:12", status: "completed", thumbnail: "⚡" }
  ];

  const handleRecord = () => {
    setIsRecording(!isRecording);
  };

  const handleGenerateVideo = async () => {
    setIsGenerating(true);
    // Simulate video generation
    setTimeout(() => {
      setIsGenerating(false);
      setCurrentVideo("Video generated successfully!");
    }, 3000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Video className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            Video Agent
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            AI-powered video creation for engaging content
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <ModernButton variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </ModernButton>
        </div>
      </div>

      {/* Video Recording Section */}
      <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Record New Video</h4>
        <div className="flex items-center space-x-3">
          <ModernButton
            variant={isRecording ? "danger" : "primary"}
            size="sm"
            onClick={handleRecord}
            leftIcon={isRecording ? <Square className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </ModernButton>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {isRecording ? '🔴 Recording video...' : 'Click to record video content'}
          </div>
        </div>
      </div>

      {/* AI Video Generation */}
      <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">AI Video Generation</h4>
        <div className="space-y-3">
          <textarea
            placeholder="Describe the video you want to create..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option>Product Demo</option>
              <option>Customer Story</option>
              <option>Feature Overview</option>
              <option>Company Intro</option>
            </select>
            <select className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option>30 seconds</option>
              <option>60 seconds</option>
              <option>2 minutes</option>
              <option>5 minutes</option>
            </select>
          </div>
          <ModernButton
            variant="success"
            size="sm"
            onClick={handleGenerateVideo}
            disabled={isGenerating}
            leftIcon={<Wand2 className="w-4 h-4" />}
          >
            {isGenerating ? 'Generating...' : 'Generate Video'}
          </ModernButton>
          {currentVideo && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded">
              <p className="text-sm text-green-700 dark:text-green-300">{currentVideo}</p>
            </div>
          )}
        </div>
      </div>

      {/* Video Content Library */}
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Video Library</h4>
        <div className="space-y-3">
          {videoContent.map((video) => (
            <div key={video.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white text-lg">
                  {video.thumbnail}
                </div>
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white">{video.title}</h5>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{video.duration}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      video.status === 'completed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {video.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <ModernButton
                  variant="ghost"
                  size="sm"
                  leftIcon={<Play className="w-4 h-4" />}
                >
                  Play
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

        {/* Upload Section */}
        <div className="mt-4 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
          <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Upload existing video</p>
          <ModernButton variant="outline" size="sm">
            Choose File
          </ModernButton>
        </div>
      </div>
    </div>
  );
};