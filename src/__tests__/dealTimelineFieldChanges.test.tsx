import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

import DealTimeline from '../components/deals/DealTimeline';
import { __resetLocalFieldChanges, recordLocalFieldChanges } from '../services/timelineAdapter';
import { logManualActivity } from '../services/dealTimelineService';
import { useDealStore } from '../store/dealStore';

describe('DealTimeline field history', () => {
  beforeEach(() => { __resetLocalFieldChanges(); useDealStore.setState({ deals: {} }); });

  it('renders field_changed entries with actor and a Changes filter', async () => {
    await recordLocalFieldChanges('deal-x', [{ field: 'value', from: 40000, to: 55000 }], 'Ann');
    await logManualActivity('deal-x', { type: 'call', title: 'Called Jane' });
    render(<DealTimeline dealId="deal-x" showFilters />);
    expect(await screen.findByText('Value: $40,000 → $55,000')).toBeInTheDocument();
    expect(screen.getByText('by Ann')).toBeInTheDocument();
    expect(screen.getByText('Called Jane')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter timeline'), { target: { value: 'fields' } });
    expect(screen.queryByText('Called Jane')).toBeNull();
    expect(screen.getByText('Value: $40,000 → $55,000')).toBeInTheDocument();
  });
});
