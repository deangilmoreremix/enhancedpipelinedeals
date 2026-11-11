import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('../../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));
jest.mock('../../services/aiEnrichmentService', () => ({ getAIEnrichmentService: () => ({}) }));

import CompanyPage from '../../pages/CompanyPage';
import { useCompanyStore } from '../../store/companyStore';
import { useDealStore } from '../../store/dealStore';
import { useContactStore } from '../../store/contactStore';
import { __resetLocalCompanies } from '../../services/companyService';

/** Regression (e2e): reloading /companies/local-co-<slug> in demo mode said "Company not found" because the
 *  company is derived from deals that load after the first lookup. */
describe('CompanyPage deep link in demo mode', () => {
  beforeEach(() => {
    localStorage.clear(); __resetLocalCompanies();
    useCompanyStore.setState({ companies: {} });
    useDealStore.setState({ deals: {}, fetchDeals: (async () => {}) as any });
    useContactStore.setState({ contacts: [], fetchContacts: (async () => {}) as any });
  });

  it('resolves the derived company once deals arrive', async () => {
    render(
      <MemoryRouter initialEntries={['/companies/local-co-acme-corp']}>
        <Routes><Route path="/companies/:id" element={<CompanyPage />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/Company not found/i)).toBeTruthy());
    await act(async () => {
      useDealStore.setState({ deals: { d1: { id: 'd1', title: 'T', company: 'Acme Corp', value: 1, stage: 'qualification' } as any } });
    });
    await waitFor(() => expect(screen.queryByText(/Company not found/i)).toBeNull());
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
  });
});
