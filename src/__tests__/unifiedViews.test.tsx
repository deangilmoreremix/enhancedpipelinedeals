import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';

const mockUpdateDeal = jest.fn();
jest.mock('../services/dataSyncService', () => ({
  getDataSyncService: () => ({ isDatabaseConnected: () => true, updateDeal: (...a: unknown[]) => mockUpdateDeal(...a) }),
}));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => {}),
  DEFAULT_STAGES: [],
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => false }));

import { DealTableView } from '../components/DealTableView';
import { DealListView } from '../components/DealListView';
import { DealTimelineView } from '../components/DealTimelineView';
import { DealCalendarView } from '../components/DealCalendarView';
import { computeViewDeals } from '../hooks/useBoardFilters';
import { useBoardViewStore } from '../store/boardViewStore';
import { useBoardSelectionStore } from '../store/boardSelectionStore';
import { useDealStore } from '../store/dealStore';
import { useDealRecordStore } from '../store/dealRecordStore';
import { useUserDirectoryStore } from '../store/userDirectoryStore';
import type { Deal, PipelineStage } from '../types';

const NOW = new Date();
const mk = (id: string, over: Partial<Deal> = {}): Deal => ({
  id, title: `Deal ${id}`, company: `Co ${id}`, contact: `Person ${id}`, value: 100, stage: 'lead', probability: 10, priority: 'medium',
  createdAt: NOW, updatedAt: NOW, position: 1, ...over,
});
const stage = (key: string, name: string, position: number, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name, color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra,
});
const STAGES = [stage('lead', 'Lead', 0), stage('mid', 'Mid', 1, { color: 'orange' }), stage('signed', 'Signed', 2, { isWon: true, color: 'green' })];

const DEALS: Deal[] = [
  mk('a', { value: 300, stage: 'lead', position: 2 }),
  mk('b', { value: 900, stage: 'signed', position: 1, isFavorite: true }),
  mk('c', { value: 100, stage: 'mid', position: 1, isFavorite: true }),
  mk('d', { value: 500, stage: 'lead', position: 1 }),
];

const ids = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-deal-id]')).map(e => e.dataset.dealId);

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateDeal.mockImplementation(async (_id: string, updates: Partial<Deal>) => ({ ...updates }));
  useBoardViewStore.getState().reset();
  useBoardSelectionStore.setState({ selectedIds: [], anchorId: null, focusedId: null });
  useDealRecordStore.setState({ toasts: [] });
  useUserDirectoryStore.setState({ users: [], loadedAt: Date.now() });
  useDealStore.setState({
    deals: Object.fromEntries(DEALS.map(d => [d.id, d])), stages: STAGES, isConnectedToDatabase: true,
  });
});

const onDealUpdate = (id: string, updates: Partial<Deal>) => useDealStore.getState().updateDeal(id, updates);

