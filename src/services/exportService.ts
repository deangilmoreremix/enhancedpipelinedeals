/**
 * Export Service - Handles data export functionality
 * Supports JSON and CSV formats with proper serialization
 */

import { Deal, ViewFilter, ViewColumn, ExportTemplate } from '../types';
import { Contact } from '../types/contact';
import * as ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import type { Company } from '../types';
import type { DealFieldDefinition } from '../types/customFields';
import type { CompanyRollup } from '../utils/rollups';
import { customExportColumns, exportDefinitions } from './customFieldExport';
import 'jspdf-autotable';

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf' | 'xml';
  includeMetadata?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  template?: ExportTemplate;
  customColumns?: ViewColumn[];
  filters?: ViewFilter[];
  /** Custom field definitions to export as extra columns (default: the active ones of the exported record type). */
  customFieldDefs?: DealFieldDefinition[];
  /** Company rollup rows by company id (companies export). */
  rollups?: Map<string, CompanyRollup>;
}

const csvCell = (cell: unknown): string => {
  const str = String(cell ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
};

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

      switch (options.format) {
        case 'json':
          return await this.exportToJSON(filteredDeals, options, onProgress);
        case 'csv':
          return await this.exportToCSV(filteredDeals, options, onProgress);
        case 'xlsx':
          return await this.exportToExcel(filteredDeals, options, onProgress);
        case 'pdf':
          return await this.exportToPDF(filteredDeals, options, onProgress);
        case 'xml':
          return await this.exportToXML(filteredDeals, options, onProgress);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
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

  /** Export companies (csv | json | xlsx base64) with one column per active custom field (rollups computed). */
  async exportCompanies(companies: Company[], options: ExportOptions): Promise<string> {
    const custom = customExportColumns<Company>('company', await exportDefinitions('company', options.customFieldDefs), { rollups: options.rollups });
    const base = ['id', 'name', 'industry', 'website', 'domain', 'size', 'revenue', 'phone', 'address', 'notes', 'ownerId', 'createdAt', 'updatedAt'] as const;
    const baseCell = (c: Company, k: (typeof base)[number]): string => {
      const v = c[k];
      return v instanceof Date ? v.toISOString() : v === undefined || v === null ? '' : String(v).replace(/\r?\n/g, ' ');
    };
    const rows = companies.map(c => [...base.map(k => baseCell(c, k)), ...custom.cells(c)]);
    const headers = [...base, ...custom.headers];
    if (options.format === 'json') {
      return JSON.stringify({
        metadata: options.includeMetadata ? { exportDate: new Date().toISOString(), totalRecords: companies.length, version: '1.0' } : undefined,
        companies: rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
      }, null, 2);
    }
    if (options.format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Companies');
      sheet.addRow(headers);
      sheet.getRow(1).font = { bold: true };
      rows.forEach(r => sheet.addRow(r));
      return this.arrayBufferToBase64(await workbook.xlsx.writeBuffer() as ArrayBuffer);
    }
    return [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
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
    const custom = customExportColumns<Deal>('deal', await exportDefinitions('deal', options.customFieldDefs));
    const headers = [
      'id', 'title', 'company', 'contact', 'contactId', 'value', 'stage', 
      'probability', 'priority', 'dueDate', 'notes', 'tags', 'lastActivity',
      'isFavorite', 'createdAt', 'updatedAt', ...custom.headers
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
        deal.updatedAt.toISOString(),
        ...custom.cells(deal)
      ];
    });

    const csvContent = [
      headers.map(csvCell).join(','),
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

  private async exportToExcel(
    deals: Deal[],
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Twenty CRM';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Deals');

    // Define columns based on template or default
    const columns = options.template?.fields || [
      'id', 'title', 'company', 'contact', 'value', 'stage', 'probability',
      'priority', 'dueDate', 'notes', 'createdAt', 'updatedAt'
    ];

    const custom = customExportColumns<Deal>('deal', await exportDefinitions('deal', options.customFieldDefs));

    // Set up worksheet columns (custom fields follow the built-in ones)
    worksheet.columns = [
      ...columns.map(col => ({ header: this.formatColumnHeader(col), key: col, width: this.getColumnWidth(col) })),
      ...custom.columns.map(c => ({ header: c.header, key: `cf:${c.key}`, width: 18 })),
    ];

    // Add data rows
    deals.forEach((deal, index) => {
      onProgress?.({
        current: index + 1,
        total: deals.length,
        status: 'processing',
        message: `Processing deal ${index + 1} of ${deals.length}`
      });

      const rowData: any = {};
      columns.forEach(col => {
        rowData[col] = this.formatCellValue(deal, col);
      });
      const customCells = custom.cells(deal);
      custom.columns.forEach((c, i) => { rowData[`cf:${c.key}`] = customCells[i]; });
      worksheet.addRow(rowData);
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    onProgress?.({ current: deals.length, total: deals.length, status: 'complete', message: 'Export complete' });

    const buffer = await workbook.xlsx.writeBuffer();
    return this.arrayBufferToBase64(buffer);
  }

  private async exportToPDF(
    deals: Deal[],
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(16);
    doc.text('Deals Export', 20, 20);

    // Add metadata
    if (options.includeMetadata) {
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);
      doc.text(`Total Records: ${deals.length}`, 20, 45);
    }

    // Prepare table data
    const columns = options.template?.fields || [
      'title', 'company', 'contact', 'value', 'stage', 'probability'
    ];

    const headers = columns.map(col => this.formatColumnHeader(col));
    const data = deals.map(deal =>
      columns.map(col => String(this.formatCellValue(deal, col) || ''))
    );

    // Add table
    (doc as any).autoTable({
      head: [headers],
      body: data,
      startY: options.includeMetadata ? 55 : 30,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [230, 230, 250],
        textColor: 0,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });

    onProgress?.({ current: deals.length, total: deals.length, status: 'complete', message: 'Export complete' });

    return doc.output('datauristring');
  }

  private async exportToXML(
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

        const dealElement: any = {
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

        // Remove undefined values
        Object.keys(dealElement).forEach(key => {
          if (dealElement[key] === undefined) {
            delete dealElement[key];
          }
        });

        return dealElement;
      })
    };

    onProgress?.({ current: deals.length, total: deals.length, status: 'complete', message: 'Export complete' });

    // Convert to XML string
    return this.objectToXML(exportData);
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
    const custom = customExportColumns<Contact>('contact', await exportDefinitions('contact', options.customFieldDefs));
    const headers = [
      'id', 'firstName', 'lastName', 'name', 'email', 'phone', 'title', 'company',
      'industry', 'status', 'interestLevel', 'sources', 'notes', 'tags', 'aiScore',
      'lastConnected', 'isFavorite', 'isTeamMember', 'role', 'createdAt', 'updatedAt', ...custom.headers
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
        contact.updatedAt.toISOString(),
        ...custom.cells(contact)
      ];
    });

    const csvContent = [
      headers.map(csvCell).join(','),
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

  private formatColumnHeader(column: string): string {
    return column
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/Id$/, 'ID');
  }

  private getColumnWidth(column: string): number {
    const widths: Record<string, number> = {
      id: 30,
      title: 25,
      company: 20,
      contact: 20,
      value: 15,
      stage: 15,
      probability: 12,
      priority: 10,
      dueDate: 15,
      notes: 40,
      createdAt: 20,
      updatedAt: 20
    };
    return widths[column] || 15;
  }

  private formatCellValue(deal: Deal, column: string): any {
    const value = (deal as any)[column];
    if (value === null || value === undefined) return '';

    switch (column) {
      case 'value':
        return typeof value === 'number' ? `$${value.toLocaleString()}` : value;
      case 'probability':
        return typeof value === 'number' ? `${value}%` : value;
      case 'dueDate':
      case 'createdAt':
      case 'updatedAt':
        return value instanceof Date ? value.toLocaleDateString() : value;
      case 'tags':
        return Array.isArray(value) ? value.join(', ') : value;
      default:
        return value;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private objectToXML(obj: any, rootName = 'root'): string {
    const convertToXML = (obj: any, name: string, indent = ''): string => {
      if (obj === null || obj === undefined) return '';

      if (typeof obj === 'object' && !Array.isArray(obj)) {
        let xml = `${indent}<${name}>\n`;
        for (const [key, value] of Object.entries(obj)) {
          xml += convertToXML(value, key, indent + '  ');
        }
        xml += `${indent}</${name}>\n`;
        return xml;
      } else if (Array.isArray(obj)) {
        let xml = '';
        for (const item of obj) {
          xml += convertToXML(item, name.replace(/s$/, ''), indent);
        }
        return xml;
      } else {
        const escapedValue = String(obj)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        return `${indent}<${name}>${escapedValue}</${name}>\n`;
      }
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n${convertToXML(obj, rootName)}`;
  }
}

export const exportService = new ExportService();