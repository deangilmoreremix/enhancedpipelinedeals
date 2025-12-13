import React, { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Settings,
  Zap,
  Users,
  Shield,
  BarChart3,
  Download,
  Eye,
  RefreshCw,
  TrendingUp,
  Target,
  UserPlus
} from 'lucide-react';
import { enhancedContactImportService, ContactImportResult, ContactImportProgress, AIEnrichmentData } from '../../services/enhancedContactImportService';
import { contactTemplateService, ContactImportTemplate } from '../../services/contactTemplateService';
import { contactDuplicateService, DuplicateAnalysis, DuplicateResolution } from '../../services/contactDuplicateService';
import { AIErrorBoundary } from '../ui/AIErrorBoundary';
import { Contact } from '../../types/contact';
import { ContactForm } from './ContactForm';

interface ContactImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (results: ContactImportResult<any>) => void;
}

type WizardStep = 'method-selection' | 'upload' | 'template' | 'preview' | 'enrichment' | 'duplicates' | 'import' | 'single-form' | 'complete';
type ImportMethod = 'bulk' | 'single';

interface ImportState {
  method: ImportMethod;
  file: File | null;
  fileContent: string | ArrayBuffer;
  format: 'csv' | 'json' | 'excel' | 'xml' | 'tsv' | 'yaml';
  template: ContactImportTemplate | null;
  enrichmentOptions: {
    enrichCompanyData: boolean;
    discoverSocialProfiles: boolean;
    analyzeBuyingSignals: boolean;
    generateLeadScoring: boolean;
    includeWebResearch: boolean;
    maxResearchResults: number;
  };
  previewData: any[];
  importResults: ContactImportResult<any> | null;
  duplicates: DuplicateAnalysis[];
  singleContactData: Partial<Contact>;
  currentStep: WizardStep;
  isProcessing: boolean;
  progress: ContactImportProgress | null;
}

