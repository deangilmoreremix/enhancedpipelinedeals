import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Download, Eye, File as FileIcon, FileImage, FileText, Paperclip, Trash2, UploadCloud, X } from 'lucide-react';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import {
  DealFile, MAX_DEAL_FILE_BYTES, deleteFile, formatFileSize, getFileUrl, isFilesLocalOnly, isPreviewable, listFiles, uploadFile,
} from '../../services/dealFilesService';
import { errorMessage } from '../../services/dealRecordShared';
import { pushToast } from '../../store/dealRecordStore';

export const DealFiles: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [files, setFiles] = useState<DealFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [preview, setPreview] = useState<{ file: DealFile; url: string } | null>(null);
  const localOnly = isFilesLocalOnly(dealId);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try { setFiles(await listFiles(dealId)); } catch (e) { setLoadError(errorMessage(e, 'Failed to load files')); } finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { setPreview(null); void load(); }, [load]);

  const onDrop = useCallback(async (accepted: File[], rejected: FileRejection[]) => {
    rejected.forEach(r => pushToast('error', `${r.file.name}: ${r.errors.map(e => e.code === 'file-too-large' ? 'larger than 25MB' : e.message).join(', ')}`));
    for (const file of accepted) {
      setUploading(n => n + 1);
      try {
        const rec = await uploadFile(dealId, file);
        setFiles(prev => [rec, ...prev]);
      } catch (e) {
        pushToast('error', `Upload failed for ${file.name}: ${errorMessage(e)}`);
      } finally {
        setUploading(n => n - 1);
      }
    }
  }, [dealId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxSize: MAX_DEAL_FILE_BYTES });

  const open = async (f: DealFile) => {
    const url = await getFileUrl(f);
    if (!url) { pushToast('error', 'File URL is unavailable'); return; }
    setPreview({ file: f, url });
  };

  const download = async (f: DealFile) => {
    const url = await getFileUrl(f);
    if (!url) { pushToast('error', 'File URL is unavailable'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const remove = async (f: DealFile) => {
    if (!window.confirm(`Delete ${f.name}?`)) return;
    const before = files;
    setFiles(prev => prev.filter(x => x.id !== f.id));
    if (preview?.file.id === f.id) setPreview(null);
    try { await deleteFile(f); } catch (e) {
      setFiles(before);
      pushToast('error', `Could not delete file: ${errorMessage(e)}`);
    }
  };

  const iconFor = (f: DealFile) => {
    const kind = isPreviewable(f);
    return kind === 'image' ? <FileImage className="h-5 w-5 text-purple-500" /> : kind === 'pdf' ? <FileText className="h-5 w-5 text-red-500" /> : <FileIcon className="h-5 w-5 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      <h4 className="flex items-center text-lg font-semibold text-gray-900 dark:text-white">
        <Paperclip className="mr-2 h-5 w-5 text-gray-500" />Files
      </h4>
      {localOnly && <Alert variant="info"><span className="text-sm">Files are kept in this browser session only (Supabase is not connected or demo mode is on).</span></Alert>}
      {loadError && <Alert variant="error"><span className="text-sm">{loadError}</span></Alert>}

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 bg-white hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800'
        }`}
      >
        <input {...getInputProps()} aria-label="Upload files" />
        <UploadCloud className="mx-auto mb-2 h-8 w-8 text-gray-400" />
        <p className="text-sm text-gray-700 dark:text-gray-300">{isDragActive ? 'Drop files to upload' : 'Drag files here, or click to browse'}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Up to 25MB per file{uploading > 0 ? ` - uploading ${uploading}...` : ''}</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading files...</p>
      ) : files.length === 0 ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">No files attached</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {files.map(f => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              {iconFor(f)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{f.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(f.size)} - {new Date(f.createdAt).toLocaleString()}</p>
              </div>
              {isPreviewable(f) && (
                <button type="button" aria-label={`Preview ${f.name}`} onClick={() => void open(f)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Eye className="h-4 w-4" /></button>
              )}
              <button type="button" aria-label={`Download ${f.name}`} onClick={() => void download(f)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Download className="h-4 w-4" /></button>
              <button type="button" aria-label={`Delete ${f.name}`} onClick={() => void remove(f)} className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{preview.file.name}</span>
            <Button size="sm" variant="ghost" aria-label="Close preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
          </div>
          {isPreviewable(preview.file) === 'image' ? (
            <img src={preview.url} alt={preview.file.name} className="max-h-[28rem] w-auto rounded-lg" />
          ) : (
            <iframe title={preview.file.name} src={preview.url} className="h-[32rem] w-full rounded-lg border-0" />
          )}
        </div>
      )}
    </div>
  );
};

export default DealFiles;
