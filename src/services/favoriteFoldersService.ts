import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { isDemoMode } from '../config/demoMode';
import { getCurrentUserId, isUuid, localId } from './dealRecordShared';
import { assertRowsAffected } from '../utils/rlsError';

export interface FavoriteFolder {
  id: string;
  name: string;
  position: number;
  /** Deal ids in display order. */
  dealIds: string[];
}

export const LS_FOLDERS_KEY = 'crm_favorite_folders_v1';
export const MAX_FOLDER_NAME = 60;

const remoteOk = () => isSupabaseConfigured && !isDemoMode();

export function validateFolderName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) throw new Error('Folder name is required');
  if (n.length > MAX_FOLDER_NAME) throw new Error(`Folder name must be ${MAX_FOLDER_NAME} characters or fewer`);
  return n;
}

function readLocal(): FavoriteFolder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_FOLDERS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(f => f && typeof f.id === 'string' && typeof f.name === 'string')
      .map((f, i) => ({
        id: f.id, name: f.name, position: typeof f.position === 'number' ? f.position : i,
        dealIds: Array.isArray(f.dealIds) ? f.dealIds.filter((d: unknown) => typeof d === 'string') : []
      }));
  } catch {
    return [];
  }
}
function writeLocal(folders: FavoriteFolder[]) {
  try {
    localStorage.setItem(LS_FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    /* storage unavailable */
  }
}

/** Remote only when configured AND the folder id came from the database. */
const folderRemote = (folderId: string) => remoteOk() && isUuid(folderId);

export async function listFolders(): Promise<FavoriteFolder[]> {
  if (!remoteOk()) return readLocal().sort((a, b) => a.position - b.position);
  const userId = await getCurrentUserId();
  if (!userId) return readLocal().sort((a, b) => a.position - b.position);
  const { data: rows, error } = await supabase.from('favorite_folders').select('id,name,position').eq('user_id', userId).order('position', { ascending: true });
  if (error) throw error;
  const folders = (rows ?? []) as Array<{ id: string; name: string; position: number }>;
  if (folders.length === 0) return [];
  const { data: items, error: iErr } = await supabase
    .from('favorite_folder_items').select('folder_id,deal_id,position')
    .in('folder_id', folders.map(f => f.id)).order('position', { ascending: true });
  if (iErr) throw iErr;
  const byFolder = new Map<string, string[]>();
  ((items ?? []) as Array<{ folder_id: string; deal_id: string }>).forEach(it => {
    byFolder.set(it.folder_id, [...(byFolder.get(it.folder_id) ?? []), it.deal_id]);
  });
  return folders.map(f => ({ id: f.id, name: f.name, position: f.position, dealIds: byFolder.get(f.id) ?? [] }));
}

export async function createFolder(name: string, position: number): Promise<FavoriteFolder> {
  const clean = validateFolderName(name);
  const userId = remoteOk() ? await getCurrentUserId() : null;
  if (!remoteOk() || !userId) {
    const folder: FavoriteFolder = { id: localId('folder'), name: clean, position, dealIds: [] };
    writeLocal([...readLocal(), folder]);
    return folder;
  }
  const { data, error } = await supabase.from('favorite_folders').insert({ user_id: userId, name: clean, position }).select('id,name,position').single();
  if (error) throw error;
  const row = data as { id: string; name: string; position: number };
  return { id: row.id, name: row.name, position: row.position, dealIds: [] };
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const clean = validateFolderName(name);
  if (!folderRemote(id)) { writeLocal(readLocal().map(f => (f.id === id ? { ...f, name: clean } : f))); return; }
  const { data, error } = await supabase.from('favorite_folders').update({ name: clean }).eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export async function deleteFolder(id: string): Promise<void> {
  if (!folderRemote(id)) { writeLocal(readLocal().filter(f => f.id !== id)); return; }
  const { error: iErr } = await supabase.from('favorite_folder_items').delete().eq('folder_id', id);
  if (iErr) throw iErr;
  const { data, error } = await supabase.from('favorite_folders').delete().eq('id', id).select('id');
  if (error) throw error;
  assertRowsAffected(data);
}

export async function reorderFolders(idsInOrder: string[]): Promise<void> {
  if (!remoteOk() || idsInOrder.some(id => !isUuid(id))) {
    const byId = new Map(readLocal().map(f => [f.id, f]));
    writeLocal(idsInOrder.map((id, i) => byId.get(id) && ({ ...byId.get(id)!, position: i })).filter((f): f is FavoriteFolder => !!f));
    return;
  }
  await Promise.all(idsInOrder.map(async (id, position) => {
    const { error } = await supabase.from('favorite_folders').update({ position }).eq('id', id);
    if (error) throw error;
  }));
}

export async function addDealToFolder(folderId: string, dealId: string, position: number): Promise<void> {
  if (!folderRemote(folderId)) {
    writeLocal(readLocal().map(f => (f.id === folderId && !f.dealIds.includes(dealId) ? { ...f, dealIds: [...f.dealIds, dealId] } : f)));
    return;
  }
  if (!isUuid(dealId)) throw new Error('Only saved deals can be added to a synced folder');
  const { error } = await supabase.from('favorite_folder_items').upsert({ folder_id: folderId, deal_id: dealId, position }, { onConflict: 'folder_id,deal_id' });
  if (error) throw error;
}

export async function removeDealFromFolder(folderId: string, dealId: string): Promise<void> {
  if (!folderRemote(folderId)) {
    writeLocal(readLocal().map(f => (f.id === folderId ? { ...f, dealIds: f.dealIds.filter(d => d !== dealId) } : f)));
    return;
  }
  const { error } = await supabase.from('favorite_folder_items').delete().eq('folder_id', folderId).eq('deal_id', dealId);
  if (error) throw error;
}

export async function reorderFolderDeals(folderId: string, dealIdsInOrder: string[]): Promise<void> {
  if (!folderRemote(folderId)) {
    writeLocal(readLocal().map(f => (f.id === folderId ? { ...f, dealIds: dealIdsInOrder } : f)));
    return;
  }
  await Promise.all(dealIdsInOrder.map(async (dealId, position) => {
    const { error } = await supabase.from('favorite_folder_items').update({ position }).eq('folder_id', folderId).eq('deal_id', dealId);
    if (error) throw error;
  }));
}

export const FavoriteFoldersService = {
  listFolders, createFolder, renameFolder, deleteFolder, reorderFolders,
  addDealToFolder, removeDealFromFolder, reorderFolderDeals
};
