/**
 * Contact Template Service - Manages import templates for different CRM systems
 * Provides pre-built templates for Salesforce, HubSpot, LinkedIn, and custom templates
 */

export interface ContactFieldMapping {
  sourceField: string;
  targetField: keyof Contact | string;
  transform?: (value: any) => any;
  required?: boolean;
  validation?: (value: any) => boolean;
  defaultValue?: any;
}

export interface ContactImportTemplate {
  id: string;
  name: string;
  description: string;
  source: 'salesforce' | 'hubspot' | 'linkedin' | 'pipedrive' | 'zoho' | 'csv' | 'api' | 'custom';
  version: string;
  fieldMappings: ContactFieldMapping[];
  validationRules: ContactValidationRule[];
  transformationRules: ContactTransformationRule[];
  sampleData?: any[];
  usageStats: {
    totalImports: number;
    successRate: number;
    averageProcessingTime: number;
    lastUsed?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
  tags: string[];
}

export interface ContactValidationRule {
  field: string;
  rule: 'required' | 'email' | 'phone' | 'url' | 'enum' | 'regex' | 'custom';
  parameters?: any;
  errorMessage: string;
  severity: 'error' | 'warning';
}

export interface ContactTransformationRule {
  field: string;
  condition?: (value: any, row: any) => boolean;
  transform: (value: any, row: any) => any;
  description: string;
}

export interface ContactTemplateStats {
  totalTemplates: number;
  templatesBySource: Record<string, number>;
  mostUsedTemplates: ContactImportTemplate[];
  successRates: Record<string, number>;
}

// Import Contact type
import { Contact } from '../types/contact';

class ContactTemplateService {
  private templates: Map<string, ContactImportTemplate> = new Map();

  constructor() {
    this.initializeBuiltInTemplates();
  }

