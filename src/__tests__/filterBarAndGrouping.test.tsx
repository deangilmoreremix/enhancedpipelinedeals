import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false }));

import { FilterBar } from '../components/pipeline/FilterBar';
import { useBoardViewStore } from '../store/boardViewStore';
import { NONE_KEY, buildGroupColumns, isGroupingDroppable, updatesForGroupDrop } from '../utils/boardGrouping';
import type { Deal, PipelineStage } from '../types';

const stage = (key: string, name: string, position: number): PipelineStage => ({
  id: key, key, name, color: 'blue', position, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null
});
const STAGES = [stage('lead', 'Lead', 0), stage('won', 'Won', 1)];

describe('FilterBar', () => {
  beforeEach(() => useBoardViewStore.getState().reset());

  it('adds a stage filter chip through the Add filter popover, edits it and clears all', () => {
    render(<FilterBar stages={STAGES} matchCount={2} totalCount={5} />);
    expect(screen.getByTestId('filter-result-count')).toHaveTextContent('5 deals');

    fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
    const dialog = screen.getByRole('dialog', { name: 'Add filter' });
    fireEvent.change(within(dialog).getByLabelText('Condition'), { target: { value: 'in' } });
    fireEvent.click(within(dialog).getByLabelText('Won'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }));

    expect(useBoardViewStore.getState().filters).toEqual([{ field: 'stage', operator: 'in', value: ['won'] }]);
    expect(screen.getByRole('button', { name: /Edit filter: Stage is any of Won/ })).toBeInTheDocument();
    expect(screen.getByTestId('filter-count')).toHaveTextContent('1');
    expect(screen.getByTestId('filter-result-count')).toHaveTextContent('2 of 5 deals');

    fireEvent.click(screen.getByRole('button', { name: /Edit filter/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit filter' })).getByLabelText('Lead'));
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(useBoardViewStore.getState().filters[0].value).toEqual(['won', 'lead']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(useBoardViewStore.getState().filters).toEqual([]);
    expect(screen.queryByTestId('filter-count')).not.toBeInTheDocument();
  });

  it('builds a relative-date filter and a numeric between filter', () => {
    render(<FilterBar stages={STAGES} matchCount={0} totalCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
    let dialog = screen.getByRole('dialog', { name: 'Add filter' });
    fireEvent.change(within(dialog).getByLabelText('Field'), { target: { value: 'dueDate' } });
    fireEvent.change(within(dialog).getByLabelText('Relative date'), { target: { value: 'next_7_days' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }));
    expect(useBoardViewStore.getState().filters[0]).toEqual({ field: 'dueDate', operator: 'between', value: { relative: 'next_7_days' } });
    expect(screen.getByRole('button', { name: /Close \/ due date is Next 7 days/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
    dialog = screen.getByRole('dialog', { name: 'Add filter' });
    fireEvent.change(within(dialog).getByLabelText('Field'), { target: { value: 'value' } });
    fireEvent.change(within(dialog).getByLabelText('Condition'), { target: { value: 'between' } });
    fireEvent.change(within(dialog).getByLabelText('Minimum'), { target: { value: '100' } });
    fireEvent.change(within(dialog).getByLabelText('Maximum'), { target: { value: '500' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add filter' }));
    expect(useBoardViewStore.getState().filters[1]).toEqual({ field: 'value', operator: 'between', value: [100, 500] });
  });

  it('applies advanced AND/OR groups from the builder', () => {
    render(<FilterBar stages={STAGES} matchCount={0} totalCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    const builder = screen.getByTestId('complex-filter-builder');
    fireEvent.change(within(builder).getByLabelText('Group 1 logic'), { target: { value: 'OR' } });
    fireEvent.change(within(builder).getByLabelText('Group 1 condition 1 value'), { target: { value: 'lead' } });
    fireEvent.click(within(builder).getByRole('button', { name: 'Apply filters' }));
    const { groups } = useBoardViewStore.getState();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ logicalOperator: 'OR', filters: [{ field: 'stage', operator: 'equals', value: 'lead' }] });
    expect(screen.getByRole('button', { name: /Advanced\s+1 group, 1 condition/ })).toBeInTheDocument();
  });
});

describe('board grouping helpers', () => {
  const mk = (id: string, over: Partial<Deal>): Deal => ({
    id, company: '', contact: '', value: 1, stage: 'lead', probability: 0, priority: 'medium',
    createdAt: new Date(), updatedAt: new Date(), ...over
  });
  const deals = [
    mk('1', { priority: 'high', assignedTo: 'Sam', assignedToId: 's1', company: 'Acme' }),
    mk('2', { priority: 'low', assignedTo: 'Sam', company: 'acme' }),
    mk('3', { priority: 'low', company: '' })
  ];

  it('builds priority, owner and company columns', () => {
    expect(buildGroupColumns(deals, 'priority').map(c => [c.key, c.deals.length])).toEqual([['high', 1], ['medium', 0], ['low', 2]]);
    expect(buildGroupColumns(deals, 'owner').map(c => [c.title, c.deals.length])).toEqual([['Sam', 2], ['Unassigned', 1]]);
    expect(buildGroupColumns(deals, 'company').map(c => [c.title, c.deals.length])).toEqual([['Acme', 2], ['No company', 1]]);
    expect(buildGroupColumns([], 'owner').map(c => c.key)).toEqual([NONE_KEY]);
  });

  it('maps a drop onto the field update (company grouping is read-only)', () => {
    expect(updatesForGroupDrop('priority', 'high', deals)).toEqual({ priority: 'high' });
    expect(updatesForGroupDrop('owner', 'Sam', deals)).toEqual({ assignedTo: 'Sam', assignedToId: 's1', ownerId: 's1' });
    expect(updatesForGroupDrop('owner', NONE_KEY, deals)).toEqual({ assignedTo: null, assignedToId: null, ownerId: null });
    expect(updatesForGroupDrop('company', 'Acme', deals)).toBeNull();
    expect(isGroupingDroppable('company')).toBe(false);
    expect(isGroupingDroppable('priority')).toBe(true);
  });
});