describe('one filtered + sorted list feeds every view', () => {
  const run = (filters: Parameters<typeof computeViewDeals>[1], sorting: Parameters<typeof computeViewDeals>[2]) =>
    computeViewDeals(DEALS, filters, sorting, STAGES);
  const none = { filters: [], groups: [], favoritesOnly: false };

  it('defaults to pipeline order (stage position, then manual position)', () => {
    expect(run(none, []).map(d => d.id)).toEqual(['d', 'a', 'c', 'b']);
  });

  it('applies the board sort rules (and sorts by stage position, not alphabetically)', () => {
    expect(run(none, [{ field: 'value', direction: 'desc', priority: 0 }]).map(d => d.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(run(none, [{ field: 'stage', direction: 'desc', priority: 0 }]).map(d => d.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('filters first, then sorts', () => {
    const r = run({ ...none, favoritesOnly: true }, [{ field: 'value', direction: 'asc', priority: 0 }]);
    expect(r.map(d => d.id)).toEqual(['c', 'b']);
  });

  it('table, list, timeline and calendar render the same rows in the same order', () => {
    const view = run(none, [{ field: 'value', direction: 'desc', priority: 0 }]);
    const expected = ['b', 'd', 'a', 'c'];
    expect(view.map(d => d.id)).toEqual(expected);

    const table = render(<DealTableView deals={view} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(ids(table.container)).toEqual(expected);
    table.unmount();

    const list = render(<DealListView deals={view} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(ids(list.container)).toEqual(expected);
    list.unmount();

    // all deals share one day, so the timeline keeps the shared order inside that day
    const timeline = render(<DealTimelineView deals={view} onDealClick={jest.fn()} />);
    expect(ids(timeline.container)).toEqual(expected);
    timeline.unmount();

    // calendar renders deals on their update day (today), first three per day then "+N more": same order
    const cal = render(<DealCalendarView deals={view} onDealClick={jest.fn()} />);
    expect(ids(cal.container)).toEqual(expected.slice(0, 3));
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('views no longer filter or sort on their own', () => {
    // passed in a "wrong" order: the view must not re-sort it
    const odd = [DEALS[2], DEALS[0], DEALS[3], DEALS[1]];
    const { container } = render(<DealTableView deals={odd} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(ids(container)).toEqual(['c', 'a', 'd', 'b']);
  });
});

describe('table view', () => {
  it('shows stage names/colours from the stage metadata (custom stage keys)', () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(screen.getAllByRole('button', { name: /^Stage: Signed/ }).length).toBe(1);
    expect(screen.getAllByRole('button', { name: /^Stage: Lead/ }).length).toBe(2);
  });

  it('header clicks write the sort to the board view store (asc/desc toggle)', () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(screen.getByRole('columnheader', { name: /^Value/ }));
    expect(useBoardViewStore.getState().sorting).toEqual([{ field: 'value', direction: 'desc', priority: 0 }]);
    fireEvent.click(screen.getByRole('columnheader', { name: /^Value/ }));
    expect(useBoardViewStore.getState().sorting[0]).toMatchObject({ field: 'value', direction: 'asc' });
    fireEvent.click(screen.getByRole('columnheader', { name: /^Deal Title/ }));
    expect(useBoardViewStore.getState().sorting).toEqual([{ field: 'title', direction: 'asc', priority: 0 }]);
  });

  it('column chooser hides columns and persists them in the store', () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Columns/ }));
    fireEvent.click(screen.getByLabelText('Show Priority'));
    fireEvent.click(screen.getByLabelText('Show Contact'));
    expect(useBoardViewStore.getState().tableColumns.find(c => c.key === 'priority')?.visible).toBe(true);
    expect(useBoardViewStore.getState().tableColumns.find(c => c.key === 'contact')?.visible).toBe(false);
    expect(screen.getAllByText('Priority').length).toBeGreaterThan(0);
  });

  it('footer aggregates (count / sum / avg) follow the selected operation and the selection', () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(screen.getByTestId('table-aggregate')).toHaveTextContent('Total: $1,800');
    fireEvent.change(screen.getByLabelText('Aggregate operation'), { target: { value: 'avg' } });
    expect(screen.getByTestId('table-aggregate')).toHaveTextContent('Total: $450');
    fireEvent.change(screen.getByLabelText('Aggregate operation'), { target: { value: 'count' } });
    expect(screen.getByTestId('table-aggregate')).toHaveTextContent('Total: 4');
    fireEvent.change(screen.getByLabelText('Aggregate operation'), { target: { value: 'sum' } });
    fireEvent.click(screen.getByLabelText('Select Deal b'));
    expect(screen.getByTestId('table-aggregate')).toHaveTextContent('Selected: $900');
    fireEvent.click(screen.getByLabelText('By stage'));
    expect(screen.getByRole('list', { name: 'Stage subtotals' })).toHaveTextContent('Lead2 · $800');
  });

  it('list and timeline show a compact count + sum footer', () => {
    const l = render(<DealListView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(screen.getByTestId('list-footer')).toHaveTextContent('4 deals');
    expect(screen.getByTestId('list-footer')).toHaveTextContent('Total: $1,800');
    l.unmount();
    render(<DealTimelineView deals={DEALS} onDealClick={jest.fn()} />);
    expect(screen.getByTestId('timeline-footer')).toHaveTextContent('4 deals');
    expect(screen.getByTestId('timeline-footer')).toHaveTextContent('Total: $1,800');
  });
});

describe('bulk selection in the table view', () => {
  it('shows the shared BulkActionBar once a row is selected, and clears with Esc', () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(screen.queryByRole('toolbar', { name: 'Bulk actions' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select Deal a'));
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['a']);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('toolbar', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('Ctrl/Cmd+A selects every visible deal and select-all toggles', () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
    expect(useBoardSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(screen.getByText('4 selected', { selector: 'span' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select all deals'));
    expect(useBoardSelectionStore.getState().selectedIds).toEqual([]);
  });

  it('shift-click selects a range in display order', () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(screen.getByLabelText('Select Deal a'));
    fireEvent.click(screen.getByLabelText('Select Deal c'), { shiftKey: true });
    expect(useBoardSelectionStore.getState().selectedIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('the list view uses the same selection store and bar', () => {
    render(<DealListView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(screen.getByLabelText('Select Deal c'));
    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['c']);
  });

  it('selection is dropped for rows that are filtered out', () => {
    const { rerender } = render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
    rerender(<DealTableView deals={[DEALS[0]]} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    expect(useBoardSelectionStore.getState().selectedIds).toEqual(['a']);
  });
});

describe('inline cell editing in table rows', () => {
  const row = (id: string) => document.querySelector(`tr[data-deal-id="${id}"]`) as HTMLElement;

  it('edits the value on click, saves on Enter and persists through the store', async () => {
    const onDealClick = jest.fn();
    render(<DealTableView deals={DEALS} onDealClick={onDealClick} onDealUpdate={onDealUpdate} />);
    // the cell renders the same text as before until clicked
    expect(within(row('a')).getByText('$300')).toBeInTheDocument();
    fireEvent.click(within(row('a')).getByRole('button', { name: 'Edit Value' }));
    expect(onDealClick).not.toHaveBeenCalled(); // row click must not fire from inside a cell
    const input = within(row('a')).getByLabelText('Value');
    fireEvent.change(input, { target: { value: '2,500' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    await waitFor(() => expect(useDealStore.getState().deals.a.value).toBe(2500));
    expect(mockUpdateDeal).toHaveBeenCalledWith('a', { value: 2500 });
    expect(useDealRecordStore.getState().toasts).toHaveLength(0);
  });

  it('Escape cancels without saving', async () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(within(row('a')).getByRole('button', { name: 'Edit Title' }));
    const input = within(row('a')).getByLabelText('Title');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockUpdateDeal).not.toHaveBeenCalled();
    expect(within(row('a')).getByText('Deal a')).toBeInTheDocument();
  });

  it('blur saves the title', async () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(within(row('a')).getByRole('button', { name: 'Edit Title' }));
    const input = within(row('a')).getByLabelText('Title');
    fireEvent.change(input, { target: { value: 'Renamed deal' } });
    await act(async () => { fireEvent.blur(input); });
    await waitFor(() => expect(useDealStore.getState().deals.a.title).toBe('Renamed deal'));
  });

  it('changes the stage from the chip dropdown', async () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(within(row('a')).getByRole('button', { name: /^Stage: Lead/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Mid' })); });
    await waitFor(() => expect(useDealStore.getState().deals.a.stage).toBe('mid'));
    expect(mockUpdateDeal).toHaveBeenCalledWith('a', { stage: 'mid' });
  });

  it('rolls back and raises an error toast when the save fails', async () => {
    mockUpdateDeal.mockRejectedValueOnce(new Error('boom'));
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(within(row('a')).getByRole('button', { name: 'Edit Value' }));
    const input = within(row('a')).getByLabelText('Value');
    fireEvent.change(input, { target: { value: '7000' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    await waitFor(() => expect(useDealRecordStore.getState().toasts.length).toBe(1));
    expect(useDealRecordStore.getState().toasts[0]).toMatchObject({ type: 'error' });
    expect(useDealStore.getState().deals.a.value).toBe(300); // rolled back
  });

  it('rejects an invalid value without calling the store', async () => {
    render(<DealTableView deals={DEALS} onDealClick={jest.fn()} onDealUpdate={onDealUpdate} />);
    fireEvent.click(within(row('a')).getByRole('button', { name: 'Edit Value' }));
    const input = within(row('a')).getByLabelText('Value');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid number');
    expect(mockUpdateDeal).not.toHaveBeenCalled();
  });
});
