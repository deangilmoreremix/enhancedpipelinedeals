import { supabase } from '../lib/core/supabaseClient';
import { assertRowsAffected } from '../utils/rlsError';
import { canUseRemote, getCurrentUserId, localId } from './dealRecordShared';

export const DEAL_FILES_BUCKET = 'deal-files';
export const MAX_DEAL_FILE_BYTES = 25 * 1024 * 1024; // 25MB

export interface DealFile {
  id: string;
  dealId: string;
  name: string;
  path: string;
  size: number;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string;
  /** Local-only files keep an object URL so they can still be previewed/downloaded. */
  localUrl?: string;
}

const localFiles = new Map<string, DealFile[]>();

export const isFilesLocalOnly = (dealId: string): boolean => !canUseRemote(dealId);

const fromRow = (r: Record<string, any>): DealFile => ({
  id: r.id,
  dealId: r.deal_id,
  name: r.name,
  path: r.path,
  size: Number(r.size ?? 0),
  mimeType: r.mime_type ?? null,
  uploadedBy: r.uploaded_by ?? null,
  createdAt: r.created_at ?? new Date().toISOString(),
});

export type PreviewKind = 'image' | 'pdf' | 'text';

const TEXT_EXT = /\.(txt|csv|tsv|md|markdown|json|log|xml|ya?ml|html?|css|js|ts)$/i;

/** How a file can be previewed in the modal; null means download only. */
export const previewKind = (f: Pick<DealFile, 'mimeType' | 'name'>): PreviewKind | null => {
  const mime = f.mimeType ?? '';
  if (mime.startsWith('image/') && mime !== 'image/svg+xml') return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'text/csv' || TEXT_EXT.test(f.name)) return 'text';
  if (/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(f.name)) return 'image';
  return null;
};

/** Back-compat: image/pdf only (what an <img>/<iframe> can show directly). */
export const isPreviewable = (f: Pick<DealFile, 'mimeType' | 'name'>): 'image' | 'pdf' | null => {
  const k = previewKind(f);
  return k === 'image' || k === 'pdf' ? k : null;
};

export function validateDealFile(file: Pick<File, 'size' | 'name'>): string | null {
  if (file.size > MAX_DEAL_FILE_BYTES) return `${file.name} is larger than 25MB`;
  return null;
}

export async function listFiles(dealId: string): Promise<DealFile[]> {
  if (!canUseRemote(dealId)) return [...(localFiles.get(dealId) ?? [])];
  const { data, error } = await supabase
    .from('deal_files')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function uploadFile(dealId: string, file: File): Promise<DealFile> {
  const problem = validateDealFile(file);
  if (problem) throw new Error(problem);
  const now = new Date().toISOString();

  if (!canUseRemote(dealId)) {
    const rec: DealFile = {
      id: localId('file'), dealId, name: file.name, path: `local/${file.name}`, size: file.size,
      mimeType: file.type || null, uploadedBy: null, createdAt: now, localUrl: URL.createObjectURL(file),
    };
    localFiles.set(dealId, [rec, ...(localFiles.get(dealId) ?? [])]);
    return rec;
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${dealId}/${Date.now()}-${safeName}`;
  const { error: upErr } = await supabase.storage
    .from(DEAL_FILES_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from('deal_files')
    .insert({
      deal_id: dealId, name: file.name, path, size: file.size,
      mime_type: file.type || null, uploaded_by: await getCurrentUserId(),
    })
    .select()
    .single();
  if (error) {
    // Don't leave an orphaned object behind.
    await supabase.storage.from(DEAL_FILES_BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }
  return fromRow(data);
}

/**
 * Signed URL (the deal-files bucket is private). Pass `download` to get a URL that forces a
 * download with that file name. Falls back to the public URL if signing fails.
 */
export async function getFileUrl(file: DealFile, opts: { download?: boolean } = {}): Promise<string | null> {
  if (file.localUrl) return file.localUrl;
  if (!canUseRemote(file.dealId)) return null;
  try {
    const { data } = await supabase.storage
      .from(DEAL_FILES_BUCKET)
      .createSignedUrl(file.path, 3600, opts.download ? { download: file.name } : undefined);
    if (data?.signedUrl) return data.signedUrl;
  } catch {
    /* fall through to public URL */
  }
  return supabase.storage.from(DEAL_FILES_BUCKET).getPublicUrl(file.path).data?.publicUrl ?? null;
}

export const TEXT_PREVIEW_LINES = 50;
const TEXT_PREVIEW_BYTES = 64 * 1024;

/** First lines of a text/CSV file (reads only the first 64KB where the server honours Range). */
export async function fetchTextPreview(file: DealFile, maxLines = TEXT_PREVIEW_LINES): Promise<{ text: string; truncated: boolean }> {
  const url = await getFileUrl(file);
  if (!url) throw new Error('File URL is unavailable');
  const res = await fetch(url, { headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` } });
  if (!res.ok) throw new Error(`Could not load preview (${res.status})`);
  const raw = await res.text();
  const lines = raw.split(/\r?\n/);
  const truncated = lines.length > maxLines || raw.length >= TEXT_PREVIEW_BYTES;
  return { text: lines.slice(0, maxLines).join('\n'), truncated };
}

export const MAX_FILE_NAME = 255;

/** Rename the display name only: the storage path stays the same. */
export async function renameFile(file: DealFile, newName: string): Promise<DealFile> {
  const name = newName.trim();
  if (!name) throw new Error('File name cannot be empty');
  if (name.length > MAX_FILE_NAME) throw new Error(`File name is too long (max ${MAX_FILE_NAME} characters)`);
  if (name === file.name) return file;
  if (!canUseRemote(file.dealId)) {
    const next = { ...file, name };
    localFiles.set(file.dealId, (localFiles.get(file.dealId) ?? []).map(f => (f.id === file.id ? next : f)));
    return next;
  }
  const { data, error } = await supabase.from('deal_files').update({ name }).eq('id', file.id).select();
  if (error) throw error;
  assertRowsAffected(data); // RLS filters silently (0 rows)
  return fromRow(data[0]);
}

export async function deleteFile(file: DealFile): Promise<void> {
  if (!canUseRemote(file.dealId)) {
    if (file.localUrl) URL.revokeObjectURL(file.localUrl);
    localFiles.set(file.dealId, (localFiles.get(file.dealId) ?? []).filter(f => f.id !== file.id));
    return;
  }
  const { error: rmErr } = await supabase.storage.from(DEAL_FILES_BUCKET).remove([file.path]);
  if (rmErr) throw rmErr;
  const { data, error } = await supabase.from('deal_files').delete().eq('id', file.id).select('id');
  if (error) throw error;
  if (Array.isArray(data)) assertRowsAffected(data); // RLS filters silently (0 rows)
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const DealFilesService = { listFiles, uploadFile, getFileUrl, renameFile, fetchTextPreview, deleteFile };
