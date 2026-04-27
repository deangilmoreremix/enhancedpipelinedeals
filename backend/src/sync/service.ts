import { supabase } from '../services/database';
import { DealService } from '../services/dealService';
import { ContactService } from '../services/contactService';
import { WebhookService } from '../webhooks/service';

interface SyncConfig {
  id: string;
  workspaceId: string;
  name: string;
  source: string;
  target: string;
  mapping: Record<string, any>;
  schedule: string;
  isActive: boolean;
  lastSync?: Date;
  syncStatus: string;
}

export class SyncService {
  private static activeSyncs = new Map<string, NodeJS.Timeout>();

  static async createSyncConfig(config: any, context: any): Promise<SyncConfig> {
    const syncData = {
      workspace_id: context.workspaceId,
      name: config.name,
      source: config.source,
      target: config.target,
      mapping: config.mapping,
      schedule: config.schedule,
      is_active: config.isActive !== false,
      sync_status: 'idle',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const { data, error } = await supabase
      .from('sync_configs')
      .insert(syncData)
      .select()
      .single();

    if (error) {
      console.error('Error creating sync config:', error);
      throw new Error('Failed to create sync configuration');
    }

    const syncConfig = this.formatSyncConfig(data);

    // Schedule the sync if active
    if (syncConfig.isActive) {
      this.scheduleSync(syncConfig);
    }

    return syncConfig;
  }

  static async updateSyncConfig(id: string, updates: any, context: any): Promise<SyncConfig> {
    const { data, error } = await supabase
      .from('sync_configs')
      .update({
        ...updates,
        updated_at: new Date(),
      })
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating sync config:', error);
      throw new Error('Failed to update sync configuration');
    }

    const syncConfig = this.formatSyncConfig(data);

    // Reschedule if active status changed
    const existingSync = this.activeSyncs.get(id);
    if (existingSync) {
      clearInterval(existingSync);
      this.activeSyncs.delete(id);
    }

    if (syncConfig.isActive) {
      this.scheduleSync(syncConfig);
    }

    return syncConfig;
  }

  static async deleteSyncConfig(id: string, context: any): Promise<boolean> {
    // Clear any scheduled sync
    const existingSync = this.activeSyncs.get(id);
    if (existingSync) {
      clearInterval(existingSync);
      this.activeSyncs.delete(id);
    }

    const { error } = await supabase
      .from('sync_configs')
      .delete()
      .eq('id', id)
      .eq('workspace_id', context.workspaceId);

    if (error) {
      console.error('Error deleting sync config:', error);
      return false;
    }

    return true;
  }

  static async getSyncConfigs(context: any): Promise<SyncConfig[]> {
    const { data, error } = await supabase
      .from('sync_configs')
      .select('*')
      .eq('workspace_id', context.workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sync configs:', error);
      throw new Error('Failed to fetch sync configurations');
    }

    return data.map(this.formatSyncConfig);
  }

  static async triggerSync(id: string, context: any) {
    const syncConfig = await this.getSyncConfigById(id, context);
    if (!syncConfig) {
      throw new Error('Sync configuration not found');
    }

    try {
      await this.updateSyncStatus(id, 'in_progress');

      const result = await this.performSync(syncConfig, context);

      await this.updateSyncStatus(id, 'completed', new Date());

      // Trigger webhooks for sync completion
      await WebhookService.triggerWebhooks('sync.completed', {
        syncId: id,
        syncName: syncConfig.name,
        result,
      }, context);

      return {
        success: true,
        message: 'Sync completed successfully',
        data: result,
      };
    } catch (error: any) {
      await this.updateSyncStatus(id, 'failed');

      // Trigger webhooks for sync failure
      await WebhookService.triggerWebhooks('sync.failed', {
        syncId: id,
        syncName: syncConfig.name,
        error: error.message,
      }, context);

      throw error;
    }
  }

  private static async performSync(syncConfig: SyncConfig, context: any) {
    const { source, target, mapping } = syncConfig;

    switch (`${source}->${target}`) {
      case 'deals->hubspot':
        return await this.syncDealsToHubSpot(mapping, context);
      case 'contacts->hubspot':
        return await this.syncContactsToHubSpot(mapping, context);
      case 'hubspot->deals':
        return await this.syncHubSpotToDeals(mapping, context);
      case 'hubspot->contacts':
        return await this.syncHubSpotToContacts(mapping, context);
      case 'deals->google_sheets':
        return await this.syncDealsToGoogleSheets(mapping, context);
      case 'contacts->google_sheets':
        return await this.syncContactsToGoogleSheets(mapping, context);
      default:
        throw new Error(`Unsupported sync direction: ${source} -> ${target}`);
    }
  }

  private static async syncDealsToHubSpot(mapping: any, context: any) {
    // Get all deals
    const deals = await DealService.getDeals({}, context);
    const dealsData = deals.edges.map(edge => edge.node);

    // Transform data according to mapping
    const hubspotContacts = dealsData.map(deal => ({
      properties: {
        firstname: mapping.contactName ? this.extractValue(deal, mapping.contactName) : deal.contact,
        company: deal.company,
        deal_value: deal.value,
        deal_stage: deal.stage,
        probability: deal.probability,
        // Add more mappings as needed
      },
    }));

    // This would make actual API calls to HubSpot
    console.log(`Would sync ${hubspotContacts.length} deals to HubSpot`);

    return {
      synced: hubspotContacts.length,
      type: 'deals_to_hubspot',
    };
  }

