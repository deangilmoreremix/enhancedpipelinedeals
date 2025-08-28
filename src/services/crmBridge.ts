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
    this.setupMessageListener();
    this.notifyReady();
    console.log('🔗 CRM Bridge initialized in remote app');
  }

  private setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Set parent origin on first message from CRM
      if (!this.parentOrigin && event.origin && event.data?.source === 'CRM') {
        this.parentOrigin = event.origin;
        console.log('🏠 Parent CRM origin set:', this.parentOrigin);
      }

      // Verify parent origin for security
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
      console.warn('⚠️ Cannot send to CRM - no parent origin set');
      return;
    }

    const message = {
      type,
      data,
      source: 'REMOTE_PIPELINE',
      timestamp: Date.now()
    };

    try {
      window.parent.postMessage(message, this.parentOrigin);
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

  // === METHODS TO IMPLEMENT IN YOUR REACT APP ===

  private updateLocalPipeline(pipelineData: PipelineData) {
    // TODO: Implement this method to update your React app's state
    // Example:
    // setPipelineData(pipelineData);
    console.log('📝 TODO: Update local pipeline with:', pipelineData);
  }

  private updateLocalDeals(deals: any[]) {
    // TODO: Implement this method to sync all deals
    // Example:
    // setDeals(deals);
    console.log('📝 TODO: Update local deals with:', deals);
  }

  private updateLocalDeal(dealId: string, updates: any) {
    // TODO: Implement this method to update a specific deal
    // Example:
    // setDeals(prev => prev.map(deal => 
    //   deal.id === dealId ? { ...deal, ...updates } : deal
    // ));
    console.log('📝 TODO: Update local deal:', dealId, updates);
  }

  private addLocalDeal(deal: any) {
    // TODO: Implement this method to add a new deal
    // Example:
    // setDeals(prev => [...prev, deal]);
    console.log('📝 TODO: Add local deal:', deal);
  }

  private removeLocalDeal(dealId: string) {
    // TODO: Implement this method to remove a deal
    // Example:
    // setDeals(prev => prev.filter(deal => deal.id !== dealId));
    console.log('📝 TODO: Remove local deal:', dealId);
  }

  private moveLocalDeal(dealId: string, newStage: string, position: number) {
    // TODO: Implement this method to move a deal between stages
    // Example:
    // setDeals(prev => prev.map(deal => 
    //   deal.id === dealId ? { ...deal, stage: newStage } : deal
    // ));
    console.log('📝 TODO: Move local deal:', dealId, 'to', newStage);
  }

  private updateConnectionStatus(connected: boolean, crmInfo: CRMInfo | null = null) {
    // TODO: Implement this method to show connection status in your UI
    // Example:
    // setConnectionStatus({ connected, crmInfo });
    console.log('📝 TODO: Update connection status:', connected, crmInfo);
  }

  private getCurrentPipelineData(): PipelineData {
    // TODO: Implement this method to return your current pipeline data
    // Example:
    // return {
    //   deals: deals,
    //   stages: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'],
    //   totalValue: deals.reduce((sum, deal) => sum + deal.value, 0),
    //   activeDeals: deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage)).length
    // };
    console.log('📝 TODO: Return current pipeline data');
    return {
      deals: [],
      stages: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
      totalValue: 0,
      activeDeals: 0
    };
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