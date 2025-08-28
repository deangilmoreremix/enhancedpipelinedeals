import React, { useState, useEffect } from 'react';
import { getEnhancedIntelligentAI } from '../../services/enhancedIntelligentAIService';
import { CheckCircle, XCircle, AlertCircle, Brain, Sparkles, Zap, Bot, RefreshCw, Settings } from 'lucide-react';

export const EnhancedAIStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<{
    status: string;
    availableProviders: string[];
    routing?: any[];
    error?: string;
  }>({ status: 'checking', availableProviders: [] });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const intelligentAI = getEnhancedIntelligentAI();

  const checkSystemStatus = async () => {
    setIsRefreshing(true);
    try {
      const systemStatus = await intelligentAI.getSystemStatus();
      setStatus({
        status: systemStatus.overall,
        availableProviders: systemStatus.availableProviders || [],
        routing: systemStatus.routing,
        error: systemStatus.error
      });
      
      // Log configuration info without throwing errors
      if (systemStatus.error) {
        console.warn('⚠️ API Configuration Issue:', systemStatus.error);
        console.info('💡 To fix this:');
        console.info('1. Go to your Supabase project dashboard');
        console.info('2. Navigate to Settings > Secrets');
        console.info('3. Add/update your OPENAI_API_KEY secret');
        console.info('4. Redeploy the ai-gateway Edge Function');
      }
    } catch (error: any) {
      console.warn('⚠️ AI System Status Check Error:', error.message);
      
      // Always set a safe status, never throw
      setStatus({
        status: 'error',
        availableProviders: [],
        error: error.message
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkSystemStatus();
    // Check status every 5 minutes
    const interval = setInterval(checkSystemStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusDetails = () => {
    const hasOpenAI = status.availableProviders.includes('openai');
    const hasGemini = status.availableProviders.includes('gemini');
    
    if (hasOpenAI && hasGemini) {
      return {
        icon: <Brain className="w-4 h-4" />,
        label: 'GPT-5 + Gemma',
        color: 'bg-green-100 text-green-700 border-green-200',
        description: 'Full GPT-5 + Gemma capabilities active'
      };
    } else if (hasOpenAI) {
      return {
        icon: <Zap className="w-4 h-4" />,
        label: 'GPT-5 Only',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        description: 'OpenAI GPT-5 active, Gemma fallback unavailable'
      };
    } else if (hasGemini) {
      return {
        icon: <Brain className="w-4 h-4" />,
        label: 'Gemma Only',
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        description: 'Gemma models active, GPT-5 fallback unavailable'
      };
    } else {
      return {
        icon: <Bot className="w-4 h-4" />,
        label: 'Fallback Mode',
        color: 'bg-red-100 text-red-700 border-red-200',
        description: 'Using mock responses, check configuration'
      };
    }
  };

  const statusDetails = getStatusDetails();

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="relative">
        {/* Status Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 border
            ${statusDetails.color}
          `}
        >
          {statusDetails.icon}
          <span className="text-sm font-medium">
            {statusDetails.label}
            {status.error && status.status === 'error' && (
              <span className="text-red-500 ml-1" title={status.error}>⚠️</span>
            )}
          </span>
          {isRefreshing && (
            <RefreshCw className="w-3 h-3 animate-spin" />
          )}
        </button>

        {/* Expanded Status Panel */}
        {isExpanded && (
          <div className="absolute bottom-full left-0 mb-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Brain className="w-4 h-4 mr-2" />
                Enhanced AI System
              </h3>
              <button
                onClick={checkSystemStatus}
                disabled={isRefreshing}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {status.error && (
              <div className="mb-3 p-2 bg-red-50 rounded border-l-2 border-red-500">
                <p className="text-sm text-red-700 font-medium">Configuration Issue:</p>
                <p className="text-xs text-red-600 mt-1">{status.error}</p>
                {status.error.includes('Invalid API key') && (
                  <div className="text-xs text-red-600 mt-2">
                    <p className="font-medium">To fix:</p>
                    <ol className="list-decimal list-inside space-y-1 mt-1">
                      <li>Go to your Supabase project dashboard</li>
                      <li>Navigate to Settings → Secrets</li>
                      <li>Add/update your OPENAI_API_KEY secret</li>
                      <li>Redeploy the ai-gateway Edge Function</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Enhanced Features Status */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 mb-4 border border-purple-200">
              <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center">
                <Sparkles className="w-4 h-4 mr-1" />
                🚀 GPT-5 + Gemma Enhanced Features Active
              </h4>
              <div className="grid grid-cols-1 gap-1 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span><strong>Advanced Reasoning:</strong> Deep analysis and insights</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span><strong>Psychological Profiling:</strong> Personality analysis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span><strong>Enhanced Creativity:</strong> Personalized content</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span><strong>Intelligent Routing:</strong> Optimal model selection</span>
                </div>
              </div>
            </div>

            {/* Provider Status Details */}
            <div className="space-y-4">
              {/* OpenAI Status */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Zap className="w-4 h-4 mr-1" />
                  OpenAI GPT-5 Family
                </h4>
                <div className="space-y-2 ml-5">
                  {status.availableProviders.includes('openai') ? (
                    <div className="text-sm text-green-600 mb-2">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">✅ Active & Enhanced</span>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 mb-2">
                      <XCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">❌ Not Available</span>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Enhanced Models Available:</p>
                    <div className="grid grid-cols-1 gap-1">
                      <div className="text-xs text-blue-600">
                        <Brain className="w-3 h-3 inline mr-1" />
                        <span className="font-medium">GPT-5:</span> Advanced reasoning & creativity
                      </div>
                      <div className="text-xs text-green-600">
                        <Zap className="w-3 h-3 inline mr-1" />
                        <span className="font-medium">GPT-5 Mini:</span> Fast, efficient analysis
                      </div>
                      <div className="text-xs text-purple-600">
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        <span className="font-medium">GPT-5 Nano:</span> Cost-effective processing
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gemini Status */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />
                  Gemma Models
                </h4>
                <div className="space-y-2 ml-5">
                  {status.availableProviders.includes('gemini') ? (
                    <div className="text-sm text-green-600 mb-2">
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">✅ Active & Enhanced</span>
                    </div>
                  ) : (
                    <div className="text-sm text-red-600 mb-2">
                      <XCircle className="w-3 h-3 inline mr-1" />
                      <span className="font-medium">❌ Not Available</span>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Gemma Models:</p>
                    <div className="grid grid-cols-1 gap-1">
                      <div className="text-xs text-blue-600">
                        <span className="font-medium">Gemma-2-2B:</span> Efficient task processing
                      </div>
                      <div className="text-xs text-green-600">
                        <span className="font-medium">Gemma-2-9B:</span> Fast contact research
                      </div>
                      <div className="text-xs text-purple-600">
                        <span className="font-medium">Gemma-2-27B:</span> Complex research & analysis
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Routing Status */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <h5 className="text-xs font-medium text-gray-700 mb-2">🔄 Intelligent Routing Status:</h5>
              <div className="space-y-1 text-xs">
                {status.availableProviders.includes('openai') && status.availableProviders.includes('gemini') ? (
                  <p className="text-green-600">✅ Full GPT-5 + Gemma routing active - optimal model selection</p>
                ) : status.availableProviders.includes('openai') ? (
                  <p className="text-yellow-600">⚠️ GPT-5 only - Gemma fallback unavailable</p>
                ) : status.availableProviders.includes('gemini') ? (
                  <p className="text-yellow-600">⚠️ Gemma only - GPT-5 unavailable</p>
                ) : (
                  <p className="text-red-600">❌ No AI providers - using mock responses for development</p>
                )}
              </div>
            </div>

            {/* Help Text */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 mt-4">
              <p className="mb-2">
                <strong>🔧 Enhanced AI Features:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Secure API key management via Supabase</li>
                <li>Intelligent model routing for optimal results</li>
                <li>Advanced reasoning with GPT-5</li>
                <li>Comprehensive research with Gemini 2.0</li>
                <li>Automatic fallback handling</li>
              </ul>
            </div>

            {/* Configuration Links */}
            <div className="mt-4 flex flex-col space-y-2">
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center"
              >
                <span className="mr-1">🤖</span> Get OpenAI GPT-5 API Key
              </a>
              <a
                href="https://ai.google.dev/gemini-api/docs/api-key"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center"
              >
                <span className="mr-1">🧠</span> Get Gemini API Key for Gemma Models
              </a>
              
              {/* Configuration Help for API Key Issues */}
              {status.error && status.error.includes('Invalid OpenAI API key') && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <h5 className="text-xs font-semibold text-red-800 mb-2">🔧 Fix API Key Issue:</h5>
                  <ol className="text-xs text-red-700 list-decimal list-inside space-y-1">
                    <li>Go to your Supabase project dashboard</li>
                    <li>Navigate to Settings → Secrets</li>
                    <li>Update OPENAI_API_KEY with your valid key</li>
                    <li>Redeploy: <code className="bg-red-100 px-1 rounded">supabase functions deploy ai-gateway</code></li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};