  private static async syncContactsToHubSpot(mapping: any, context: any) {
    const contacts = await ContactService.getContacts({}, context);
    const contactsData = contacts.edges.map(edge => edge.node);

    const hubspotContacts = contactsData.map(contact => ({
      properties: {
        firstname: contact.name.split(' ')[0],
        lastname: contact.name.split(' ').slice(1).join(' '),
        email: contact.email,
        company: contact.company,
        jobtitle: contact.position,
      },
    }));

    console.log(`Would sync ${hubspotContacts.length} contacts to HubSpot`);

    return {
      synced: hubspotContacts.length,
      type: 'contacts_to_hubspot',
    };
  }

  private static async syncHubSpotToDeals(mapping: any, context: any) {
    // This would fetch data from HubSpot and create/update deals
    console.log('Would sync deals from HubSpot');

    return {
      synced: 0,
      type: 'hubspot_to_deals',
    };
  }

  private static async syncHubSpotToContacts(mapping: any, context: any) {
    // This would fetch data from HubSpot and create/update contacts
    console.log('Would sync contacts from HubSpot');

    return {
      synced: 0,
      type: 'hubspot_to_contacts',
    };
  }

  private static async syncDealsToGoogleSheets(mapping: any, context: any) {
    const deals = await DealService.getDeals({}, context);
    const dealsData = deals.edges.map(edge => edge.node);

    const rows = dealsData.map(deal => [
      deal.id,
      deal.title,
      deal.company,
      deal.contact,
      deal.value,
      deal.stage,
      deal.probability,
    ]);

    console.log(`Would sync ${rows.length} deals to Google Sheets`);

    return {
      synced: rows.length,
      type: 'deals_to_google_sheets',
    };
  }

  private static async syncContactsToGoogleSheets(mapping: any, context: any) {
    const contacts = await ContactService.getContacts({}, context);
    const contactsData = contacts.edges.map(edge => edge.node);

    const rows = contactsData.map(contact => [
      contact.id,
      contact.name,
      contact.email,
      contact.company,
      contact.position,
    ]);

    console.log(`Would sync ${rows.length} contacts to Google Sheets`);

    return {
      synced: rows.length,
      type: 'contacts_to_google_sheets',
    };
  }

  private static extractValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static scheduleSync(syncConfig: SyncConfig) {
    // Parse schedule (e.g., "every 1 hour", "daily at 9am")
    const interval = this.parseSchedule(syncConfig.schedule);

    if (interval) {
      const timeout = setInterval(async () => {
        try {
          // Get fresh context - this is a limitation, we'd need to store user context
          await this.triggerSync(syncConfig.id, { workspaceId: syncConfig.workspaceId });
        } catch (error) {
          console.error(`Scheduled sync failed for ${syncConfig.id}:`, error);
        }
      }, interval);

      this.activeSyncs.set(syncConfig.id, timeout);
    }
  }

  private static parseSchedule(schedule: string): number | null {
    // Simple schedule parsing - in production, use a proper cron parser
    if (schedule.includes('hour')) {
      const hours = parseInt(schedule.match(/\d+/)?.[0] || '1');
      return hours * 60 * 60 * 1000;
    }

    if (schedule.includes('minute')) {
      const minutes = parseInt(schedule.match(/\d+/)?.[0] || '1');
      return minutes * 60 * 1000;
    }

    if (schedule.includes('day')) {
      const days = parseInt(schedule.match(/\d+/)?.[0] || '1');
      return days * 24 * 60 * 60 * 1000;
    }

    return null;
  }

  private static async getSyncConfigById(id: string, context: any): Promise<SyncConfig | null> {
    const { data, error } = await supabase
      .from('sync_configs')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', context.workspaceId)
      .single();

    if (error) {
      console.error('Error fetching sync config:', error);
      return null;
    }

    return this.formatSyncConfig(data);
  }

  private static async updateSyncStatus(id: string, status: string, lastSync?: Date) {
    const updates: any = {
      sync_status: status,
    };

    if (lastSync) {
      updates.last_sync = lastSync;
    }

    await supabase
      .from('sync_configs')
      .update(updates)
      .eq('id', id);
  }

  private static formatSyncConfig(data: any): SyncConfig {
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      name: data.name,
      source: data.source,
      target: data.target,
      mapping: data.mapping,
      schedule: data.schedule,
      isActive: data.is_active,
      lastSync: data.last_sync ? new Date(data.last_sync) : undefined,
      syncStatus: data.sync_status,
    };
  }
}

export async function initializeSync() {
  // Load and schedule active sync configs
  const { data } = await supabase
    .from('sync_configs')
    .select('*')
    .eq('is_active', true);

  if (data) {
    data.forEach(config => {
      const syncConfig = SyncService['formatSyncConfig'](config);
      SyncService['scheduleSync'](syncConfig);
    });
  }

  console.log('✅ Data synchronization system initialized');
}