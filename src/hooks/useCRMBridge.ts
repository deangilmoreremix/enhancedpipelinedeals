/**
 * React Hook for CRM Bridge Integration
 * Provides easy access to CRM bridge functionality from React components
 */

import { useEffect, useState } from 'react';
import { getCRMBridge, PipelineData, CRMInfo } from '../services/crmBridge';

interface CRMBridgeState {
  isConnected: boolean;
  crmInfo: CRMInfo | null;
  pipelineData: PipelineData | null;
  lastSync: Date | null;
}

export const useCRMBridge = () => {
  const [bridgeState, setBridgeState] = useState<CRMBridgeState>({
    isConnected: false,
    crmInfo: null,
    pipelineData: null,
    lastSync: null
  });

  const bridge = getCRMBridge();

  useEffect(() => {
    // Set up event listeners for CRM bridge events
    const handleCRMConnected = ({ pipelineData, crmInfo }: { pipelineData: PipelineData; crmInfo: CRMInfo }) => {
      setBridgeState(prev => ({
        ...prev,
        isConnected: true,
        crmInfo,
        pipelineData,
        lastSync: new Date()
      }));
    };

    const handleDealsSync = (deals: any[]) => {
      setBridgeState(prev => ({
        ...prev,
        pipelineData: prev.pipelineData ? {
          ...prev.pipelineData,
          deals
        } : null,
        lastSync: new Date()
      }));
    };

    const handleDealUpdated = ({ dealId, updates }: { dealId: string; updates: any }) => {
      setBridgeState(prev => ({
        ...prev,
        pipelineData: prev.pipelineData ? {
          ...prev.pipelineData,
          deals: prev.pipelineData.deals.map(deal => 
            deal.id === dealId ? { ...deal, ...updates } : deal
          )
        } : null,
        lastSync: new Date()
      }));
    };

    const handleDealCreated = (deal: any) => {
      setBridgeState(prev => ({
        ...prev,
        pipelineData: prev.pipelineData ? {
          ...prev.pipelineData,
          deals: [...prev.pipelineData.deals, deal]
        } : null,
        lastSync: new Date()
      }));
    };

    const handleDealDeleted = (dealId: string) => {
      setBridgeState(prev => ({
        ...prev,
        pipelineData: prev.pipelineData ? {
          ...prev.pipelineData,
          deals: prev.pipelineData.deals.filter(deal => deal.id !== dealId)
        } : null,
        lastSync: new Date()
      }));
    };

    const handleDealMoved = ({ dealId, newStage }: { dealId: string; newStage: string }) => {
      setBridgeState(prev => ({
        ...prev,
        pipelineData: prev.pipelineData ? {
          ...prev.pipelineData,
          deals: prev.pipelineData.deals.map(deal => 
            deal.id === dealId ? { ...deal, stage: newStage } : deal
          )
        } : null,
        lastSync: new Date()
      }));
    };

    // Register event listeners
    bridge.on('crmConnected', handleCRMConnected);
    bridge.on('dealsSync', handleDealsSync);
    bridge.on('dealUpdated', handleDealUpdated);
    bridge.on('dealCreated', handleDealCreated);
    bridge.on('dealDeleted', handleDealDeleted);
    bridge.on('dealMoved', handleDealMoved);

    // Cleanup
    return () => {
      bridge.off('crmConnected', handleCRMConnected);
      bridge.off('dealsSync', handleDealsSync);
      bridge.off('dealUpdated', handleDealUpdated);
      bridge.off('dealCreated', handleDealCreated);
      bridge.off('dealDeleted', handleDealDeleted);
      bridge.off('dealMoved', handleDealMoved);
    };
  }, [bridge]);

  // Public API for components
  return {
    // State
    isConnected: bridgeState.isConnected,
    crmInfo: bridgeState.crmInfo,
    pipelineData: bridgeState.pipelineData,
    lastSync: bridgeState.lastSync,

    // Actions
    notifyDealCreated: (deal: any) => bridge.notifyDealCreated(deal),
    notifyDealUpdated: (deal: any) => bridge.notifyDealUpdated(deal),
    notifyDealDeleted: (dealId: string) => bridge.notifyDealDeleted(dealId),
    notifyDealMoved: (dealId: string, oldStage: string, newStage: string) => 
      bridge.notifyDealMoved(dealId, oldStage, newStage),
    
    // Utilities
    requestSync: () => bridge.requestSync(),
    sendAnalytics: (data: any) => bridge.sendAnalytics(data),
    getConnectionStatus: () => bridge.getConnectionStatus()
  };
};