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

export const isPreviewable = (f: Pick<DealFile, 'mimeType' | 'name'>): 'image' | 'pdf' | null => {
  const mime = f.mimeType ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(f.name)) return 'pdf';
  return null;
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

/** Signed URL (private-bucket safe) with a public-URL fallback. */
export async function getFileUrl(file: DealFile): Promise<string | null> {
  if (file.localUrl) return file.localUrl;
  if (!canUseRemote(file.dealId)) return null;
  try {
    const { data } = await supabase.storage.from(DEAL_FILES_BUCKET).createSignedUrl(file.path, 3600);
    if (data?.signedUrl) return data.signedUrl;
  } catch {
    /* fall through to public URL */
  }
  return supabase.storage.from(DEAL_FILES_BUCKET).getPublicUrl(file.path).data?.publicUrl ?? null;
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

export const DealFilesService = { listFiles, uploadFile, getFileUrl, deleteFile };
