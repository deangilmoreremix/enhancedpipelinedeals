import { describe, it, expect } from '@jest/globals';
import { computeDropPosition, getDestinationIndex, needsRebalance, rebalance } from '../utils/boardPositions';

describe('computeDropPosition', () => {
  it('returns 1 for an empty column', () => {
    expect(computeDropPosition([], 0)).toBe(1);
    expect(computeDropPosition([], 3)).toBe(1);
  });
  it('inserts before the first card', () => {
    expect(computeDropPosition([5, 6], 0)).toBe(4);
  });
  it('inserts after the last card', () => {
    expect(computeDropPosition([5, 6], 2)).toBe(7);
    expect(computeDropPosition([5, 6], 9)).toBe(7);
  });
  it('inserts between neighbours', () => {
    expect(computeDropPosition([1, 2, 4], 1)).toBe(1.5);
    expect(computeDropPosition([1, 2, 4], 2)).toBe(3);
  });
});

describe('getDestinationIndex', () => {
  const full = ['a', 'b', 'c', 'd'];
  it('appends when nothing is visible', () => {
    expect(getDestinationIndex([], full, 0)).toBe(4);
  });
  it('maps filtered indexes onto the full list', () => {
    const visible = ['b', 'd'];
    expect(getDestinationIndex(visible, full, 0)).toBe(1);
    expect(getDestinationIndex(visible, full, 1)).toBe(3);
    expect(getDestinationIndex(visible, full, 2)).toBe(4);
  });
  it('is the identity when nothing is filtered', () => {
    expect(getDestinationIndex(full, full, 2)).toBe(2);
  });
});

describe('needsRebalance / rebalance', () => {
  it('detects collapsed gaps', () => {
    expect(needsRebalance([1, 2, 3])).toBe(false);
    expect(needsRebalance([1, 1 + 1e-9, 3])).toBe(true);
    expect(needsRebalance([3, 1, 1])).toBe(true);
    expect(needsRebalance([])).toBe(false);
  });
  it('assigns evenly spaced positions in order', () => {
    expect(rebalance(['x', 'y', 'z'])).toEqual([
      { id: 'x', position: 1 },
      { id: 'y', position: 2 },
      { id: 'z', position: 3 },
    ]);
  });
});
