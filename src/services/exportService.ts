/**
 * Export Service - Handles data export functionality
 * Supports JSON and CSV formats with proper serialization
 */

import { Deal } from '../types';
import { Contact } from '../types/contact';

export interface ExportOptions {
  format: 'json' | 'csv';
  includeMetadata?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportProgress {
  current: number;
  total: number;
  status: 'preparing' | 'processing' | 'complete' | 'error';
  message?: string;
}

class ExportService {
  /**
   * Export deals to specified format
   */
  async exportDeals(
    deals: Deal[], 
    options: ExportOptions, 
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    try {
      onProgress?.({ current: 0, total: deals.length, status: 'preparing', message: 'Preparing export...' });

      // Filter by date range if specified
      let filteredDeals = deals;
      if (options.dateRange) {
        filteredDeals = deals.filter(deal => {
          const dealDate = new Date(deal.createdAt);
          return dealDate >= options.dateRange!.start && dealDate <= options.dateRange!.end;
        });
      }

      onProgress?.({ current: 0, total: filteredDeals.length, status: 'processing', message: 'Processing data...' });

      if (options.format === 'json') {
        return await this.exportToJSON(filteredDeals, options, onProgress);
      } else {
        return await this.exportToCSV(filteredDeals, options, onProgress);
      }
    } catch (error) {
      onProgress?.({ current: 0, total: deals.length, status: 'error', message: 'Export failed' });
      throw error;
    }
  }

  /**
   * Export contacts to specified format
   */
  async exportContacts(
    contacts: Contact[], 
    options: ExportOptions, 
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    try {
      onProgress?.({ current: 0, total: contacts.length, status: 'preparing', message: 'Preparing export...' });

      if (options.format === 'json') {
        return await this.exportContactsToJSON(contacts, options, onProgress);
      } else {
        return await this.exportContactsToCSV(contacts, options, onProgress);
      }
    } catch (error) {
      onProgress?.({ current: 0, total: contacts.length, status: 'error', message: 'Export failed' });
      throw error;
    }
  }

  private async exportToJSON(
    deals: Deal[], 
    options: ExportOptions, 
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    const exportData = {
      metadata: options.includeMetadata ? {
        exportDate: new Date().toISOString(),
        totalRecords: deals.length,
        version: '1.0'
      } : undefined,
      deals: deals.map((deal, index) => {
        onProgress?.({ 
          current: index + 1, 
          total: deals.length, 
          status: 'processing', 
          message: `Processing deal ${index + 1} of ${deals.length}` 
        });

        return {
          id: deal.id,
          title: deal.title,
          company: deal.company,
          contact: deal.contact,
          contactId: deal.contactId,
          value: deal.value,
          stage: deal.stage,
          probability: deal.probability,
          priority: deal.priority,
          dueDate: deal.dueDate?.toISOString(),
          notes: deal.notes,
          tags: deal.tags,
          customFields: deal.customFields,
          socialProfiles: deal.socialProfiles,
          lastActivity: deal.lastActivity,
          isFavorite: deal.isFavorite,
          createdAt: deal.createdAt.toISOString(),
          updatedAt: deal.updatedAt.toISOString()
        };
      })
    };

    onProgress?.({ current: deals.length, total: deals.length, status: 'complete', message: 'Export complete' });
    return JSON.stringify(exportData, null, 2);
  }

  private async exportToCSV(
    deals: Deal[], 
    options: ExportOptions, 
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    const headers = [
      'id', 'title', 'company', 'contact', 'contactId', 'value', 'stage', 
      'probability', 'priority', 'dueDate', 'notes', 'tags', 'lastActivity',
      'isFavorite', 'createdAt', 'updatedAt'
    ];

    const rows = deals.map((deal, index) => {
      onProgress?.({ 
        current: index + 1, 
        total: deals.length, 
        status: 'processing', 
        message: `Processing deal ${index + 1} of ${deals.length}` 
      });

      return [
        deal.id,
        deal.title,
        deal.company,
        deal.contact,
        deal.contactId || '',
        deal.value,
        deal.stage,
        deal.probability,
        deal.priority,
        deal.dueDate?.toISOString() || '',
        (deal.notes || '').replace(/\n/g, ' '),
        (deal.tags || []).join(';'),
        deal.lastActivity || '',
        deal.isFavorite || false,
        deal.createdAt.toISOString(),
        deal.updatedAt.toISOString()
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell);
        return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
          ? `"${cellStr.replace(/"/g, '""')}"`
          : cellStr;
      }).join(','))
    ].join('\n');

    onProgress?.({ current: deals.length, total: deals.length, status: 'complete', message: 'Export complete' });
    return csvContent;
  }

  private async exportContactsToJSON(
    contacts: Contact[], 
    options: ExportOptions, 
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    const exportData = {
      metadata: options.includeMetadata ? {
        exportDate: new Date().toISOString(),
        totalRecords: contacts.length,
        version: '1.0'
      } : undefined,
      contacts: contacts.map((contact, index) => {
        onProgress?.({ 
          current: index + 1, 
          total: contacts.length, 
          status: 'processing', 
          message: `Processing contact ${index + 1} of ${contacts.length}` 
        });

        return {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          company: contact.company,
          industry: contact.industry,
          status: contact.status,
          interestLevel: contact.interestLevel,
          sources: contact.sources,
          notes: contact.notes,
          tags: contact.tags,
          customFields: contact.customFields,
          socialProfiles: contact.socialProfiles,
          avatarSrc: contact.avatarSrc,
          aiScore: contact.aiScore,
          lastConnected: contact.lastConnected,
          isFavorite: contact.isFavorite,
          isTeamMember: contact.isTeamMember,
          role: contact.role,
          createdAt: contact.createdAt.toISOString(),
          updatedAt: contact.updatedAt.toISOString()
        };
      })
    };

    onProgress?.({ current: contacts.length, total: contacts.length, status: 'complete', message: 'Export complete' });
    return JSON.stringify(exportData, null, 2);
  }

  private async exportContactsToCSV(
    contacts: Contact[], 
    options: ExportOptions, 
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    const headers = [
      'id', 'firstName', 'lastName', 'name', 'email', 'phone', 'title', 'company',
      'industry', 'status', 'interestLevel', 'sources', 'notes', 'tags', 'aiScore',
      'lastConnected', 'isFavorite', 'isTeamMember', 'role', 'createdAt', 'updatedAt'
    ];

    const rows = contacts.map((contact, index) => {
      onProgress?.({ 
        current: index + 1, 
        total: contacts.length, 
        status: 'processing', 
        message: `Processing contact ${index + 1} of ${contacts.length}` 
      });

      return [
        contact.id,
        contact.firstName,
        contact.lastName,
        contact.name,
        contact.email,
        contact.phone || '',
        contact.title,
        contact.company,
        contact.industry || '',
        contact.status,
        contact.interestLevel,
        (contact.sources || []).join(';'),
        (contact.notes || '').replace(/\n/g, ' '),
        (contact.tags || []).join(';'),
        contact.aiScore || '',
        contact.lastConnected || '',
        contact.isFavorite || false,
        contact.isTeamMember || false,
        contact.role || '',
        contact.createdAt.toISOString(),
        contact.updatedAt.toISOString()
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell);
        return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
          ? `"${cellStr.replace(/"/g, '""')}"`
          : cellStr;
      }).join(','))
    ].join('\n');

    onProgress?.({ current: contacts.length, total: contacts.length, status: 'complete', message: 'Export complete' });
    return csvContent;
  }

  /**
   * Download exported data as file
   */
  downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const exportService = new ExportService();