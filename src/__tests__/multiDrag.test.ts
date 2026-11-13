import { dragGroup, dropSelectionOnStage } from '../utils/multiDrag';
import { planStageMove, wipBlock, adjacentVisibleStage } from '../utils/stageMove';
import type { Deal, PipelineStage } from '../types';

const stage = (key: string, position: number, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra
});
const deal = (id: string, stageKey: string): Deal => ({
  id, company: 'Co', contact: 'X', value: 1, stage: stageKey, probability: 0, priority: 'medium',
  createdAt: new Date(), updatedAt: new Date(), position: 1
});

const STAGES = [stage('a', 0), stage('b', 1, { wipLimit: 3 }), stage('c', 2), stage('hidden', 3, { visible: false })];
const DEALS: Record<string, Deal> = Object.fromEntries([
  deal('1', 'a'), deal('2', 'a'), deal('3', 'a'), deal('4', 'b'), deal('5', 'b'), deal('6', 'c'),
].map(d => [d.id, d]));

describe('multi-card drag', () => {
  it('carries the whole selection only when the dragged card is part of a multi-selection', () => {
    expect(dragGroup('1', ['1', '2', '3'], DEALS)).toEqual(['1', '2', '3']);
    expect(dragGroup('2', ['1', '2', '3'], DEALS)).toEqual(['2', '1', '3']); // dragged card first
    expect(dragGroup('4', ['1', '2', '3'], DEALS)).toEqual(['4']); // not selected: unchanged
    expect(dragGroup('1', ['1'], DEALS)).toEqual(['1']); // single selection: plain drag
    expect(dragGroup('1', ['1', 'ghost'], DEALS)).toEqual(['1']); // ids of deleted deals are dropped
  });

  it('moves the selection through bulkMoveDeals', async () => {
    const bulkMoveDeals = jest.fn(async (ids: string[]) => ids);
    const notify = jest.fn();
    const r = await dropSelectionOnStage(['1', '2'], 'c', { stages: STAGES, deals: DEALS, bulkMoveDeals, notify });
    expect(r).toBe('moved');
    expect(bulkMoveDeals).toHaveBeenCalledWith(['1', '2'], 'c');
    expect(notify).toHaveBeenCalledWith('Moved 2 deals to C', 'success');
  });

  it('blocks a drop that would exceed the WIP limit unless Shift overrides', async () => {
    const bulkMoveDeals = jest.fn(async (ids: string[]) => ids);
    const notify = jest.fn();
    // stage b holds 2 cards with a limit of 3: moving 2 more would reach 4
    const blocked = await dropSelectionOnStage(['1', '2'], 'b', { stages: STAGES, deals: DEALS, bulkMoveDeals, notify });
    expect(blocked).toBe('blocked');
    expect(bulkMoveDeals).not.toHaveBeenCalled();
    expect(notify.mock.calls[0][0]).toMatch(/WIP limit \(3\).*would reach 4.*Shift/);

    const forced = await dropSelectionOnStage(['1', '2'], 'b', { stages: STAGES, deals: DEALS, bulkMoveDeals, notify, override: true });
    expect(forced).toBe('moved');
    expect(bulkMoveDeals).toHaveBeenCalledWith(['1', '2'], 'b');
  });

  it('allows a drop that stays within the limit and ignores cards already in the stage', async () => {
    const bulkMoveDeals = jest.fn(async (ids: string[]) => ids);
    expect(await dropSelectionOnStage(['1'], 'b', { stages: STAGES, deals: DEALS, bulkMoveDeals })).toBe('moved');
    expect(bulkMoveDeals).toHaveBeenCalledWith(['1'], 'b');
    bulkMoveDeals.mockClear();
    expect(await dropSelectionOnStage(['4', '5'], 'b', { stages: STAGES, deals: DEALS, bulkMoveDeals })).toBe('noop');
    expect(bulkMoveDeals).not.toHaveBeenCalled();
  });

  it('reports partial failures', async () => {
    const notify = jest.fn();
    await dropSelectionOnStage(['1', '2'], 'c', { stages: STAGES, deals: DEALS, bulkMoveDeals: async () => ['1'], notify });
    expect(notify).toHaveBeenCalledWith('Moved 1 of 2 deals to C', 'warning');
  });

  it('wipBlock only counts cards that actually arrive', () => {
    expect(wipBlock(STAGES, DEALS, 'b', ['4', '1'])).toBeNull(); // 5 stays, 1 arrives => 3 of 3
    expect(wipBlock(STAGES, DEALS, 'b', ['1', '2'])).toMatchObject({ stageKey: 'b', limit: 3, wouldReach: 4 });
    expect(wipBlock(STAGES, DEALS, 'a', ['6'])).toBeNull(); // no limit
  });
});

describe('Alt+Arrow stage move planning', () => {
  it('finds previous/next visible stages (skipping hidden ones)', () => {
    expect(adjacentVisibleStage(STAGES, 'a', 1)?.key).toBe('b');
    expect(adjacentVisibleStage(STAGES, 'c', 1)).toBeNull(); // hidden stage is not a target
    expect(adjacentVisibleStage(STAGES, 'a', -1)).toBeNull();
    expect(adjacentVisibleStage(STAGES, 'hidden', 1)).toBeNull();
  });

  it('groups deals by their own next stage and reports WIP blocks', () => {
    const plan = planStageMove(['1', '4', '6'], 1, STAGES, DEALS);
    expect(plan.moves).toEqual([{ toKey: 'b', toName: 'B', ids: ['1'] }, { toKey: 'c', toName: 'C', ids: ['4'] }]);
    expect(plan.skipped).toEqual(['6']);
    const blocked = planStageMove(['1', '2'], 1, STAGES, DEALS);
    expect(blocked.moves).toEqual([]);
    expect(blocked.blocked[0]).toMatchObject({ stageKey: 'b', limit: 3 });
    expect(planStageMove(['1', '2'], 1, STAGES, DEALS, true).moves).toEqual([{ toKey: 'b', toName: 'B', ids: ['1', '2'] }]);
  });
});
