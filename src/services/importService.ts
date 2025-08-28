/**
 * Import Service - Handles data import functionality
 * Supports JSON and CSV formats with validation
 */

import { Deal } from '../types';
import { Contact } from '../types/contact';

export interface ImportResult<T> {
  success: T[];
  errors: ImportError[];
  totalProcessed: number;
  successCount: number;
  errorCount: number;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: any;
}

export interface ImportProgress {
  current: number;
  total: number;
  status: 'parsing' | 'validating' | 'processing' | 'complete' | 'error';
  message?: string;
}

class ImportService {
  /**
   * Import deals from file content
   */
  async importDeals(
    fileContent: string,
    format: 'json' | 'csv',
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult<Deal>> {
    try {
      onProgress?.({ current: 0, total: 0, status: 'parsing', message: 'Parsing file...' });

      let rawData: any[];
      if (format === 'json') {
        rawData = await this.parseJSON(fileContent);
      } else {
        rawData = await this.parseCSV(fileContent);
      }

      onProgress?.({ current: 0, total: rawData.length, status: 'validating', message: 'Validating data...' });

      const result: ImportResult<Deal> = {
        success: [],
        errors: [],
        totalProcessed: rawData.length,
        successCount: 0,
        errorCount: 0
      };

      for (let i = 0; i < rawData.length; i++) {
        const rowData = rawData[i];
        onProgress?.({ 
          current: i + 1, 
          total: rawData.length, 
          status: 'processing', 
          message: `Processing deal ${i + 1} of ${rawData.length}` 
        });

        try {
          const deal = await this.validateAndTransformDeal(rowData, i + 1);
          result.success.push(deal);
          result.successCount++;
        } catch (error) {
          result.errors.push({
            row: i + 1,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: rowData
          });
          result.errorCount++;
        }

        // Small delay to allow UI updates
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      onProgress?.({ 
        current: rawData.length, 
        total: rawData.length, 
        status: 'complete', 
        message: `Import complete: ${result.successCount} success, ${result.errorCount} errors` 
      });

      return result;
    } catch (error) {
      onProgress?.({ current: 0, total: 0, status: 'error', message: 'Import failed' });
      throw error;
    }
  }

  /**
   * Import contacts from file content
   */
  async importContacts(
    fileContent: string,
    format: 'json' | 'csv',
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult<Contact>> {
    try {
      onProgress?.({ current: 0, total: 0, status: 'parsing', message: 'Parsing file...' });

      let rawData: any[];
      if (format === 'json') {
        rawData = await this.parseJSON(fileContent);
      } else {
        rawData = await this.parseCSV(fileContent);
      }

      onProgress?.({ current: 0, total: rawData.length, status: 'validating', message: 'Validating data...' });

      const result: ImportResult<Contact> = {
        success: [],
        errors: [],
        totalProcessed: rawData.length,
        successCount: 0,
        errorCount: 0
      };

      for (let i = 0; i < rawData.length; i++) {
        const rowData = rawData[i];
        onProgress?.({ 
          current: i + 1, 
          total: rawData.length, 
          status: 'processing', 
          message: `Processing contact ${i + 1} of ${rawData.length}` 
        });

        try {
          const contact = await this.validateAndTransformContact(rowData, i + 1);
          result.success.push(contact);
          result.successCount++;
        } catch (error) {
          result.errors.push({
            row: i + 1,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: rowData
          });
          result.errorCount++;
        }

        // Small delay to allow UI updates
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      onProgress?.({ 
        current: rawData.length, 
        total: rawData.length, 
        status: 'complete', 
        message: `Import complete: ${result.successCount} success, ${result.errorCount} errors` 
      });

      return result;
    } catch (error) {
      onProgress?.({ current: 0, total: 0, status: 'error', message: 'Import failed' });
      throw error;
    }
  }

  private async parseJSON(content: string): Promise<any[]> {
    try {
      const parsed = JSON.parse(content);
      
      // Handle different JSON structures
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.deals && Array.isArray(parsed.deals)) {
        return parsed.deals;
      } else if (parsed.contacts && Array.isArray(parsed.contacts)) {
        return parsed.contacts;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      } else {
        throw new Error('Invalid JSON format. Expected array or object with data/deals/contacts property.');
      }
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async parseCSV(content: string): Promise<any[]> {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV must contain at least a header row and one data row');
      }

      const headers = this.parseCSVLine(lines[0]);
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length > 0 && values.some(v => v.trim())) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header.toLowerCase().trim()] = values[index]?.trim() || '';
          });
          rows.push(row);
        }
      }

      return rows;
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private async validateAndTransformDeal(data: any, row: number): Promise<Deal> {
    const errors: string[] = [];

    // Required fields validation
    if (!data.title || typeof data.title !== 'string') {
      errors.push('Title is required and must be a string');
    }
    if (!data.company || typeof data.company !== 'string') {
      errors.push('Company is required and must be a string');
    }
    if (!data.value || isNaN(Number(data.value))) {
      errors.push('Value is required and must be a valid number');
    }

    // Optional field validation
    if (data.stage && !['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'].includes(data.stage)) {
      errors.push('Stage must be one of: qualification, proposal, negotiation, closed-won, closed-lost');
    }
    if (data.priority && !['high', 'medium', 'low'].includes(data.priority)) {
      errors.push('Priority must be one of: high, medium, low');
    }
    if (data.probability && (isNaN(Number(data.probability)) || Number(data.probability) < 0 || Number(data.probability) > 100)) {
      errors.push('Probability must be a number between 0 and 100');
    }

    if (errors.length > 0) {
      throw new Error(`Row ${row}: ${errors.join(', ')}`);
    }

    // Transform and create deal object
    const deal: Deal = {
      id: data.id || `imported-deal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      company: data.company,
      contact: data.contact || '',
      contactId: data.contactId,
      value: Number(data.value),
      stage: data.stage || 'qualification',
      probability: Number(data.probability) || 50,
      priority: data.priority || 'medium',
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      notes: data.notes || '',
      tags: data.tags ? (Array.isArray(data.tags) ? data.tags : data.tags.split(',').map((t: string) => t.trim())) : [],
      customFields: data.customFields || {},
      socialProfiles: data.socialProfiles || {},
      lastActivity: data.lastActivity,
      isFavorite: Boolean(data.isFavorite),
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
    };

    return deal;
  }

  private async validateAndTransformContact(data: any, row: number): Promise<Contact> {
    const errors: string[] = [];

    // Required fields validation
    if (!data.email || typeof data.email !== 'string' || !/\S+@\S+\.\S+/.test(data.email)) {
      errors.push('Valid email is required');
    }
    if (!data.name && (!data.firstName || !data.lastName)) {
      errors.push('Name or firstName + lastName is required');
    }
    if (!data.company || typeof data.company !== 'string') {
      errors.push('Company is required and must be a string');
    }

    // Optional field validation
    if (data.status && !['lead', 'prospect', 'customer', 'churned'].includes(data.status)) {
      errors.push('Status must be one of: lead, prospect, customer, churned');
    }
    if (data.interestLevel && !['hot', 'medium', 'low', 'cold'].includes(data.interestLevel)) {
      errors.push('Interest level must be one of: hot, medium, low, cold');
    }

    if (errors.length > 0) {
      throw new Error(`Row ${row}: ${errors.join(', ')}`);
    }

    // Transform and create contact object
    const firstName = data.firstName || data.name?.split(' ')[0] || '';
    const lastName = data.lastName || data.name?.split(' ').slice(1).join(' ') || '';

    const contact: Contact = {
      id: data.id || `imported-contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      firstName,
      lastName,
      name: data.name || `${firstName} ${lastName}`,
      email: data.email,
      phone: data.phone,
      title: data.title || '',
      company: data.company,
      industry: data.industry,
      status: data.status || 'lead',
      interestLevel: data.interestLevel || 'medium',
      sources: data.sources ? (Array.isArray(data.sources) ? data.sources : data.sources.split(',').map((s: string) => s.trim())) : ['Import'],
      notes: data.notes || '',
      tags: data.tags ? (Array.isArray(data.tags) ? data.tags : data.tags.split(',').map((t: string) => t.trim())) : undefined,
      customFields: data.customFields || {},
      socialProfiles: data.socialProfiles || {},
      avatarSrc: data.avatarSrc,
      aiScore: data.aiScore ? Number(data.aiScore) : undefined,
      lastConnected: data.lastConnected,
      isFavorite: Boolean(data.isFavorite),
      isTeamMember: Boolean(data.isTeamMember),
      role: data.role,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
    };

    return contact;
  }
}

export const importService = new ImportService();