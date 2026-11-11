import React from 'react';
import { renderHook, act } from '@testing-library/react';

jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => {}),
  DEFAULT_STAGES: [],
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import { useDealStore } from '../store/dealStore';
import {
  useStageMeta, getStageMeta, isWonStage, isLostStage, isOpenStage, stageKeysWhere, stageColorClasses, stageHex, sortedStages,
  setActiveStages, stageIsWon, stageIsLost, stageIsOpen, openStageKeys, wonStageKeys
} from '../utils/stageUtils';
import type { PipelineStage } from '../types';

const st = (key: string, name: string, position: number, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name, color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra
});

// A pipeline that has nothing in common with the built-in keys
const CUSTOM: PipelineStage[] = [
  st('lead-in', 'Lead In', 0, { color: 'teal', probability: 5 }),
  st('demo', 'Demo', 1, { color: 'orange', probability: 30 }),
  st('signed', 'Signed', 2, { color: 'green', probability: 100, isWon: true }),
  st('dead', 'Dead', 3, { color: '#112233', isLost: true }),
];

describe('useStageMeta', () => {
  it('reads the live stage list from the deal store, including edits', () => {
    useDealStore.setState({ stages: CUSTOM });
    const { result } = renderHook(() => useStageMeta());
    expect(result.current.isWon('signed')).toBe(true);
    expect(result.current.isOpen('demo')).toBe(true);
    expect(result.current.isLost('dead')).toBe(true);
    expect(result.current.meta('demo').name).toBe('Demo');
    expect(result.current.colors('demo').border).toBe('border-orange-500');
    // marking another stage as won is reflected immediately
    act(() => { useDealStore.setState({ stages: CUSTOM.map(s => (s.key === 'demo' ? { ...s, isWon: true } : s)) }); });
    expect(result.current.isWon('demo')).toBe(true);
  });

  it('keeps the activity registry used by services in sync with the store', async () => {
    await act(async () => { await useDealStore.getState().updateStage('signed', { isWon: false, isLost: true }); });
    expect(stageIsLost('signed')).toBe(true);
    expect(stageIsWon('signed')).toBe(false);
  });
});

describe('stageUtils', () => {
  it('reads name / colour / flags for custom stage keys', () => {
    const m = getStageMeta(CUSTOM, 'signed');
    expect(m).toMatchObject({ key: 'signed', name: 'Signed', color: 'green', isWon: true, isLost: false, unknown: false, probability: 100 });
    expect(getStageMeta(CUSTOM, 'dead').isLost).toBe(true);
  });

  it('synthesises neutral metadata for unknown keys', () => {
    const m = getStageMeta(CUSTOM, 'old-stage');
    expect(m).toMatchObject({ name: 'Old Stage', color: 'gray', isWon: false, isLost: false, unknown: true });
  });

  it('classifies won / lost / open from the flags, not from names', () => {
    expect(isWonStage(CUSTOM, 'signed')).toBe(true);
    expect(isWonStage(CUSTOM, 'closed-won')).toBe(false); // not a stage of this pipeline
    expect(isLostStage(CUSTOM, 'dead')).toBe(true);
    expect(isOpenStage(CUSTOM, 'demo')).toBe(true);
    expect(isOpenStage(CUSTOM, 'signed')).toBe(false);
  });

  it('lists stage keys by kind in position order', () => {
    const shuffled = [CUSTOM[3], CUSTOM[1], CUSTOM[2], CUSTOM[0]];
    expect(stageKeysWhere(shuffled, 'open')).toEqual(['lead-in', 'demo']);
    expect(stageKeysWhere(shuffled, 'won')).toEqual(['signed']);
    expect(stageKeysWhere(shuffled, 'lost')).toEqual(['dead']);
    expect(stageKeysWhere(shuffled, 'closed')).toEqual(['signed', 'dead']);
    expect(sortedStages(shuffled).map(s => s.key)).toEqual(['lead-in', 'demo', 'signed', 'dead']);
  });

  it('falls back to the built-in stages when none are given', () => {
    expect(isWonStage([], 'closed-won')).toBe(true);
    expect(isWonStage(undefined, 'closed-won')).toBe(true);
  });

  it('maps colour tokens to Tailwind classes and custom colours to inline styles', () => {
    const green = stageColorClasses('green');
    expect(green.border).toBe('border-green-500');
    expect(green.chip).toContain('bg-green-100');
    expect(green.style).toBeUndefined();
    expect(stageColorClasses('border-purple-500').dot).toBe('bg-purple-500'); // legacy token form
    const hex = stageColorClasses('#112233');
    expect(hex.chip).toBe('');
    expect(hex.style).toMatchObject({ color: '#112233', borderColor: '#112233' });
    expect(hex.styleAccent).toEqual({ borderLeftColor: '#112233' });
    expect(stageColorClasses('nonsense').border).toBe('border-gray-500');
    expect(stageHex('teal')).toBe('#14b8a6');
    expect(stageHex('#abc')).toBe('#abc');
  });

  it('exposes the live registry for services (setActiveStages)', () => {
    setActiveStages(CUSTOM);
    expect(stageIsWon('signed')).toBe(true);
    expect(stageIsWon('closed-won')).toBe(false);
    expect(stageIsLost('dead')).toBe(true);
    expect(stageIsOpen('demo')).toBe(true);
    expect(stageIsWon(undefined)).toBe(false);
    expect(openStageKeys()).toEqual(['lead-in', 'demo']);
    expect(wonStageKeys()).toEqual(['signed']);
    setActiveStages([]); // empty list restores the defaults
    expect(stageIsWon('closed-won')).toBe(true);
  });
});
