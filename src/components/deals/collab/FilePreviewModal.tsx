import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { DealFile, fetchTextPreview, formatFileSize, getFileUrl, previewKind } from '../../../services/dealFilesService';
import { errorMessage } from '../../../services/dealRecordShared';

export interface FilePreviewModalProps {
  file: DealFile;
  onClose: () => void;
  onDownload: (file: DealFile) => void;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; url: string; text?: string; truncated?: boolean };

/** Preview: images inline, PDF in an object/iframe, text/CSV first lines, anything else offers download. */
export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose, onDownload }) => {
  const kind = previewKind(file);
  const [state, setState] = useState<State>(kind ? { status: 'loading' } : { status: 'ready', url: '' });

  useEffect(() => {
    if (!kind) { setState({ status: 'ready', url: '' }); return; }
    let alive = true;
    setState({ status: 'loading' });
    (async () => {
      try {
        if (kind === 'text') {
          const { text, truncated } = await fetchTextPreview(file);
          if (alive) setState({ status: 'ready', url: '', text, truncated });
        } else {
          const url = await getFileUrl(file);
          if (!url) throw new Error('File URL is unavailable');
          if (alive) setState({ status: 'ready', url });
        }
      } catch (e) {
        if (alive) setState({ status: 'error', message: errorMessage(e, 'Could not load preview') });
      }
    })();
    return () => { alive = false; };
  }, [file, kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`} className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}{file.mimeType ? ` - ${file.mimeType}` : ''}</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={`Download ${file.name}`} onClick={() => onDownload(file)} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"><Download className="h-4 w-4" /></button>
            <button type="button" aria-label="Close preview" onClick={onClose} className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-[8rem] flex-1 overflow-auto p-4">
          {!kind ? (
            <div className="py-10 text-center">
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">No preview is available for this file type.</p>
              <button type="button" onClick={() => onDownload(file)} className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"><Download className="mr-1.5 h-4 w-4" />Download</button>
            </div>
          ) : state.status === 'loading' ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading preview...</p>
          ) : state.status === 'error' ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
          ) : kind === 'image' ? (
            <img src={state.url} alt={file.name} className="mx-auto max-h-[70vh] w-auto rounded-lg" />
          ) : kind === 'pdf' ? (
            <object data={state.url} type="application/pdf" aria-label={file.name} className="h-[70vh] w-full rounded-lg">
              <iframe title={file.name} src={state.url} className="h-[70vh] w-full border-0" />
            </object>
          ) : (
            <>
              <pre data-testid="text-preview" className="overflow-x-auto whitespace-pre rounded-lg bg-gray-50 p-3 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">{state.text}</pre>
              {state.truncated && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Showing the first lines only. Download the file to see everything.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
