import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockCallAI = jest.fn<(...a: any[]) => Promise<any>>();
class MockGatewayError extends Error { constructor(m: string, public status?: number) { super(m); } }
jest.mock('../services/aiClient', () => ({ callAI: (...a: any[]) => mockCallAI(...a), AIGatewayError: MockGatewayError }));
jest.mock('../services/dealRecordShared', () => ({ canUseRemote: (id: string) => id.startsWith('real') }));

import {
  normalizeSuggestions, suggestionToUpdates, askDealAssistant, applySuggestion, aiErrorMessage, analyzeDeal,
  readCachedInsights, refreshInsights, currentFieldValue,
} from '../services/dealAssistantService';

const edit = (over: any = {}) => ({ id: 's1', kind: 'field_edit', title: 'T', rationale: 'R', field: 'value', value: '$12,500', ...over });

describe('dealAssistantService', () => {
  beforeEach(() => { mockCallAI.mockReset(); const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } }; });

  it('parses and validates field edits', () => {
    expect(suggestionToUpdates(edit() as any)).toEqual({ value: 12500 });
    expect(suggestionToUpdates(edit({ field: 'probability', value: '85%' }) as any)).toEqual({ probability: 85 });
    expect(suggestionToUpdates(edit({ field: 'probability', value: '185' }) as any)).toBeNull();
    expect(suggestionToUpdates(edit({ field: 'priority', value: 'High' }) as any)).toEqual({ priority: 'high' });
    expect(suggestionToUpdates(edit({ field: 'priority', value: 'urgent' }) as any)).toBeNull();
    const d = suggestionToUpdates(edit({ field: 'dueDate', value: '2026-07-01' }) as any) as any;
    expect(d.dueDate).toBeInstanceOf(Date);
    expect(suggestionToUpdates(edit({ field: 'dueDate', value: 'next week' }) as any)).toBeNull();
    expect(suggestionToUpdates(edit({ field: 'tags', value: 'a, b ,' }) as any)).toEqual({ tags: ['a', 'b'] });
    expect(suggestionToUpdates({ ...edit(), kind: 'next_step' } as any)).toBeNull();
  });

  it('drops malformed cards, unknown fields (e.g. stage) and invalid values; keeps next steps', () => {
    const out = normalizeSuggestions([
      edit(),
      edit({ id: 'x', field: 'stage', value: 'won' }),
      edit({ id: 'y', field: 'value', value: 'lots' }),
      { id: 'n', kind: 'next_step', title: 'Call them', rationale: 'because', field: null, value: null },
      { kind: 'next_step' },
      'junk',
    ]);
    expect(out.map(s => s.id)).toEqual(['s1', 'n']);
    expect(normalizeSuggestions(null)).toEqual([]);
  });

  it('sends a transcript as `input` with the dealId for saved deals only', async () => {
    mockCallAI.mockResolvedValue({ data: { reply: 'Hi', suggestions: [edit()] }, text: '' });
    const r = await askDealAssistant({ dealId: 'real-1', deal: { id: 'real-1', title: 'A', value: 5 } as any, history: [{ role: 'user', content: 'q1' }, { role: 'assistant', content: 'a1' }], message: 'q2' });
    expect(r.reply).toBe('Hi');
    expect(r.suggestions).toHaveLength(1);
    const [task, opts] = mockCallAI.mock.calls[0];
    expect(task).toBe('deal_assistant');
    expect(opts.dealId).toBe('real-1');
    expect(opts.input).toContain('User: q1');
    expect(opts.input).toContain('Latest user message: q2');
    expect(opts.input).toMatch(/JSON/);
    await askDealAssistant({ dealId: 'demo-1', history: [], message: 'x' });
    expect(mockCallAI.mock.calls[1][1].dealId).toBeUndefined();
  });

  it('falls back to the text when the model returns no reply', async () => {
    mockCallAI.mockResolvedValue({ data: null, text: 'plain' });
    expect((await askDealAssistant({ dealId: 'd', history: [], message: 'x' })).reply).toBe('plain');
  });

  it('applySuggestion writes only through the supplied updateDeal', async () => {
    const update = jest.fn<(id: string, u: any) => Promise<unknown>>().mockResolvedValue({});
    await applySuggestion('d1', normalizeSuggestions([edit()])[0], update);
    expect(update).toHaveBeenCalledWith('d1', { value: 12500 });
    await expect(applySuggestion('d1', { id: 'n', kind: 'next_step', title: 't', rationale: '', field: null, value: null }, update)).rejects.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('maps errors to clear messages', () => {
    expect(aiErrorMessage(new MockGatewayError('x', 429))).toMatch(/rate limited/i);
    expect(aiErrorMessage(new MockGatewayError('x', 401))).toMatch(/sign in/i);
    expect(aiErrorMessage(new MockGatewayError('x', 502))).toMatch(/502/);
    expect(aiErrorMessage(new TypeError('Failed to fetch'))).toMatch(/unreachable/i);
  });

  it('analyzeDeal uses deal_analyze; insights are cached per deal', async () => {
    mockCallAI.mockResolvedValue({ data: { insights: ['a'], probability: 40 }, text: '' });
    const { data } = await analyzeDeal('real-1', 'summary');
    expect(data.insights).toEqual(['a']);
    expect(mockCallAI.mock.calls[0][0]).toBe('deal_analyze');
    expect(readCachedInsights('real-1')).toBeNull();
    const c = await refreshInsights('real-1');
    expect(readCachedInsights('real-1')?.data.insights).toEqual(['a']);
    expect(readCachedInsights('real-1')?.at).toBe(c.at);
  });

  it('formats the current field value for the before/after display', () => {
    expect(currentFieldValue({ value: 5 } as any, 'value')).toBe('5');
    expect(currentFieldValue({} as any, 'notes')).toBe('(empty)');
    expect(currentFieldValue({ tags: ['a', 'b'] } as any, 'tags')).toBe('a, b');
  });
});
