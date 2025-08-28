import React, { useState, useRef } from 'react';
import { importService, ImportResult, ImportProgress } from '../../services/importService';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';
import { ModernButton } from '../ui/ModernButton';
import { 
  X, 
  Upload, 
  Download, 
  FileText, 
  Database,
  AlertCircle,
  CheckCircle,
  Info,
  Loader2,
  Eye,
  AlertTriangle
} from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataType: 'deals' | 'contacts';
  onImportComplete: (data: Deal[] | Contact[]) => void;
}

const DEAL_TEMPLATE_HEADERS = [
  'title', 'company', 'contact', 'value', 'stage', 'probability', 
  'priority', 'dueDate', 'notes', 'tags'
];

const CONTACT_TEMPLATE_HEADERS = [
  'firstName', 'lastName', 'email', 'phone', 'title', 'company',
  'industry', 'status', 'interestLevel', 'sources', 'notes', 'tags'
];

const SAMPLE_DEAL_DATA = [
  ['Enterprise Software License', 'Tech Corp', 'Sarah Johnson', '75000', 'qualification', '30', 'high', '2024-02-15', 'Initial discovery call', 'Enterprise,High Value'],
  ['Marketing Platform', 'Startup Inc', 'Emily Rodriguez', '25000', 'proposal', '65', 'medium', '2024-02-20', 'Proposal sent', 'Startup,Referral']
];

