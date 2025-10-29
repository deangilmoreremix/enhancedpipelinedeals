import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { getCRMBridge } from '../../services/crmBridge';

interface CRMConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export const CRMConnectionStatus: React.FC<CRMConnectionStatusProps> = ({
  className = '',
  showDetails = false,
  compact = false
}) => {
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    parentOrigin: null as string | null,
    lastUpdated: null as string | null
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Get initial connection status
    const crmBridge = getCRMBridge();
    const status = crmBridge.getConnectionStatus();
    setConnectionStatus(prev => ({ ...prev, ...status }));

    // Listen for connection status changes
    const handleConnectionChange = (data: any) => {
      setConnectionStatus(prev => ({
        ...prev,
        connected: data.connected,
        lastUpdated: new Date().toISOString()
      }));
    };

    crmBridge.on('connectionStatusChanged', handleConnectionChange);

    return () => {
      crmBridge.off('connectionStatusChanged', handleConnectionChange);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const crmBridge = getCRMBridge();
      crmBridge.requestSync();

      // Simulate refresh delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to refresh CRM connection:', error);
      setIsRefreshing(false);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {connectionStatus.connected ? (
          <div className="flex items-center space-x-1 text-green-600">
            <Wifi className="w-4 h-4" />
            {!showDetails && <span className="text-sm font-medium">Connected</span>}
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-red-600">
            <WifiOff className="w-4 h-4" />
            {!showDetails && <span className="text-sm font-medium">Disconnected</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center">
            {connectionStatus.connected ? (
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 mr-2 text-red-500" />
            )}
            CRM Connection Status
          </h4>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Refresh connection"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`text-sm font-medium ${
              connectionStatus.connected ? 'text-green-600' : 'text-red-600'
            }`}>
              {connectionStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Parent Origin */}
          {connectionStatus.parentOrigin && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">CRM Origin:</span>
              <span className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                {connectionStatus.parentOrigin}
              </span>
            </div>
          )}

          {/* Last Updated */}
          {connectionStatus.lastUpdated && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Updated:</span>
              <span className="text-sm text-gray-900">
                {new Date(connectionStatus.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* Connection Indicator */}
          <div className="flex items-center justify-center pt-2">
            {connectionStatus.connected ? (
              <div className="flex items-center space-x-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Live Connection Active</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium">Connection Lost</span>
              </div>
            )}
          </div>
        </div>

        {/* Connection Actions */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isRefreshing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </button>
              <button
                onClick={() => {
                  const crmBridge = getCRMBridge();
                  const status = crmBridge.getConnectionStatus();
                  console.log('CRM Bridge Status:', status);
                  alert(`CRM Bridge Status:\nConnected: ${status.connected}\nOrigin: ${status.parentOrigin || 'None'}`);
                }}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Debug Info
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Mini status indicator for use in headers/toolbars
export const MiniCRMStatusIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const crmBridge = getCRMBridge();
    const status = crmBridge.getConnectionStatus();
    setIsConnected(status.connected);

    const handleConnectionChange = (data: any) => {
      setIsConnected(data.connected);
    };

    crmBridge.on('connectionStatusChanged', handleConnectionChange);

    return () => {
      crmBridge.off('connectionStatusChanged', handleConnectionChange);
    };
  }, []);

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {isConnected ? (
        <>
          <Wifi className="w-3 h-3 text-green-500" />
          <span className="text-xs text-green-600 font-medium">CRM</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3 text-red-500" />
          <span className="text-xs text-red-600 font-medium">CRM</span>
        </>
      )}
    </div>
  );
};