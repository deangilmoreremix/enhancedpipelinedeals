import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Bot, RefreshCw } from 'lucide-react';
import { getAIGatewayService } from '../../services/aiGatewayService';
import { AI_MODELS } from '../../config/aiModels';

type Health = { status: 'checking' | 'healthy' | 'degraded' | 'down'; error?: string };

/** Shows whether the server-side OpenAI (Responses API) gateway is reachable. */
export const EnhancedAIStatusIndicator: React.FC = () => {
  const [health, setHealth] = useState<Health>({ status: 'checking' });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const check = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const r = await getAIGatewayService().healthCheck();
      setHealth({ status: r.status, error: r.error });
    } catch (e: any) {
      setHealth({ status: 'down', error: e?.message });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [check]);

  const icon =
    health.status === 'healthy' ? <CheckCircle className="w-4 h-4 text-green-500" />
    : health.status === 'degraded' ? <AlertCircle className="w-4 h-4 text-yellow-500" />
    : health.status === 'down' ? <XCircle className="w-4 h-4 text-red-500" />
    : <Bot className="w-4 h-4 text-gray-500" />;

  const color =
    health.status === 'healthy' ? 'bg-green-100 text-green-700 border-green-200'
    : health.status === 'degraded' ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : health.status === 'down' ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(v => !v)}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border text-xs font-medium ${color}`}
        aria-expanded={isExpanded}
      >
        {icon}
        <span>OpenAI {health.status === 'checking' ? 'checking…' : health.status}</span>
      </button>

      {isExpanded && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">AI status</h4>
            <button onClick={check} disabled={isRefreshing} className="text-gray-500 hover:text-gray-700" aria-label="Refresh status">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {health.error && <p className="text-xs text-red-600 mb-3">{health.error}</p>}
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
            Requests run server-side through the OpenAI Responses API (Netlify function). Set <code>OPENAI_API_KEY</code> in Netlify to enable.
          </p>
          <ul className="space-y-1">
            {AI_MODELS.filter(m => m.isActive).map(m => (
              <li key={m.id} className="text-xs text-gray-700 dark:text-gray-200 flex justify-between">
                <span className="font-medium">{m.name}</span>
                <span className="text-gray-500">{m.tier}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