const SAMPLE_CONTACT_DATA = [
  ['Sarah', 'Johnson', 'sarah@techcorp.com', '+1-555-0123', 'CTO', 'Tech Corp', 'Technology', 'prospect', 'hot', 'LinkedIn', 'Very interested in our solution', 'Enterprise,Technical'],
  ['Emily', 'Rodriguez', 'emily@startup.com', '+1-555-0124', 'CEO', 'Startup Inc', 'Software', 'lead', 'medium', 'Referral', 'Needs budget approval', 'Startup,Founder']
];

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  dataType,
  onImportComplete
}) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'upload' | 'preview'>('guide');
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<ImportResult<any> | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const templateHeaders = dataType === 'deals' ? DEAL_TEMPLATE_HEADERS : CONTACT_TEMPLATE_HEADERS;
  const sampleData = dataType === 'deals' ? SAMPLE_DEAL_DATA : SAMPLE_CONTACT_DATA;

  const downloadTemplate = () => {
    const csvContent = [
      templateHeaders.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataType}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    
    // Determine format from file extension
    const fileFormat = selectedFile.name.endsWith('.json') ? 'json' : 'csv';
    setFormat(fileFormat);

    try {
      // Read and preview file
      const content = await readFileContent(selectedFile);
      
      if (fileFormat === 'json') {
        const parsed = JSON.parse(content);
        const dataArray = Array.isArray(parsed) ? parsed : 
                         parsed[dataType] ? parsed[dataType] : 
                         parsed.data ? parsed.data : [];
        setPreviewData(dataArray.slice(0, 5)); // Show first 5 items
      } else {
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0]?.split(',') || [];
        const rows = lines.slice(1, 6).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header.trim()] = values[index]?.trim() || '';
          });
          return obj;
        });
        setPreviewData(rows);
      }
      
      setActiveTab('preview');
    } catch (error) {
      setError(`Failed to parse ${fileFormat.toUpperCase()} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setImportResult(null);

      const content = await readFileContent(file);
      
      const result = dataType === 'deals'
        ? await importService.importDeals(content, format, setProgress)
        : await importService.importContacts(content, format, setProgress);

      setImportResult(result);
      
      if (result.successCount > 0) {
        onImportComplete(result.success);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setActiveTab('guide');
    setFile(null);
    setFormat('csv');
    setIsProcessing(false);
    setProgress(null);
    setImportResult(null);
    setPreviewData([]);
    setError(null);
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetModal();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl text-white">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Import {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Upload CSV or JSON file to import multiple {dataType}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'guide', label: 'Format Guide', icon: Info },
            { id: 'upload', label: 'Upload File', icon: Upload },
            { id: 'preview', label: 'Preview & Import', icon: Eye }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => !isProcessing && setActiveTab(tab.id)}
                disabled={isProcessing}
                className={`flex-1 flex items-center justify-center space-x-2 py-4 px-6 font-medium transition-colors disabled:opacity-50 ${
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b-2 border-blue-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 max-h-[60vh]">
          {activeTab === 'guide' && (
            <div className="space-y-6">
              {/* Format Guide */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Import Guide
                    </h3>
                    <p className="text-blue-800 dark:text-blue-400">
                      Follow this guide to ensure your file imports correctly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Required Fields */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                  Required Fields
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(dataType === 'deals' 
                    ? [
                        { field: 'title', description: 'Deal title (e.g., "Enterprise Software License")' },
                        { field: 'company', description: 'Company name' },
                        { field: 'value', description: 'Deal value in dollars (number)' }
                      ]
                    : [
                        { field: 'email', description: 'Valid email address' },
                        { field: 'firstName', description: 'First name' },
                        { field: 'lastName', description: 'Last name' },
                        { field: 'company', description: 'Company name' }
                      ]
                  ).map((item, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{item.field}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Format */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-500" />
                  Sample CSV Format
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre">
{`${templateHeaders.join(',')}\n${sampleData.map(row => row.join(',')).join('\n')}`}
                  </pre>
                </div>
              </div>

              {/* Download Template */}
              <div className="flex justify-center">
                <ModernButton
                  variant="primary"
                  onClick={downloadTemplate}
                  className="flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Template</span>
                </ModernButton>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                {file ? (
                  <div className="space-y-2">
                    <p className="text-green-600 dark:text-green-400 font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB • {format.toUpperCase()}
                    </p>
                    <ModernButton
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose Different File
                    </ModernButton>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Upload {dataType.charAt(0).toUpperCase() + dataType.slice(1)} File
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Drop your CSV or JSON file here, or click to browse
                    </p>
                    <ModernButton
                      variant="primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose File
                    </ModernButton>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">Import Error</h4>
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-6">
              {importResult ? (
                <div className="text-center space-y-4">
                  <div className="p-8 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-green-900 dark:text-green-300 mb-2">
                      Import Successful!
                    </h3>
                    <p className="text-green-700 dark:text-green-400">
                      Successfully imported {importResult.successCount} {dataType}
                      {importResult.errorCount > 0 && ` (${importResult.errorCount} failed)`}
                    </p>
                  </div>
                  
                  {importResult.errors.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                        Import Warnings ({importResult.errors.length})
                      </h4>
                      <div className="max-h-32 overflow-y-auto text-sm text-yellow-800 dark:text-yellow-400">
                        {importResult.errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="mb-1">• {error.message}</div>
                        ))}
                        {importResult.errors.length > 5 && (
                          <div className="text-xs text-yellow-600 dark:text-yellow-500">
                            And {importResult.errors.length - 5} more errors...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <ModernButton variant="primary" onClick={handleClose}>
                    Close
                  </ModernButton>
                </div>
              ) : isProcessing ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Importing {dataType}...
                  </h3>
                  {progress && (
                    <div className="space-y-2 max-w-sm mx-auto">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {progress.message}
                      </p>
                      {progress.status === 'processing' && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : file && previewData.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Preview Data ({previewData.length} of {file ? 'many' : '0'})
                    </h3>
                    <ModernButton
                      variant="primary"
                      onClick={handleImport}
                      disabled={previewData.length === 0}
                      className="flex items-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import {dataType.charAt(0).toUpperCase() + dataType.slice(1)}</span>
                    </ModernButton>
                  </div>

                  {/* Preview Table */}
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                          <tr>
                            {Object.keys(previewData[0] || {}).map((key) => (
                              <th key={key} className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((item, index) => (
                            <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                              {Object.values(item).map((value: any, valueIndex) => (
                                <td key={valueIndex} className="py-3 px-4 text-gray-700 dark:text-gray-300">
                                  {String(value).substring(0, 50)}
                                  {String(value).length > 50 && '...'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                    No Data to Preview
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Upload a file to see preview data here
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;