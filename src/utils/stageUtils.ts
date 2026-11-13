import { useDealStore } from '../store/dealStore';
import { DEFAULT_STAGES } from './defaultStages';
import { getStageMeta, isLostStage, isOpenStage, isWonStage, stageColorClasses } from './stageMeta';

// Pure helpers live in stageMeta.ts (no store import, safe for services); re-exported here as the public API.
export * from './stageMeta';

/** React hook: the live stage list (useDealStore.stages, DEFAULT fallback) with memo-friendly lookups. */
export function useStageMeta() {
  const stages = useDealStore(s => s.stages);
  const list = stages && stages.length > 0 ? stages : DEFAULT_STAGES;
  return {
    stages: list,
    meta: (key: string) => getStageMeta(list, key),
    isWon: (key: string) => isWonStage(list, key),
    isLost: (key: string) => isLostStage(list, key),
    isOpen: (key: string) => isOpenStage(list, key),
    colors: (key: string) => stageColorClasses(getStageMeta(list, key).color)
  };
}
