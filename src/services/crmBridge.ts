/**
 * CRM Integration Bridge for Remote App Communication
 * Enables this CRM to communicate with remote applications via postMessage API
 */

export interface RemoteAppData {
  appName: string;
  version: string;
  capabilities: string[];
}

export interface PipelineData {
  deals: any[];
  stages: string[];
  totalValue: number;
  activeDeals: number;
}

export interface CRMInfo {
  name: string;
  version: string;
  url: string;
}

class CRMBridge {
  private parentOrigin: string | null = null;
  private isConnected: boolean = false;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeParentOrigin();
    this.setupMessageListener();
    this.notifyReady();
    console.log('🔗 CRM Bridge initialized in remote app');
  }

  private initializeParentOrigin() {
    // Try to detect parent origin from various sources
    const possibleOrigins = [
      // Environment variable (for development)
      import.meta.env?.VITE_PARENT_ORIGIN,
      // Query parameters
      new URLSearchParams(window.location.search).get('parentOrigin'),
      // Referrer
      document.referrer ? new URL(document.referrer).origin : null,
      // Default for development
      window.location.origin
    ].filter(Boolean);

    for (const origin of possibleOrigins) {
      if (origin && this.isValidOrigin(origin)) {
        this.parentOrigin = origin;
        console.log('🏠 Parent CRM origin detected:', this.parentOrigin);
        break;
      }
    }

    // Fallback for development
    if (!this.parentOrigin) {
      this.parentOrigin = window.location.origin;
      console.warn('⚠️ Using fallback parent origin for development:', this.parentOrigin);
    }
  }

  private setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Set parent origin on first message from CRM (overrides initial detection if needed)
      if (!this.parentOrigin && event.origin && event.data?.source === 'CRM') {
        this.parentOrigin = event.origin;
        console.log('🏠 Parent CRM origin updated:', this.parentOrigin);
      }

      // Allow messages from valid origins
      if (!this.isValidOrigin(event.origin)) {
        return;
      }

      const { type, data, source } = event.data;
      if (source !== 'CRM') return;

      console.log('📨 Remote app received from CRM:', type, data);

      switch (type) {
        case 'CRM_INIT':
          this.handleCRMInit(data);
          break;
        case 'SYNC_DEALS':
          this.handleDealsSync(data.deals);
          break;
        case 'UPDATE_DEAL':
          this.handleDealUpdate(data.dealId, data.updates);
          break;
        case 'CREATE_DEAL':
          this.handleDealCreate(data.deal);
          break;
        case 'DELETE_DEAL':
          this.handleDealDelete(data.dealId);
          break;
        case 'MOVE_DEAL':
          this.handleDealMove(data.dealId, data.newStage, data.position);
          break;
        case 'REQUEST_PIPELINE_DATA':
          this.sendPipelineData();
          break;
        case 'INJECT_BRIDGE':
          // CRM is sending us bridge code - we already have it
          console.log('✅ Bridge code injection acknowledged');
          break;
      }
    });
  }

  private isValidOrigin(origin: string): boolean {
    // Add your CRM domains here - the bridge will auto-detect the parent origin
    if (!this.parentOrigin) return true; // Allow first connection
    return origin === this.parentOrigin;
  }

  // Send message to CRM parent
  private sendToCRM(type: string, data: any = null) {
    if (!this.parentOrigin) {
      // Try to initialize parent origin if not set
      this.initializeParentOrigin();
      if (!this.parentOrigin) {
        console.warn('⚠️ Cannot send to CRM - no parent origin available');
        return;
      }
    }

    const message = {
      type,
      data,
      source: 'REMOTE_PIPELINE',
      timestamp: Date.now()
    };

    try {
      // Try sending to parent first, fallback to self for development
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, this.parentOrigin);
      } else {
        // Development fallback - post to self
        console.log('🔄 Development mode: posting message to self', message);
        window.postMessage(message, this.parentOrigin);
      }
      console.log('📤 Sent to CRM:', type, data);
    } catch (error) {
      console.error('❌ Failed to send message to CRM:', error);
    }
  }

  // Notify CRM that this app is ready
  private notifyReady() {
    setTimeout(() => {
      console.log('📢 Notifying CRM that remote app is ready');
      this.sendToCRM('REMOTE_READY', {
        appName: 'Remote Pipeline',
        version: '1.0.0',
        capabilities: ['deals', 'pipeline', 'analytics']
      });
    }, 1000);
  }

  // Handle CRM initialization
  private handleCRMInit(data: any) {
    console.log('🚀 CRM connected with data:', data);
    this.isConnected = true;
    
    const { pipelineData, crmInfo } = data;
    
    // Update app with CRM data
    if (pipelineData) {
      this.updateLocalPipeline(pipelineData);
    }
    
    // Show connection status in UI
    this.updateConnectionStatus(true, crmInfo);
    
    // Emit event for React components to listen to
    this.emit('crmConnected', { pipelineData, crmInfo });
  }

  // Handle deals synchronization from CRM
  private handleDealsSync(deals: any[]) {
    console.log('🔄 Syncing deals from CRM:', deals);
    
    // Update local state with CRM deals
    this.updateLocalDeals(deals);
    
    // Emit event for React components
    this.emit('dealsSync', deals);
  }

  // Handle individual deal updates from CRM
  private handleDealUpdate(dealId: string, updates: any) {
    console.log('✏️ Deal updated from CRM:', dealId, updates);
    
    // Update specific deal in local state
    this.updateLocalDeal(dealId, updates);
    
    // Emit event for React components
    this.emit('dealUpdated', { dealId, updates });
  }

  // Handle new deal creation from CRM
  private handleDealCreate(deal: any) {
    console.log('🆕 New deal from CRM:', deal);
    
    // Add deal to local state
    this.addLocalDeal(deal);
    
    // Emit event for React components
    this.emit('dealCreated', deal);
  }

  // Handle deal deletion from CRM
  private handleDealDelete(dealId: string) {
    console.log('🗑️ Deal deleted in CRM:', dealId);
    
    // Remove deal from local state
    this.removeLocalDeal(dealId);
    
    // Emit event for React components
    this.emit('dealDeleted', dealId);
  }

  // Handle deal stage movement from CRM
  private handleDealMove(dealId: string, newStage: string, position: number) {
    console.log('↔️ Deal moved in CRM:', dealId, 'to', newStage);
    
    // Update deal stage in local state
    this.moveLocalDeal(dealId, newStage, position);
    
    // Emit event for React components
    this.emit('dealMoved', { dealId, newStage, position });
  }

  // Send current pipeline data to CRM
  private sendPipelineData() {
    console.log('📊 CRM requested pipeline data');
    
    // Get current pipeline data
    const pipelineData = this.getCurrentPipelineData();
    
    this.sendToCRM('PIPELINE_DATA_RESPONSE', pipelineData);
  }

  // Event emitter for React components
  on(eventType: string, callback: Function) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  off(eventType: string, callback: Function) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(eventType: string, data: any) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // === IMPLEMENTED LOCAL STATE UPDATE METHODS ===

  private updateLocalPipeline(pipelineData: PipelineData) {
    console.log('🔄 Updating local pipeline with CRM data:', pipelineData);

    // Store pipeline data in localStorage for persistence
    try {
      localStorage.setItem('crm_pipeline_data', JSON.stringify(pipelineData));
      console.log('💾 Pipeline data saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save pipeline data to localStorage:', error);
    }

    // Emit event for React components to update their state
    this.emit('pipelineUpdated', pipelineData);
  }

  private updateLocalDeals(deals: any[]) {
    console.log('🔄 Syncing deals from CRM:', deals.length, 'deals');

    // Store deals in localStorage for persistence
    try {
      localStorage.setItem('crm_deals', JSON.stringify(deals));
      console.log('💾 Deals data saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save deals to localStorage:', error);
    }

    // Emit event for React components to update their state
    this.emit('dealsUpdated', deals);
  }

  private updateLocalDeal(dealId: string, updates: any) {
    console.log('✏️ Updating local deal:', dealId, updates);

    try {
      // Get current deals from localStorage
      const storedDeals = localStorage.getItem('crm_deals');
      if (storedDeals) {
        const deals = JSON.parse(storedDeals);
        const updatedDeals = deals.map((deal: any) =>
          deal.id === dealId ? { ...deal, ...updates } : deal
        );

        // Save updated deals back to localStorage
        localStorage.setItem('crm_deals', JSON.stringify(updatedDeals));
        console.log('💾 Updated deal saved to localStorage');

        // Emit event for React components
        this.emit('dealUpdated', { dealId, updates, updatedDeal: updatedDeals.find((d: any) => d.id === dealId) });
      }
    } catch (error) {
      console.error('❌ Failed to update local deal:', error);
    }
  }

  private addLocalDeal(deal: any) {
    console.log('🆕 Adding new deal from CRM:', deal);

    try {
      // Get current deals from localStorage
      const storedDeals = localStorage.getItem('crm_deals');
      const deals = storedDeals ? JSON.parse(storedDeals) : [];

      // Add new deal
      const updatedDeals = [...deals, deal];

      // Save updated deals back to localStorage
      localStorage.setItem('crm_deals', JSON.stringify(updatedDeals));
      console.log('💾 New deal added to localStorage');

      // Emit event for React components
      this.emit('dealAdded', deal);
    } catch (error) {
      console.error('❌ Failed to add local deal:', error);
    }
  }

  private removeLocalDeal(dealId: string) {
    console.log('🗑️ Removing deal from local state:', dealId);

    try {
      // Get current deals from localStorage
      const storedDeals = localStorage.getItem('crm_deals');
      if (storedDeals) {
        const deals = JSON.parse(storedDeals);
        const updatedDeals = deals.filter((deal: any) => deal.id !== dealId);

        // Save updated deals back to localStorage
        localStorage.setItem('crm_deals', JSON.stringify(updatedDeals));
        console.log('💾 Deal removed from localStorage');

        // Emit event for React components
        this.emit('dealRemoved', dealId);
      }
    } catch (error) {
      console.error('❌ Failed to remove local deal:', error);
    }
  }

  private moveLocalDeal(dealId: string, newStage: string, position: number) {
    console.log('↔️ Moving local deal:', dealId, 'to stage:', newStage, 'position:', position);

    try {
      // Get current deals from localStorage
      const storedDeals = localStorage.getItem('crm_deals');
      if (storedDeals) {
        const deals = JSON.parse(storedDeals);
        const updatedDeals = deals.map((deal: any) =>
          deal.id === dealId ? { ...deal, stage: newStage } : deal
        );

        // Save updated deals back to localStorage
        localStorage.setItem('crm_deals', JSON.stringify(updatedDeals));
        console.log('💾 Deal moved and saved to localStorage');

        // Emit event for React components
        this.emit('dealMoved', { dealId, newStage, position });
      }
    } catch (error) {
      console.error('❌ Failed to move local deal:', error);
    }
  }

  private updateConnectionStatus(connected: boolean, crmInfo: CRMInfo | null = null) {
    console.log('🔗 Updating connection status:', connected, crmInfo);

    // Store connection status in localStorage
    try {
      const connectionData = { connected, crmInfo, lastUpdated: new Date().toISOString() };
      localStorage.setItem('crm_connection_status', JSON.stringify(connectionData));
      console.log('💾 Connection status saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save connection status:', error);
    }

    // Emit event for React components to update UI
    this.emit('connectionStatusChanged', { connected, crmInfo });
  }

  private getCurrentPipelineData(): PipelineData {
    console.log('📊 Getting current pipeline data');

    try {
      // Get deals from localStorage
      const storedDeals = localStorage.getItem('crm_deals');
      const deals = storedDeals ? JSON.parse(storedDeals) : [];

      // Calculate pipeline statistics
      const totalValue = deals.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0);
      const activeDeals = deals.filter((deal: any) =>
        !['Closed Won', 'Closed Lost'].includes(deal.stage)
      ).length;

      const pipelineData: PipelineData = {
        deals,
        stages: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
        totalValue,
        activeDeals
      };

      console.log('📊 Pipeline data calculated:', pipelineData);
      return pipelineData;
    } catch (error) {
      console.error('❌ Failed to get pipeline data:', error);
      return {
        deals: [],
        stages: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
        totalValue: 0,
        activeDeals: 0
      };
    }
  }

  // === PUBLIC API METHODS FOR YOUR REACT APP ===

  // Call this when user creates a deal in your app
  notifyDealCreated(deal: any) {
    this.sendToCRM('DEAL_CREATED', deal);
  }

  // Call this when user updates a deal in your app
  notifyDealUpdated(deal: any) {
    this.sendToCRM('DEAL_UPDATED', deal);
  }

  // Call this when user deletes a deal in your app
  notifyDealDeleted(dealId: string) {
    this.sendToCRM('DEAL_DELETED', { id: dealId });
  }

  // Call this when user moves a deal between stages in your app
  notifyDealMoved(dealId: string, oldStage: string, newStage: string) {
    this.sendToCRM('DEAL_STAGE_CHANGED', { dealId, oldStage, newStage });
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      parentOrigin: this.parentOrigin
    };
  }

  // Request fresh data from CRM
  requestSync() {
    this.sendToCRM('REQUEST_SYNC');
  }

  // Send analytics data to CRM
  sendAnalytics(analyticsData: any) {
    this.sendToCRM('ANALYTICS_DATA', analyticsData);
  }
}

// Singleton instance
let crmBridge: CRMBridge | null = null;

export const getCRMBridge = (): CRMBridge => {
  if (!crmBridge) {
    crmBridge = new CRMBridge();
    // Make it globally available
    (window as any).crmBridge = crmBridge;
  }
  return crmBridge;
};

export { CRMBridge };