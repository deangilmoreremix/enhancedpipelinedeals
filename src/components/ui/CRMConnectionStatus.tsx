/**
 * CRM Connection Status Component
 * Shows the connection status between this CRM and remote applications
 */

import React, { useState } from 'react';
import { useCRMBridge } from '../../hooks/useCRMBridge';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Settings,
  Monitor,
  Link,
  Activity,
  Clock,
  Database
} from 'lucide-react';

export const CRMConnectionStatus: React.FC = () => {
  const { 
    isConnected, 
    crmInfo, 
    pipelineData, 
    lastSync, 
    requestSync, 
    getConnectionStatus 
  } = useCRMBridge();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await requestSync();
      // Small delay to show refresh animation
      setTimeout(() => setIsRefreshing(false), 1000);
    } catch (error) {
      console.error('Sync failed:', error);
      setIsRefreshing(false);
    }
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="relative">
        {/* Status Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 border
            ${isConnected 
              ? 'bg-green-100 text-green-700 border-green-200' 
              : 'bg-red-100 text-red-700 border-red-200'
            }
          `}
        >
          {isConnected ? (
            <Wifi className="w-4 h-4" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            CRM Bridge {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {isRefreshing && (
            <RefreshCw className="w-3 h-3 animate-spin" />
          )}
        </button>

        {/* Expanded Status Panel */}
        {isExpanded && (
          <div className="absolute top-full right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <Link className="w-4 h-4 mr-2" />
                CRM Integration Status
              </h3>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Connection Details */}
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={`p-3 rounded-lg border ${
                isConnected 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${
                    isConnected ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {isConnected ? 'Connected to CRM' : 'Not Connected'}
                  </span>
                </div>
                {isConnected && crmInfo && (
                  <div className="mt-2 text-xs space-y-1">
                    <p><strong>CRM:</strong> {crmInfo.name} v{crmInfo.version}</p>
                    <p><strong>Origin:</strong> {connectionStatus.parentOrigin}</p>
                  </div>
                )}
              </div>

              {/* Pipeline Data Status */}
              {isConnected && pipelineData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                    <Database className="w-4 h-4 mr-1" />
                    Synchronized Data
                  </h4>
                  <div className="text-xs text-blue-800 space-y-1">
                    <p><strong>Deals:</strong> {pipelineData.deals.length} synchronized</p>
                    <p><strong>Stages:</strong> {pipelineData.stages.length} pipeline stages</p>
                    <p><strong>Total Value:</strong> ${pipelineData.totalValue.toLocaleString()}</p>
                    <p><strong>Active Deals:</strong> {pipelineData.activeDeals}</p>
                    {lastSync && (
                      <p><strong>Last Sync:</strong> {lastSync.toLocaleTimeString()}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Integration Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                  <Monitor className="w-4 h-4 mr-1" />
                  Integration Details
                </h4>
                <div className="text-xs text-gray-700 space-y-1">
                  <p><strong>Bridge Status:</strong> {isConnected ? 'Active' : 'Inactive'}</p>
                  <p><strong>Communication:</strong> PostMessage API</p>
                  <p><strong>Security:</strong> Origin validation enabled</p>
                  <p><strong>Features:</strong> Bi-directional sync, real-time updates</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Syncing...' : 'Request Sync'}
                </button>
                
                {crmInfo?.url && (
                  <a
                    href={crmInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Help Text */}
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-3 border">
                <p className="mb-2"><strong>🔧 CRM Bridge:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Enables real-time data sync with remote CRM</li>
                  <li>Secure cross-origin communication</li>
                  <li>Bi-directional deal management</li>
                  <li>Automatic conflict resolution</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};