export const ContactImportWizard: React.FC<ContactImportWizardProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [state, setState] = useState<ImportState>({
    method: 'bulk',
    file: null,
    fileContent: '',
    format: 'csv',
    template: null,
    enrichmentOptions: {
      enrichCompanyData: true,
      discoverSocialProfiles: true,
      analyzeBuyingSignals: true,
      generateLeadScoring: true,
      includeWebResearch: true,
      maxResearchResults: 3
    },
    previewData: [],
    importResults: null,
    duplicates: [],
    singleContactData: {},
    currentStep: 'method-selection',
    isProcessing: false,
    progress: null
  });

  const updateState = useCallback((updates: Partial<ImportState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      let content: string | ArrayBuffer;
      let format: 'csv' | 'json' | 'excel' | 'xml' | 'tsv' | 'yaml';

      // Detect format from file extension
      const extension = file.name.split('.').pop()?.toLowerCase();

      switch (extension) {
        case 'xlsx':
        case 'xls':
        case 'xlsm':
        case 'xlsb':
          format = 'excel';
          content = await file.arrayBuffer();
          break;
        case 'xml':
          format = 'xml';
          content = await file.text();
          break;
        case 'tsv':
          format = 'tsv';
          content = await file.text();
          break;
        case 'yaml':
        case 'yml':
          format = 'yaml';
          content = await file.text();
          break;
        case 'json':
          format = 'json';
          content = await file.text();
          break;
        default:
          format = 'csv';
          content = await file.text();
      }

      // Parse and preview data
      let previewData: any[] = [];

      if (format === 'excel') {
        // For Excel, we'll need to parse it on the server side
        // For preview, show a placeholder
        previewData = [{ note: 'Excel file detected - preview available after processing' }];
      } else if (format === 'json') {
        try {
          const parsed = JSON.parse(content as string);
          previewData = Array.isArray(parsed) ? parsed.slice(0, 5) :
                       parsed.contacts ? parsed.contacts.slice(0, 5) :
                       parsed.data ? parsed.data.slice(0, 5) : [];
        } catch (error) {
          previewData = [{ error: 'Invalid JSON format' }];
        }
      } else if (format === 'xml') {
        // For XML, show a placeholder since parsing is complex
        previewData = [{ note: 'XML file detected - preview available after processing' }];
      } else if (format === 'yaml') {
        try {
          const yaml = await import('js-yaml');
          const parsed = yaml.load(content as string) as any;
          previewData = Array.isArray(parsed) ? parsed.slice(0, 5) :
                       parsed.contacts ? parsed.contacts.slice(0, 5) :
                       parsed.data ? parsed.data.slice(0, 5) : [];
        } catch (error) {
          previewData = [{ error: 'Invalid YAML format' }];
        }
      } else {
        // For CSV, TSV, etc.
        const delimiter = format === 'tsv' ? '\t' : ',';
        const lines = (content as string).split('\n').filter(line => line.trim());
        if (lines.length > 1) {
          const headers = lines[0].split(delimiter).map(h => h.trim());
          previewData = lines.slice(1, 6).map(line => {
            const values = line.split(delimiter).map(v => v.trim());
            const row: any = {};
            headers.forEach((header, index) => {
              row[headers[index]] = values[index] || '';
            });
            return row;
          });
        }
      }

      updateState({
        file,
        fileContent: content,
        format,
        previewData,
        currentStep: 'template'
      });
    } catch (error) {
      console.error('File upload failed:', error);
      // Handle error appropriately
    }
  }, [updateState]);

  const handleTemplateSelect = useCallback((template: ContactImportTemplate) => {
    updateState({ template, currentStep: 'preview' });
  }, [updateState]);

  const handleStartImport = useCallback(async () => {
    if (!state.fileContent || !state.template) return;

    updateState({ isProcessing: true, currentStep: 'enrichment' });

    try {
      const results = await enhancedContactImportService.importContactsWithAI(
        state.fileContent,
        state.format,
        state.enrichmentOptions,
        (progress) => {
          updateState({ progress });
        }
      );

      // Check for duplicates
      if (results.duplicates.length > 0) {
        updateState({
          importResults: results,
          duplicates: results.duplicates,
          currentStep: 'duplicates',
          isProcessing: false,
          progress: null
        });
      } else {
        updateState({
          importResults: results,
          currentStep: 'complete',
          isProcessing: false,
          progress: null
        });
        onImportComplete(results);
      }
    } catch (error) {
      console.error('Import failed:', error);
      updateState({ isProcessing: false, progress: null });
    }
  }, [state, updateState, onImportComplete]);

  const handleSingleContactSubmit = useCallback(async (contact: Contact & AIEnrichmentData) => {
    updateState({ isProcessing: true });

    try {
      // For single contact creation, we'll skip duplicate checking for now
      // In production, you'd implement proper duplicate detection
      console.log('Creating single contact:', contact.name);

      // Create mock import result for single contact
      const importResult: ContactImportResult<Contact & AIEnrichmentData> = {
        success: [contact],
        errors: [],
        duplicates: [],
        totalProcessed: 1,
        successCount: 1,
        errorCount: 0,
        duplicateCount: 0,
        enrichedCount: 1,
        processingTime: 0
      };

      updateState({
        importResults: importResult,
        currentStep: 'complete',
        isProcessing: false
      });

      onImportComplete(importResult);
    } catch (error) {
      console.error('Single contact creation failed:', error);
      updateState({ isProcessing: false });
      // Handle error appropriately
    }
  }, [updateState, onImportComplete]);

  const handleDuplicateResolution = useCallback(async (resolutions: DuplicateResolution[]) => {
    if (!state.importResults) return;

    updateState({ isProcessing: true, currentStep: 'import' });

    // Apply duplicate resolutions
    const resolvedResults = { ...state.importResults };
    for (let i = 0; i < resolutions.length; i++) {
      const resolution = resolutions[i];
      const duplicate = state.duplicates[i];

      if (resolution.action === 'merge' && duplicate.mergeStrategy) {
        // Add merged contact to success
        resolvedResults.success.push(duplicate.mergeStrategy.primaryContact);
        resolvedResults.successCount++;
      } else if (resolution.action === 'keep_both') {
        // Add imported contact to success
        resolvedResults.success.push(duplicate.imported);
        resolvedResults.successCount++;
      }
      // For 'skip', do nothing (contact is discarded)
    }

    updateState({
      importResults: resolvedResults,
      currentStep: 'complete',
      isProcessing: false
    });

    onImportComplete(resolvedResults);
  }, [state, updateState, onImportComplete]);

  const renderStepIndicator = () => {
    const steps: { key: WizardStep; label: string; icon: React.ComponentType<any> }[] = [
      { key: 'method-selection', label: 'Method', icon: Settings },
      { key: 'upload', label: 'Upload', icon: Upload },
      { key: 'template', label: 'Template', icon: Settings },
      { key: 'preview', label: 'Preview', icon: Eye },
      { key: 'enrichment', label: 'Enrich', icon: Zap },
      { key: 'duplicates', label: 'Duplicates', icon: Users },
      { key: 'import', label: 'Import', icon: Download },
      { key: 'single-form', label: 'Form', icon: UserPlus },
      { key: 'complete', label: 'Complete', icon: CheckCircle }
    ];

    // Filter steps based on selected method
    const filteredSteps = steps.filter(step => {
      if (state.method === 'single') {
        return ['method-selection', 'single-form', 'complete'].includes(step.key);
      } else {
        return !['single-form'].includes(step.key);
      }
    });

    return (
      <div className="flex items-center justify-between mb-8">
        {filteredSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === state.currentStep;
          const isCompleted = filteredSteps.findIndex(s => s.key === state.currentStep) > index;

          return (
            <React.Fragment key={step.key}>
              <div className={`flex flex-col items-center ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  isActive ? 'border-blue-600 bg-blue-50' :
                  isCompleted ? 'border-green-600 bg-green-50' :
                  'border-gray-300 bg-gray-50'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs mt-2 font-medium">{step.label}</span>
              </div>
              {index < filteredSteps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  isCompleted ? 'bg-green-600' : 'bg-gray-300'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderMethodSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          How would you like to add contacts?
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Choose between bulk import from files or adding individual contacts with AI enrichment
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bulk Import Option */}
        <div
          onClick={() => updateState({ method: 'bulk', currentStep: 'upload' })}
          className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
        >
          <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Bulk Import
          </h4>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
            Upload CSV, Excel, JSON, XML, TSV, or YAML files with multiple contacts
          </p>
          <div className="flex flex-wrap gap-1">
            {['CSV', 'Excel', 'JSON', 'XML', 'TSV', 'YAML'].map(format => (
              <span key={format} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                {format}
              </span>
            ))}
          </div>
        </div>

        {/* Single Contact Option */}
        <div
          onClick={() => updateState({ method: 'single', currentStep: 'single-form' })}
          className="border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-green-500 hover:shadow-md transition-all cursor-pointer"
        >
          <UserPlus className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Add Single Contact
          </h4>
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
            Manually add one contact with AI-powered enrichment and validation
          </p>
          <div className="flex flex-wrap gap-1">
            {['AI Enrichment', 'Validation', 'Smart Fields'].map(feature => (
              <span key={feature} className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSingleContactForm = () => (
    <div className="space-y-6">
      <div className="text-center">
        <UserPlus className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Add New Contact
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Enter contact details and we'll enrich them with AI-powered intelligence
        </p>
      </div>

      <ContactForm
        initialData={state.singleContactData}
        onSubmit={handleSingleContactSubmit}
        onCancel={() => updateState({ currentStep: 'method-selection' })}
        enrichmentOptions={state.enrichmentOptions}
        isLoading={state.isProcessing}
      />
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Import Contacts
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Upload CSV, Excel, JSON, XML, TSV, or YAML files to import contacts with AI-powered enrichment
        </p>
      </div>

      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
        <input
          type="file"
          accept=".csv,.json,.xlsx,.xls,.xml,.tsv,.yaml,.yml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Choose a file or drag it here
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            Supports CSV, Excel, JSON, XML, TSV, and YAML formats up to 10MB
          </p>
        </label>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100">AI-Powered Import</h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Your contacts will be automatically enriched with company data, social profiles, and lead scoring using AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTemplateStep = () => {
    const templates = contactTemplateService.getDefaultTemplates();

    return (
      <div className="space-y-6">
        <div className="text-center">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Choose Import Template
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Select a template that matches your data source for accurate field mapping
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">{template.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{template.description}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {template.source}
                    </span>
                    <span className="text-xs text-gray-500">
                      {template.fieldMappings.length} fields
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Data Preview
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Review your data before importing. Template: {state.template?.name}
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {Object.keys(state.previewData[0] || {}).map(header => (
                  <th key={header} className="text-left py-2 px-3 font-medium text-gray-900 dark:text-white">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.previewData.map((row, index) => (
                <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                  {Object.values(row).map((value: any, cellIndex) => (
                    <td key={cellIndex} className="py-2 px-3 text-gray-700 dark:text-gray-300">
                      {String(value).length > 50 ? `${String(value).substring(0, 50)}...` : String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => updateState({ currentStep: 'template' })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="w-4 h-4 mr-2 inline" />
          Back
        </button>
        <button
          onClick={() => updateState({ currentStep: 'enrichment' })}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-2 inline" />
        </button>
      </div>
    </div>
  );

  const renderEnrichmentStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Zap className="w-16 h-16 text-purple-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          AI Enrichment Options
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Choose what AI enhancements to apply to your contacts
        </p>
      </div>

      <div className="space-y-4">
        {[
          {
            key: 'enrichCompanyData',
            title: 'Company Research',
            description: 'Enrich company information with industry, size, and recent news',
            icon: BarChart3
          },
          {
            key: 'discoverSocialProfiles',
            title: 'Social Profile Discovery',
            description: 'Find LinkedIn, Twitter, and other social profiles',
            icon: Users
          },
          {
            key: 'analyzeBuyingSignals',
            title: 'Buying Signal Analysis',
            description: 'Analyze engagement patterns and purchase intent',
            icon: TrendingUp
          },
          {
            key: 'generateLeadScoring',
            title: 'Lead Scoring',
            description: 'Generate AI-powered lead quality scores',
            icon: Target
          }
        ].map(({ key, title, description, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center space-x-3">
              <Icon className="w-5 h-5 text-purple-500" />
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={state.enrichmentOptions[key as keyof typeof state.enrichmentOptions] as boolean}
              onChange={(e) => updateState({
                enrichmentOptions: {
                  ...state.enrichmentOptions,
                  [key]: e.target.checked
                }
              })}
              className="w-4 h-4 text-purple-600 rounded"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => updateState({ currentStep: 'preview' })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="w-4 h-4 mr-2 inline" />
          Back
        </button>
        <button
          onClick={handleStartImport}
          disabled={state.isProcessing}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 inline animate-spin" />
              Starting Import...
            </>
          ) : (
            <>
              Start AI Import
              <ChevronRight className="w-4 h-4 ml-2 inline" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderDuplicatesStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Users className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Duplicate Detection
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          {state.duplicates.length} potential duplicates found. Review and resolve them.
        </p>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {state.duplicates.map((duplicate, index) => (
          <div key={index} className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 dark:text-orange-100">
                  {duplicate.imported.name}
                </h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  {duplicate.imported.email} • {duplicate.imported.company}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Confidence: {duplicate.confidence}%
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Reasons: {duplicate.matchReasons.join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200">
                  Merge
                </button>
                <button className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200">
                  Keep Both
                </button>
                <button className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200">
                  Skip
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => updateState({ currentStep: 'enrichment' })}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="w-4 h-4 mr-2 inline" />
          Back
        </button>
        <button
          onClick={() => handleDuplicateResolution(state.duplicates.map(() => ({ action: 'merge' })))}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          Resolve All & Import
          <ChevronRight className="w-4 h-4 ml-2 inline" />
        </button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Import Complete!
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Your contacts have been successfully imported and enriched.
        </p>
      </div>

      {state.importResults && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">Import Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{state.importResults.successCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{state.importResults.enrichedCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Enriched</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{state.importResults.duplicateCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Duplicates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{state.importResults.errorCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Errors</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Done
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <AIErrorBoundary serviceName="Contact Import">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Contact Import Wizard
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {renderStepIndicator()}

            {state.currentStep === 'method-selection' && renderMethodSelection()}
            {state.currentStep === 'upload' && renderUploadStep()}
            {state.currentStep === 'template' && renderTemplateStep()}
            {state.currentStep === 'preview' && renderPreviewStep()}
            {state.currentStep === 'enrichment' && renderEnrichmentStep()}
            {state.currentStep === 'duplicates' && renderDuplicatesStep()}
            {state.currentStep === 'single-form' && renderSingleContactForm()}
            {state.currentStep === 'complete' && renderCompleteStep()}

            {state.isProcessing && state.progress && (
              <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      {state.progress.message}
                    </p>
                    <div className="mt-2 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(state.progress.current / state.progress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AIErrorBoundary>
  );
};