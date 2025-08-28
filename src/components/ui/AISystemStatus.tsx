import React, { useState, useEffect } from 'react';
import { getEnhancedIntelligentAI } from '../../services/enhancedIntelligentAIService';
import { CheckCircle, XCircle, AlertCircle, Settings, Brain, Sparkles, Zap, Bot, RefreshCw } from 'lucide-react';

export const AISystemStatus: React.FC = () => {
  const [status, setStatus] = useState<{
    status: string;
    availableProviders: string[];
    routing?: any[];
  }>({ status: 'unknown', availableProviders: [] });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const intelligentAI = getEnhancedIntelligentAI();

  const checkStatus = async () => {
    setIsRefreshing(true);
    try {
      const systemStatus = await intelligentAI.getSystemStatus();
      setStatus(systemStatus);
    } catch (error) {
      console.error('Failed to check AI system status:', error);
      setStatus({ status: 'error', availableProviders: [] });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const getStatusIcon = () => {
    switch (status.status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'down':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Bot className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'healthy':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'down':
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="relative">
        {/* Status Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 border
            ${getStatusColor()}
          `}
        >
          {getStatusIcon()}
          <span className="text-sm font-medium">
            Enhanced AI System
          </span>
          {isRefreshing && (
            <RefreshCw className="w-3 h-3 animate-spin" />
          )}
        </button>

        {/* Expanded Status Panel */}
        {isExpanded && (
          <div className="absolute bottom-full right-0 mb-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Brain className="w-4 h-4 mr-2 text-purple-600" />
                Enhanced AI System Status
              </h3>
              <button
                onClick={checkStatus}
                disabled={isRefreshing}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* System Status */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 mb-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">System Status</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon()}
                  <span className="text-sm font-bold text-blue-900 capitalize">{status.status}</span>
                </div>
              </div>
              <p className="text-xs text-blue-800 mt-1">
                {status.status === 'healthy' && 'All AI providers operational with intelligent routing'}
                {status.status === 'degraded' && 'Some AI providers unavailable, using fallbacks'}
                {status.status === 'down' && 'AI providers unavailable, using mock responses'}
                {status.status === 'error' && 'System error, please check configuration'}
              </p>
            </div>

            {/* Available Providers */}
            <div className="space-y-3 mb-4">
              <h4 className="text-sm font-medium text-gray-700">Available AI Providers</h4>
              
              <div className="space-y-2">
                {/* OpenAI Status */}
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">OpenAI GPT-5</span>
                  </div>
                  {status.availableProviders.includes('openai') ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
                
                {/* Gemini Status */}
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Gemini 2.0</span>
                  </div>
                  {status.availableProviders.includes('gemini') ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Task Routing Information */}
            {status.routing && status.routing.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Intelligent Task Routing</h4>
                <div className="space-y-1 text-xs">
                  {status.routing.slice(0, 3).map((route, index) => (
                    <div key={index} className="bg-gray-50 p-2 rounded">
                      <div className="font-medium text-gray-800">{route.task}</div>
                      <div className="text-gray-600">{route.primaryModel} → {route.fallbackModel}</div>
                    </div>
                  ))}
                  {status.routing.length > 3 && (
                    <div className="text-center text-gray-500 py-1">
                      +{status.routing.length - 3} more routes...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Enhanced Features Notice */}
            <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
              <h5 className="text-xs font-medium text-purple-900 mb-1 flex items-center">
                <Sparkles className="w-3 h-3 mr-1" />
                🚀 GPT-5 Enhanced Features Active
              </h5>
              <ul className="text-xs text-purple-800 space-y-0.5">
                <li>• Advanced reasoning for deal analysis</li>
                <li>• Enhanced psychological profiling</li>
                <li>• Intelligent task routing</li>
                <li>• Multimodal capabilities ready</li>
              </ul>
            </div>

            {/* Configuration Help */}
            <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded p-3">
              <p className="mb-2">
                <strong>⚙️ Configuration:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>API keys stored in Supabase secrets</li>
                <li>Secure AI gateway deployed</li>
                <li>Enhanced services active</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};