  /**
   * Initialize built-in templates for popular CRM systems
   */
  private initializeBuiltInTemplates(): void {
    // Salesforce Contacts Template
    this.createTemplate({
      id: 'salesforce-contacts-v1',
      name: 'Salesforce Contacts',
      description: 'Import contacts from Salesforce CRM with standard field mappings',
      source: 'salesforce',
      version: '1.0',
      fieldMappings: [
        { sourceField: 'Id', targetField: 'id', required: true },
        { sourceField: 'FirstName', targetField: 'firstName' },
        { sourceField: 'LastName', targetField: 'lastName' },
        { sourceField: 'Name', targetField: 'name' },
        { sourceField: 'Email', targetField: 'email', required: true },
        { sourceField: 'Phone', targetField: 'phone' },
        { sourceField: 'Title', targetField: 'title' },
        { sourceField: 'Account.Name', targetField: 'company' },
        { sourceField: 'Industry', targetField: 'industry' },
        { sourceField: 'LeadSource', targetField: 'sources', transform: (v) => [v] },
        { sourceField: 'Status', targetField: 'status', transform: this.mapSalesforceStatus },
        { sourceField: 'Rating', targetField: 'interestLevel', transform: this.mapSalesforceRating },
        { sourceField: 'CreatedDate', targetField: 'createdAt', transform: (v) => new Date(v) },
        { sourceField: 'LastModifiedDate', targetField: 'updatedAt', transform: (v) => new Date(v) }
      ],
      validationRules: [
        { field: 'email', rule: 'email', errorMessage: 'Invalid email format', severity: 'error' },
        { field: 'status', rule: 'enum', parameters: { values: ['lead', 'prospect', 'customer', 'churned'] }, errorMessage: 'Invalid status value', severity: 'error' }
      ],
      transformationRules: [
        {
          field: 'name',
          condition: (value, row) => !value && row.FirstName && row.LastName,
          transform: (value, row) => `${row.FirstName} ${row.LastName}`,
          description: 'Combine first and last name if full name is missing'
        }
      ],
      usageStats: { totalImports: 0, successRate: 0, averageProcessingTime: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
      tags: ['crm', 'salesforce', 'enterprise']
    });

    // HubSpot Contacts Template
    this.createTemplate({
      id: 'hubspot-contacts-v1',
      name: 'HubSpot Contacts',
      description: 'Import contacts from HubSpot CRM with lifecycle stage mappings',
      source: 'hubspot',
      version: '1.0',
      fieldMappings: [
        { sourceField: 'vid', targetField: 'id', required: true },
        { sourceField: 'properties.firstname.value', targetField: 'firstName' },
        { sourceField: 'properties.lastname.value', targetField: 'lastName' },
        { sourceField: 'properties.email.value', targetField: 'email', required: true },
        { sourceField: 'properties.phone.value', targetField: 'phone' },
        { sourceField: 'properties.jobtitle.value', targetField: 'title' },
        { sourceField: 'properties.company.value', targetField: 'company' },
        { sourceField: 'properties.industry.value', targetField: 'industry' },
        { sourceField: 'properties.lifecyclestage.value', targetField: 'status', transform: this.mapHubSpotLifecycle },
        { sourceField: 'properties.hs_lead_status.value', targetField: 'interestLevel', transform: this.mapHubSpotLeadStatus },
        { sourceField: 'properties.createdate.value', targetField: 'createdAt', transform: (v) => new Date(parseInt(v)) },
        { sourceField: 'properties.lastmodifieddate.value', targetField: 'updatedAt', transform: (v) => new Date(parseInt(v)) }
      ],
      validationRules: [
        { field: 'email', rule: 'email', errorMessage: 'Invalid email format', severity: 'error' }
      ],
      transformationRules: [],
      usageStats: { totalImports: 0, successRate: 0, averageProcessingTime: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
      tags: ['crm', 'hubspot', 'marketing']
    });

    // LinkedIn Sales Navigator Template
    this.createTemplate({
      id: 'linkedin-contacts-v1',
      name: 'LinkedIn Sales Navigator',
      description: 'Import contacts from LinkedIn Sales Navigator exports',
      source: 'linkedin',
      version: '1.0',
      fieldMappings: [
        { sourceField: 'First Name', targetField: 'firstName' },
        { sourceField: 'Last Name', targetField: 'lastName' },
        { sourceField: 'Email Address', targetField: 'email' },
        { sourceField: 'Phone Number', targetField: 'phone' },
        { sourceField: 'Job Title', targetField: 'title' },
        { sourceField: 'Company Name', targetField: 'company' },
        { sourceField: 'Industry', targetField: 'industry' },
        { sourceField: 'LinkedIn Profile URL', targetField: 'socialProfiles', transform: (v) => ({ linkedin: v }) },
        { sourceField: 'Connection Degree', targetField: 'interestLevel', transform: this.mapLinkedInConnection },
        { sourceField: 'Seniority Level', targetField: 'customFields', transform: (v) => ({ seniorityLevel: v }) }
      ],
      validationRules: [
        { field: 'email', rule: 'email', errorMessage: 'Invalid email format', severity: 'warning' }
      ],
      transformationRules: [
        {
          field: 'name',
          condition: (value, row) => !value,
          transform: (value, row) => `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim(),
          description: 'Create full name from first and last name'
        }
      ],
      usageStats: { totalImports: 0, successRate: 0, averageProcessingTime: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
      tags: ['social', 'linkedin', 'sales']
    });

    // Generic CSV Template
    this.createTemplate({
      id: 'generic-csv-contacts-v1',
      name: 'Generic CSV Contacts',
      description: 'Flexible template for custom CSV contact imports',
      source: 'csv',
      version: '1.0',
      fieldMappings: [
        { sourceField: 'id', targetField: 'id' },
        { sourceField: 'first_name', targetField: 'firstName' },
        { sourceField: 'last_name', targetField: 'lastName' },
        { sourceField: 'full_name', targetField: 'name' },
        { sourceField: 'email', targetField: 'email', required: true },
        { sourceField: 'phone', targetField: 'phone' },
        { sourceField: 'title', targetField: 'title' },
        { sourceField: 'company', targetField: 'company' },
        { sourceField: 'industry', targetField: 'industry' },
        { sourceField: 'status', targetField: 'status', transform: (v) => v?.toLowerCase() },
        { sourceField: 'interest_level', targetField: 'interestLevel', transform: (v) => v?.toLowerCase() },
        { sourceField: 'sources', targetField: 'sources', transform: (v) => v ? v.split(',').map((s: string) => s.trim()) : [] },
        { sourceField: 'tags', targetField: 'tags', transform: (v) => v ? v.split(',').map((t: string) => t.trim()) : undefined }
      ],
      validationRules: [
        { field: 'email', rule: 'email', errorMessage: 'Invalid email format', severity: 'error' },
        { field: 'status', rule: 'enum', parameters: { values: ['lead', 'prospect', 'customer', 'churned'] }, errorMessage: 'Status must be: lead, prospect, customer, or churned', severity: 'warning' },
        { field: 'interestLevel', rule: 'enum', parameters: { values: ['hot', 'medium', 'low', 'cold'] }, errorMessage: 'Interest level must be: hot, medium, low, or cold', severity: 'warning' }
      ],
      transformationRules: [],
      usageStats: { totalImports: 0, successRate: 0, averageProcessingTime: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: true,
      tags: ['generic', 'csv', 'flexible']
    });
  }

  /**
   * Field mapping transformers for different CRM systems
   */
  private mapSalesforceStatus(value: string): string {
    const statusMap: Record<string, string> = {
      'Open - Not Contacted': 'lead',
      'Working - Contacted': 'prospect',
      'Closed - Converted': 'customer',
      'Closed - Not Converted': 'churned'
    };
    return statusMap[value] || 'lead';
  }

  private mapSalesforceRating(value: string): string {
    const ratingMap: Record<string, string> = {
      'Hot': 'hot',
      'Warm': 'medium',
      'Cold': 'cold'
    };
    return ratingMap[value] || 'medium';
  }

  private mapHubSpotLifecycle(value: string): string {
    const lifecycleMap: Record<string, string> = {
      'lead': 'lead',
      'marketingqualifiedlead': 'prospect',
      'salesqualifiedlead': 'prospect',
      'opportunity': 'prospect',
      'customer': 'customer',
      'evangelist': 'customer',
      'other': 'lead'
    };
    return lifecycleMap[value?.toLowerCase()] || 'lead';
  }

  private mapHubSpotLeadStatus(value: string): string {
    const statusMap: Record<string, string> = {
      'NEW': 'cold',
      'OPEN': 'medium',
      'IN_PROGRESS': 'medium',
      'OPEN_DEAL': 'hot',
      'UNQUALIFIED': 'cold',
      'ATTEMPTED_TO_CONTACT': 'medium',
      'CONNECTED': 'hot',
      'BAD_TIMING': 'cold'
    };
    return statusMap[value] || 'medium';
  }

  private mapLinkedInConnection(value: string): string {
    const connectionMap: Record<string, string> = {
      '1st': 'hot',
      '2nd': 'medium',
      '3rd+': 'low'
    };
    return connectionMap[value] || 'medium';
  }

  /**
   * Create a new template
   */
  createTemplate(template: Omit<ContactImportTemplate, 'usageStats'> & Partial<Pick<ContactImportTemplate, 'usageStats'>>): ContactImportTemplate {
    const fullTemplate: ContactImportTemplate = {
      ...template,
      usageStats: template.usageStats || { totalImports: 0, successRate: 0, averageProcessingTime: 0 }
    };

    this.templates.set(template.id, fullTemplate);
    return fullTemplate;
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ContactImportTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): ContactImportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by source
   */
  getTemplatesBySource(source: string): ContactImportTemplate[] {
    return this.getAllTemplates().filter(template => template.source === source);
  }

  /**
   * Get default templates
   */
  getDefaultTemplates(): ContactImportTemplate[] {
    return this.getAllTemplates().filter(template => template.isDefault);
  }

  /**
   * Update template usage stats
   */
  updateTemplateStats(id: string, stats: Partial<ContactImportTemplate['usageStats']>): void {
    const template = this.templates.get(id);
    if (template) {
      template.usageStats = { ...template.usageStats, ...stats, lastUsed: new Date() };
      template.updatedAt = new Date();
    }
  }

  /**
   * Apply template to raw contact data
   */
  applyTemplate(templateId: string, rawData: any[]): Contact[] {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const contacts: Contact[] = [];

    for (const row of rawData) {
      try {
        const contact = this.applyFieldMappings(template, row);
        this.applyValidationRules(template, contact);
        this.applyTransformationRules(template, contact, row);
        contacts.push(contact);
      } catch (error) {
        console.warn(`Failed to process contact row:`, error);
        // Continue processing other rows
      }
    }

    // Update usage stats
    this.updateTemplateStats(templateId, {
      totalImports: template.usageStats.totalImports + 1
    });

    return contacts;
  }

  /**
   * Apply field mappings to transform raw data
   */
  private applyFieldMappings(template: ContactImportTemplate, row: any): Contact {
    const contact: any = {
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    for (const mapping of template.fieldMappings) {
      const sourceValue = this.getNestedValue(row, mapping.sourceField);

      if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
        let transformedValue = sourceValue;

        // Apply transformation if specified
        if (mapping.transform) {
          transformedValue = mapping.transform(sourceValue);
        }

        // Set the target field
        if (mapping.targetField.includes('.')) {
          // Handle nested fields like socialProfiles.linkedin
          this.setNestedValue(contact, mapping.targetField, transformedValue);
        } else {
          contact[mapping.targetField] = transformedValue;
        }
      } else if (mapping.defaultValue !== undefined) {
        // Apply default value if field is missing
        if (mapping.targetField.includes('.')) {
          this.setNestedValue(contact, mapping.targetField, mapping.defaultValue);
        } else {
          contact[mapping.targetField] = mapping.defaultValue;
        }
      }
    }

    return contact as Contact;
  }

  /**
   * Apply validation rules
   */
  private applyValidationRules(template: ContactImportTemplate, contact: Contact): void {
    for (const rule of template.validationRules) {
      const value = this.getNestedValue(contact, rule.field);

      if (!this.validateField(value, rule)) {
        if (rule.severity === 'error') {
          throw new Error(`${rule.field}: ${rule.errorMessage}`);
        } else {
          console.warn(`${rule.field}: ${rule.errorMessage}`);
        }
      }
    }
  }

  /**
   * Apply transformation rules
   */
  private applyTransformationRules(template: ContactImportTemplate, contact: Contact, row: any): void {
    for (const rule of template.transformationRules) {
      const currentValue = this.getNestedValue(contact, rule.field);

      if (!rule.condition || rule.condition(currentValue, row)) {
        const newValue = rule.transform(currentValue, row);
        this.setNestedValue(contact, rule.field, newValue);
      }
    }
  }

  /**
   * Validate a field against a rule
   */
  private validateField(value: any, rule: ContactValidationRule): boolean {
    if (value === undefined || value === null || value === '') {
      return rule.rule !== 'required';
    }

    switch (rule.rule) {
      case 'required':
        return value !== undefined && value !== null && value !== '';
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'phone':
        return /^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, ''));
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'enum':
        return rule.parameters?.values?.includes(value);
      case 'regex':
        return new RegExp(rule.parameters?.pattern).test(value);
      case 'custom':
        return rule.parameters?.validator?.(value) || false;
      default:
        return true;
    }
  }

  /**
   * Get nested object value by dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested object value by dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): ContactTemplateStats {
    const templates = this.getAllTemplates();
    const templatesBySource: Record<string, number> = {};
    const successRates: Record<string, number> = {};

    templates.forEach(template => {
      templatesBySource[template.source] = (templatesBySource[template.source] || 0) + 1;
      successRates[template.id] = template.usageStats.successRate;
    });

    const mostUsedTemplates = templates
      .sort((a, b) => b.usageStats.totalImports - a.usageStats.totalImports)
      .slice(0, 5);

    return {
      totalTemplates: templates.length,
      templatesBySource,
      mostUsedTemplates,
      successRates
    };
  }

  /**
   * Delete a template
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Clone a template
   */
  cloneTemplate(id: string, newName: string, newId?: string): ContactImportTemplate | null {
    const template = this.getTemplate(id);
    if (!template) return null;

    const clonedTemplate = {
      ...template,
      id: newId || `${id}-clone-${Date.now()}`,
      name: newName,
      isDefault: false,
      usageStats: { totalImports: 0, successRate: 0, averageProcessingTime: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(clonedTemplate.id, clonedTemplate);
    return clonedTemplate;
  }
}

export const contactTemplateService = new ContactTemplateService();