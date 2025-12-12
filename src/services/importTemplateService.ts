/**
 * Import Template Service - Manages predefined import templates for different CRM systems
 * Provides mapping configurations and validation rules for common data sources
 */

import { DataMapping, ValidationRule } from './enhancedImportService';

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'json' | 'excel';
  sourceSystem: 'salesforce' | 'hubspot' | 'pipedrive' | 'zoho' | 'custom';
  mappings: DataMapping[];
  validations: ValidationRule[];
  enrichment: {
    enrichCompanyData: boolean;
    enrichContactData: boolean;
    generateDealInsights: boolean;
    autoCategorize: boolean;
    predictDealValue: boolean;
    enhanceWithWebResearch: boolean;
  };
  targetEntity: 'deals' | 'contacts' | 'mixed';
  category: 'crm' | 'marketing' | 'sales' | 'custom';
  isPublic: boolean;
  usageCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

class ImportTemplateService {
  private templates: Map<string, ImportTemplate> = new Map();

  constructor() {
    this.initializeBuiltInTemplates();
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): ImportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): ImportTemplate[] {
    return this.getAllTemplates().filter(template => template.category === category);
  }

  /**
   * Get templates by source system
   */
  getTemplatesBySource(sourceSystem: string): ImportTemplate[] {
    return this.getAllTemplates().filter(template => template.sourceSystem === sourceSystem);
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): ImportTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Create custom template
   */
  createTemplate(template: Omit<ImportTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): ImportTemplate {
    const newTemplate: ImportTemplate = {
      ...template,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  /**
   * Update template
   */
  updateTemplate(templateId: string, updates: Partial<ImportTemplate>): ImportTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.templates.set(templateId, updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Delete template
   */
  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * Increment usage count
   */
  incrementUsage(templateId: string): void {
    const template = this.templates.get(templateId);
    if (template) {
      template.usageCount++;
      this.templates.set(templateId, template);
    }
  }

  /**
   * Get popular templates
   */
  getPopularTemplates(limit: number = 5): ImportTemplate[] {
    return this.getAllTemplates()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Search templates
   */
  searchTemplates(query: string): ImportTemplate[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getAllTemplates().filter(template =>
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.description.toLowerCase().includes(lowercaseQuery) ||
      template.sourceSystem.toLowerCase().includes(lowercaseQuery)
    );
  }

  private initializeBuiltInTemplates(): void {
    const builtInTemplates: ImportTemplate[] = [
      // Salesforce Templates
      {
        id: 'salesforce-opportunities',
        name: 'Salesforce Opportunities',
        description: 'Import deal opportunities from Salesforce Opportunities export',
        format: 'csv',
        sourceSystem: 'salesforce',
        category: 'crm',
        isPublic: true,
        usageCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        targetEntity: 'deals',
        mappings: [
          {
            sourceField: 'Opportunity Name',
            targetField: 'title',
            validation: [{
              field: 'title',
              type: 'required',
              validator: (value) => typeof value === 'string' && value.length > 0,
              errorMessage: 'Opportunity Name is required'
            }]
          },
          {
            sourceField: 'Account Name',
            targetField: 'company',
            validation: [{
              field: 'company',
              type: 'required',
              validator: (value) => typeof value === 'string' && value.length > 0,
              errorMessage: 'Account Name is required'
            }]
          },
          {
            sourceField: 'Amount',
            targetField: 'value',
            transformation: (value) => parseFloat(value) || 0,
            validation: [{
              field: 'value',
              type: 'custom',
              validator: (value) => !isNaN(Number(value)) && Number(value) >= 0,
              errorMessage: 'Amount must be a valid positive number'
            }]
          },
          {
            sourceField: 'Stage',
            targetField: 'stage',
            transformation: (value) => this.mapSalesforceStage(value),
            validation: [{
              field: 'stage',
              type: 'required',
              validator: (value) => ['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'].includes(value),
              errorMessage: 'Invalid Salesforce stage'
            }]
          },
          {
            sourceField: 'Close Date',
            targetField: 'dueDate',
            transformation: (value) => value ? new Date(value) : undefined
          },
          {
            sourceField: 'Probability',
            targetField: 'probability',
            transformation: (value) => parseInt(value) || 50,
            validation: [{
              field: 'probability',
              type: 'range',
              validator: (value) => Number(value) >= 0 && Number(value) <= 100,
              errorMessage: 'Probability must be between 0 and 100'
            }]
          }
        ],
        validations: [],
        enrichment: {
          enrichCompanyData: true,
          enrichContactData: false,
          generateDealInsights: true,
          autoCategorize: true,
          predictDealValue: false,
          enhanceWithWebResearch: false
        }
      },

      // HubSpot Templates
      {
        id: 'hubspot-deals',
        name: 'HubSpot Deals',
        description: 'Import deals from HubSpot Deals export',
        format: 'csv',
        sourceSystem: 'hubspot',
        category: 'crm',
        isPublic: true,
        usageCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        targetEntity: 'deals',
        mappings: [
          {
            sourceField: 'Deal Name',
            targetField: 'title',
            validation: [{
              field: 'title',
              type: 'required',
              validator: (value) => typeof value === 'string' && value.length > 0,
              errorMessage: 'Deal Name is required'
            }]
          },
          {
            sourceField: 'Company',
            targetField: 'company',
            validation: [{
              field: 'company',
              type: 'required',
              validator: (value) => typeof value === 'string' && value.length > 0,
              errorMessage: 'Company is required'
            }]
          },
          {
            sourceField: 'Amount',
            targetField: 'value',
            transformation: (value) => parseFloat(value) || 0
          },
          {
            sourceField: 'Deal Stage',
            targetField: 'stage',
            transformation: (value) => this.mapHubSpotStage(value)
          },
          {
            sourceField: 'Close Date',
            targetField: 'dueDate',
            transformation: (value) => value ? new Date(value) : undefined
          }
        ],
        validations: [],
        enrichment: {
          enrichCompanyData: true,
          enrichContactData: false,
          generateDealInsights: true,
          autoCategorize: false,
          predictDealValue: true,
          enhanceWithWebResearch: false
        }
      },

      // Pipedrive Templates
      {
        id: 'pipedrive-deals',
        name: 'Pipedrive Deals',
        description: 'Import deals from Pipedrive Deals export',
        format: 'csv',
        sourceSystem: 'pipedrive',
        category: 'crm',
        isPublic: true,
        usageCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        targetEntity: 'deals',
        mappings: [
          {
            sourceField: 'Title',
            targetField: 'title'
          },
          {
            sourceField: 'Organization',
            targetField: 'company'
          },
          {
            sourceField: 'Value',
            targetField: 'value',
            transformation: (value) => parseFloat(value) || 0
          },
          {
            sourceField: 'Stage',
            targetField: 'stage',
            transformation: (value) => this.mapPipedriveStage(value)
          },
          {
            sourceField: 'Expected close date',
            targetField: 'dueDate',
            transformation: (value) => value ? new Date(value) : undefined
          }
        ],
        validations: [],
        enrichment: {
          enrichCompanyData: true,
          enrichContactData: false,
          generateDealInsights: true,
          autoCategorize: true,
          predictDealValue: false,
          enhanceWithWebResearch: true
        }
      },

      // Generic CSV Template
      {
        id: 'generic-csv-deals',
        name: 'Generic CSV Deals',
        description: 'Import deals from any CSV file with standard columns',
        format: 'csv',
        sourceSystem: 'custom',
        category: 'custom',
        isPublic: true,
        usageCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        targetEntity: 'deals',
        mappings: [
          {
            sourceField: 'deal_name',
            targetField: 'title'
          },
          {
            sourceField: 'company_name',
            targetField: 'company'
          },
          {
            sourceField: 'deal_value',
            targetField: 'value',
            transformation: (value) => parseFloat(value) || 0
          },
          {
            sourceField: 'stage',
            targetField: 'stage'
          },
          {
            sourceField: 'close_date',
            targetField: 'dueDate',
            transformation: (value) => value ? new Date(value) : undefined
          },
          {
            sourceField: 'probability',
            targetField: 'probability',
            transformation: (value) => parseInt(value) || 50
          }
        ],
        validations: [],
        enrichment: {
          enrichCompanyData: false,
          enrichContactData: false,
          generateDealInsights: false,
          autoCategorize: false,
          predictDealValue: false,
          enhanceWithWebResearch: false
        }
      }
    ];

    builtInTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  private mapSalesforceStage(stage: string): string {
    const stageMap: Record<string, string> = {
      'Prospecting': 'qualification',
      'Qualification': 'qualification',
      'Proposal': 'proposal',
      'Negotiation': 'negotiation',
      'Closed Won': 'closed-won',
      'Closed Lost': 'closed-lost'
    };
    return stageMap[stage] || 'qualification';
  }

  private mapHubSpotStage(stage: string): string {
    const stageMap: Record<string, string> = {
      'Appointments Scheduled': 'qualification',
      'Qualified To Buy': 'qualification',
      'Presentation Scheduled': 'proposal',
      'Decision Maker Bought-In': 'proposal',
      'Contract Sent': 'negotiation',
      'Closed Won': 'closed-won',
      'Closed Lost': 'closed-lost'
    };
    return stageMap[stage] || 'qualification';
  }

  private mapPipedriveStage(stage: string): string {
    const stageMap: Record<string, string> = {
      'Contacted': 'qualification',
      'Contact made': 'qualification',
      'Demo scheduled': 'qualification',
      'Proposal made': 'proposal',
      'Negotiations started': 'negotiation',
      'Won': 'closed-won',
      'Lost': 'closed-lost'
    };
    return stageMap[stage] || 'qualification';
  }
}

// Singleton instance
let importTemplateServiceInstance: ImportTemplateService | null = null;

export const getImportTemplateService = (): ImportTemplateService => {
  if (!importTemplateServiceInstance) {
    importTemplateServiceInstance = new ImportTemplateService();
  }
  return importTemplateServiceInstance;
};

export { ImportTemplateService };