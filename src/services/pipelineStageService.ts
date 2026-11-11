import { supabase, isSupabaseConfigured } from '../lib/core/supabaseClient';
import { DEFAULT_STAGE_KEYS, PipelineStage } from '../types';
import { DEFAULT_STAGES } from '../utils/defaultStages';
import { assertRowsAffected } from '../utils/rlsError';

export { DEFAULT_STAGES };

type StageRow = Record<string, any>;

export const stageFromRow = (r: StageRow): PipelineStage => ({
  id: r.id,
  pipelineId: r.pipeline_id ?? null,
  key: r.key,
  name: r.name,
  color: r.color ?? 'gray',
  position: Number(r.position ?? 0),
  visible: r.visible ?? true,
  probability: Number(r.probability ?? 0),
  isWon: !!r.is_won,
  isLost: !!r.is_lost,
  wipLimit: r.wip_limit ?? null,
});

export const stageToRow = (s: Partial<PipelineStage>): StageRow => {
  const m: Array<[keyof PipelineStage, string]> = [
    ['pipelineId', 'pipeline_id'], ['key', 'key'], ['name', 'name'], ['color', 'color'],
    ['position', 'position'], ['visible', 'visible'], ['probability', 'probability'],
    ['isWon', 'is_won'], ['isLost', 'is_lost'], ['wipLimit', 'wip_limit'],
  ];
  const row: StageRow = {};
  m.forEach(([k, c]) => { if (s[k] !== undefined) row[c] = s[k]; });
  return row;
};

const sortStages = (a: PipelineStage[]) => [...a].sort((x, y) => x.position - y.position);

/** Legacy fallback: pipeline columns stored as JSON in app_settings. */
async function readLegacyColumns(): Promise<PipelineStage[] | null> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'pipeline_columns')
      .maybeSingle();
    const stored = data?.setting_value as Array<{ id: string; name: string; position: number; config?: { color?: string; wipLimit?: number }; is_active?: boolean }> | undefined;
    if (!stored || !stored.length) return null;
    return sortStages(stored.map((c, i) => {
      const def = DEFAULT_STAGES.find(d => d.key === c.id);
      return {
        id: c.id,
        key: c.id,
        name: c.name,
        color: c.config?.color?.replace('border-', '') ?? def?.color ?? 'gray',
        position: c.position ?? i,
        visible: c.is_active !== false,
        probability: def?.probability ?? 0,
        isWon: def?.isWon ?? false,
        isLost: def?.isLost ?? false,
        wipLimit: c.config?.wipLimit ?? def?.wipLimit ?? null,
      };
    }));
  } catch {
    return null;
  }
}

export async function getStages(): Promise<PipelineStage[]> {
  if (!isSupabaseConfigured) return DEFAULT_STAGES;
  try {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .order('position', { ascending: true });
    if (!error && data && data.length > 0) return sortStages(data.map(stageFromRow));
  } catch (e) {
    console.warn('pipelineStageService.getStages failed, using fallback', e);
  }
  return (await readLegacyColumns()) ?? DEFAULT_STAGES;
}

export async function createStage(stage: Omit<PipelineStage, 'id'>): Promise<PipelineStage> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert(stageToRow(stage))
    .select()
    .single();
  if (error) throw error;
  return stageFromRow(data);
}

export async function updateStage(key: string, updates: Partial<Omit<PipelineStage, 'id' | 'key'>>): Promise<PipelineStage> {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .update({ ...stageToRow(updates), updated_at: new Date().toISOString() })
    .eq('key', key)
    .is('pipeline_id', null)
    .select()
    .single();
  if (error) throw error;
  return stageFromRow(data);
}

export async function reorderStages(keysInOrder: string[]): Promise<void> {
  const results = await Promise.all(keysInOrder.map((key, position) =>
    supabase.from('pipeline_stages').update({ position }).eq('key', key).is('pipeline_id', null).select('id')));
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
  // RLS filters UPDATEs silently: a stage that matched no row was not reordered
  results.forEach(r => assertRowsAffected(r.data as unknown[] | null));
}

/** Deletes a stage, moving its deals (appended after the target stage's last deal) to `moveToKey` first. */
export async function deleteStage(key: string, moveToKey: string): Promise<void> {
  if (key === moveToKey) throw new Error('Cannot move deals to the stage being deleted');

  const { data: moving, error: selErr } = await supabase
    .from('deals').select('id,position').eq('stage', key).order('position', { ascending: true });
  if (selErr) throw selErr;
  const { data: tail, error: tailErr } = await supabase
    .from('deals').select('position').eq('stage', moveToKey).order('position', { ascending: false }).limit(1);
  if (tailErr) throw tailErr;
  const base = Number((tail as Array<{ position?: number | null }> | null)?.[0]?.position ?? -1);

  const toMove = (moving ?? []) as Array<{ id: string }>;
  for (let i = 0; i < toMove.length; i++) {
    const mv = await supabase.from('deals')
      .update({ stage: moveToKey, position: base + 1 + i }).eq('id', toMove[i].id).select('id');
    if (mv.error) throw mv.error;
    assertRowsAffected(mv.data as unknown[] | null);
  }

  const { data, error } = await supabase.from('pipeline_stages').delete().eq('key', key).is('pipeline_id', null).select('id');
  if (error) throw error;
  assertRowsAffected(data as unknown[] | null);
}

/**
 * Create-or-update stages keyed by `key`. Existing rows only receive the fields that were actually provided
 * (undefined fields are never written, so probability / isWon / isLost are not zeroed by partial edits).
 * New rows get safe defaults for the omitted flags.
 */
export async function upsertStages(stages: Array<Partial<Omit<PipelineStage, 'id'>> & { key: string }>): Promise<void> {
  const now = new Date().toISOString();
  for (const stage of stages) {
    const patch = stageToRow(stage);
    const { data: existing, error: selErr } = await supabase
      .from('pipeline_stages').select('id').eq('key', stage.key).is('pipeline_id', null).maybeSingle();
    if (selErr) throw selErr;
    const res = existing
      ? await supabase.from('pipeline_stages').update({ ...patch, updated_at: now }).eq('id', existing.id)
      : await supabase.from('pipeline_stages').insert({
          probability: 0, is_won: false, is_lost: false, visible: true, name: stage.key, ...patch, pipeline_id: null, updated_at: now
        });
    if (res.error) throw res.error;
  }
}

/** Subscribe to stage changes; returns an unsubscribe function. */
export function subscribe(onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel('pipeline_stages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_stages' }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export const isDefaultStageKey = (key: string): boolean => (DEFAULT_STAGE_KEYS as readonly string[]).includes(key);

export const PipelineStageService = { getStages, createStage, updateStage, reorderStages, deleteStage, upsertStages, subscribe };
