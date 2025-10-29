import React, { useState } from 'react';
import { exportService, ExportOptions, ExportProgress } from '../../services/exportService';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';
import { ModernButton } from '../ui/ModernButton';
import { 
  X, 
  Download, 
  FileText, 
  Database, 
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Deal[] | Contact[];
  dataType: 'deals' | 'contacts';
  selectedItems?: string[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  data,
  dataType,
  selectedItems
}) => {
  const [format, setFormat] = useState<'json' | 'csv'>('csv');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [dateRange, setDateRange] = useState({
    enabled: false,
    start: '',
    end: ''
  });
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [exportComplete, setExportComplete] = useState(false);

  if (!isOpen) return null;

  // Filter data based on selection
  const dataToExport = selectedItems && selectedItems.length > 0
    ? data.filter(item => selectedItems.includes(item.id))
    : data;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportComplete(false);

      const options: ExportOptions = {
        format,
        includeMetadata,
        dateRange: dateRange.enabled && dateRange.start && dateRange.end ? {
          start: new Date(dateRange.start),
          end: new Date(dateRange.end)
        } : undefined
      };

      let content: string;
      if (dataType === 'deals') {
        content = await exportService.exportDeals(
          dataToExport as Deal[],
          options,
          setProgress
        );
      } else {
        content = await exportService.exportContacts(
          dataToExport as Contact[],
          options,
          setProgress
        );
      }

      // Download file
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `${dataType}_export_${timestamp}.${format}`;
      const mimeType = format === 'json' ? 'application/json' : 'text/csv';
      
      exportService.downloadFile(content, filename, mimeType);
      setExportComplete(true);

      // Auto-close after success
      setTimeout(() => {
        onClose();
        resetModal();
      }, 2000);

    } catch (error) {
      console.error('Export failed:', error);
      setProgress({
        current: 0,
        total: dataToExport.length,
        status: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const resetModal = () => {
    setFormat('csv');
    setIncludeMetadata(true);
    setDateRange({ enabled: false, start: '', end: '' });
    setIsExporting(false);
    setProgress(null);
    setExportComplete(false);
  };

  const handleClose = () => {
    if (!isExporting) {
      resetModal();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {dataToExport.length} items selected
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {exportComplete ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Export Complete!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your {dataType} have been exported successfully.
              </p>
            </div>
          ) : isExporting ? (
            <div className="text-center py-6">
              <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Exporting {dataType}...
              </h3>
              {progress && (
                <div className="space-y-2">
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
                  {progress.status === 'error' && (
                    <div className="flex items-center justify-center space-x-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">{progress.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat('csv')}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      format === 'csv'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <FileText className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-sm font-medium">CSV</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Spreadsheet format</div>
                  </button>
                  
                  <button
                    onClick={() => setFormat('json')}
                    className={`p-3 border rounded-lg text-center transition-colors ${
                      format === 'json'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Database className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-sm font-medium">JSON</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Structured data</div>
                  </button>
                </div>
              </div>

              {/* Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Export Options
                </label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={includeMetadata}
                      onChange={(e) => setIncludeMetadata(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Include metadata (export date, version, etc.)
                    </span>
                  </label>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    checked={dateRange.enabled}
                    onChange={(e) => setDateRange(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Filter by date range
                  </span>
                </label>
                
                {dateRange.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Export Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Export Summary</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>Items to export: {dataToExport.length}</div>
                  <div>Format: {format.toUpperCase()}</div>
                  <div>Include metadata: {includeMetadata ? 'Yes' : 'No'}</div>
                  {dateRange.enabled && (
                    <div>Date range: {dateRange.start || 'Not set'} to {dateRange.end || 'Not set'}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!exportComplete && !isExporting && (
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <ModernButton
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={handleExport}
              disabled={dataToExport.length === 0}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export {dataType}</span>
            </ModernButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportModal;