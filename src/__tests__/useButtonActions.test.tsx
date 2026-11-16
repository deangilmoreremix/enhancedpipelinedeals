import { act, renderHook } from '@testing-library/react';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../services/phoneService', () => ({ getPhoneService: () => ({ makeCall: jest.fn() }) }));
jest.mock('../services/aiEnrichmentService', () => ({ getAIEnrichmentService: () => ({ enrichContactFromWeb: jest.fn() }) }));

import { useButtonActions, shareDeal, type ButtonAction } from '../hooks/useButtonActions';
import { useDealRecordStore } from '../store/dealRecordStore';

const deal: any = { id: 'd1', title: 'Acme', company: 'Acme Inc', isFavorite: false };
const contact: any = { id: 'c1', name: 'Jane', email: 'jane@x.com', phone: '555' };
const toasts = () => useDealRecordStore.getState().toasts.map(t => t.message);

beforeEach(() => { useDealRecordStore.setState({ toasts: [] } as any); });

describe('useButtonActions: no stub actions', () => {
  it('routes meet / add-field / view-* / contact actions to the supplied handlers', async () => {
    const h = { onScheduleMeeting: jest.fn(), onManageFields: jest.fn(), onShowTab: jest.fn(), onOpenContactSelector: jest.fn(), onRemoveContact: jest.fn(), onEditDeal: jest.fn(), onOpenEmailComposer: jest.fn() };
    const { result } = renderHook(() => useButtonActions({ deal, contact, ...h }));
    const run = (a: ButtonAction) => act(async () => { await result.current.handleAction(a); });
    await run('meet'); expect(h.onScheduleMeeting).toHaveBeenCalled();
    await run('add-field'); expect(h.onManageFields).toHaveBeenCalled();
    await run('view-files'); expect(h.onShowTab).toHaveBeenLastCalledWith('files');
    await run('view-insights'); expect(h.onShowTab).toHaveBeenLastCalledWith('insights');
    await run('view-analytics'); expect(h.onShowTab).toHaveBeenLastCalledWith('analytics');
    await run('email-ai'); expect(h.onShowTab).toHaveBeenLastCalledWith('email');
    await run('add-contact'); await run('change-contact'); expect(h.onOpenContactSelector).toHaveBeenCalledTimes(2);
    await run('remove-contact'); expect(h.onRemoveContact).toHaveBeenCalled();
    await run('edit'); expect(h.onEditDeal).toHaveBeenCalled();
    await run('email'); expect(h.onOpenEmailComposer).toHaveBeenCalledWith(contact, deal);
    expect(toasts()).toEqual([]);
  });

  it('reports a toast instead of silently doing nothing when a handler is missing', async () => {
    const { result } = renderHook(() => useButtonActions({ deal, contact }));
    let r: any;
    await act(async () => { r = await result.current.handleAction('meet'); });
    expect(r.success).toBe(false);
    expect(toasts().some(m => /not available/.test(m))).toBe(true);
  });

  it('email needs a contact with an address', async () => {
    const { result } = renderHook(() => useButtonActions({ deal, onOpenEmailComposer: jest.fn() }));
    await act(async () => { await result.current.handleAction('email'); });
    expect(toasts().some(m => /no contact with an email/.test(m))).toBe(true);
  });

  it('favorite toggles through onUpdateDeal', async () => {
    const onUpdateDeal = jest.fn(async () => deal);
    const { result } = renderHook(() => useButtonActions({ deal, onUpdateDeal }));
    await act(async () => { await result.current.handleAction('favorite'); });
    expect(onUpdateDeal).toHaveBeenCalledWith('d1', { isFavorite: true });
  });
});

describe('shareDeal', () => {
  const orig = { share: (navigator as any).share, clipboard: (navigator as any).clipboard };
  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: orig.share, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: orig.clipboard, configurable: true });
  });

  it('copies to the clipboard and confirms with a toast (never alert)', async () => {
    const writeText = jest.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const r = await shareDeal(deal);
    expect(r.success).toBe(true);
    expect(writeText).toHaveBeenCalled();
    expect(toasts().some(m => /copied/i.test(m))).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('reports a failure when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn(async () => { throw new Error('denied'); }) }, configurable: true });
    const r = await shareDeal(deal);
    expect(r).toEqual({ success: false, error: 'Could not share the deal' });
  });
});
