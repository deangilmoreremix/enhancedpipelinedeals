import React, { useState, useEffect } from 'react';
import { validateAPIConfig } from '../../config/apiConfig';
import { CheckCircle, XCircle, AlertCircle, Settings, Wifi, WifiOff, Brain, Sparkles, Zap, Bot } from 'lucide-react';

export const APIStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<{ configured: string[]; missing: string[] }>({ configured: [], missing: [] });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setStatus(validateAPIConfig());
  }, []);

  const allConfigured = status.missing.length === 0;
  const someConfigured = status.configured.length > 0;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="relative">
        {/* Status Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200
            ${allConfigured 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : someConfigured 
              ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
              : 'bg-red-100 text-red-700 border border-red-200'
            }
          `}
        >
          {allConfigured ? (
            <Brain className="w-4 h-4" />
          ) : someConfigured ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            Intelligent AI
          </span>
        </button>

        {/* Expanded Status Panel */}
        {isExpanded && (
          <div className="absolute bottom-full left-0 mb-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Bot className="w-4 h-4 mr-2" />
                Intelligent AI System
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* AI Intelligence Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-4 border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                <Brain className="w-4 h-4 mr-1" />
                🤖 Smart AI Routing
              </h4>
              <p className="text-xs text-blue-800 mb-2">
                System automatically chooses the best AI model for each task:
              </p>
              <div className="grid grid-cols-1 gap-1 text-xs">
                <div className="flex items-center space-x-2">
                  <Brain className="w-3 h-3 text-blue-600" />
                  <span><strong>Company Research:</strong> Gemini Pro</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-3 h-3 text-green-600" />
                  <span><strong>Email Generation:</strong> OpenAI GPT-4o</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span><strong>Deal Analysis:</strong> Gemma 27B</span>
                </div>
              </div>
            </div>

            {/* Model Categories */}
            <div className="space-y-4">
              {/* Gemini & Gemma Models */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Brain className="w-4 h-4 mr-1" />
                  Google AI Models
                </h4>
                <div className="space-y-2 ml-5">
                  {status.configured.includes('Gemma AI') ? (
                    <div className="text-sm text-green-600 mb-2">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">✅ Active & Auto-Routing</span>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 mb-2">
                      <XCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">❌ Not Configured</span>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Auto-Selected Models:</p>
                    <div className="grid grid-cols-1 gap-1">
                      <div className="text-xs text-blue-600">
                        <Brain className="w-3 h-3 inline mr-1" />
                        <span className="font-medium">Gemini Pro:</span> Complex research & analysis
                      </div>
                      <div className="text-xs text-green-600">
                        <Zap className="w-3 h-3 inline mr-1" />
                        <span className="font-medium">Gemini Flash:</span> Fast contact research
                      </div>
                      <div className="text-xs text-purple-600">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        <span className="font-medium">Gemma Models:</span> Structured business analysis
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* OpenAI Models */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Zap className="w-4 h-4 mr-1" />
                  OpenAI Models
                </h4>
                <div className="space-y-2 ml-5">
                  {status.configured.includes('OpenAI GPT') ? (
                    <div className="text-sm text-green-600 mb-2">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">✅ Active & Auto-Routing</span>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 mb-2">
                      <XCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">❌ Not Configured</span>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Auto-Selected For:</p>
                    <div className="text-xs text-blue-600">
                      <Zap className="w-3 h-3 inline mr-1" />
                      Email writing, creative insights, pattern recognition
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <h5 className="text-xs font-medium text-gray-700 mb-2">🔄 Intelligent Routing Status:</h5>
              <div className="space-y-1 text-xs">
                {allConfigured ? (
                  <p className="text-green-600">✅ All AI models available - Full intelligent routing active</p>
                ) : someConfigured ? (
                  <p className="text-yellow-600">⚠️ Partial coverage - Some AI models available with fallbacks</p>
                ) : (
                  <p className="text-red-600">❌ No AI models configured - Mock responses only</p>
                )}
              </div>
            </div>

            {/* Help Text */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 mt-4">
              <p className="mb-2">
                <strong>🔧 To activate intelligent AI routing:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copy .env.example to .env</li>
                <li>Add your Gemini and/or OpenAI API keys</li>
                <li>Restart the application</li>
              </ol>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 flex flex-col space-y-2">
              <a
                href="https://ai.google.dev/gemini-api/docs/api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center"
              >
                <span className="mr-1">🧠</span> Get Gemini API Key for Gemma Models
              </a>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center"
              >
                <span className="mr-1">🤖</span> Get OpenAI API Key for GPT-5
              </a>
              <a
                href="https://ai.google.dev/gemma"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center"
              >
                <span className="mr-1">💎</span> Learn about GPT-5 + Gemma Integration
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};