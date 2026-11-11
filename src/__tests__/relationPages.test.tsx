import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));
const enrichCompany = jest.fn(async (c: any) => ({ ...c, industry: 'Robotics', description: 'Makes robots', confidence: 0.9 }));
const enrichContactFromWeb = jest.fn(async () => ({ applied: { title: 'CTO' }, suggestions: {}, research: { found: true, confidence: 0.8, sources: [] } }));
jest.mock('../services/aiEnrichmentService', () => ({
  getAIEnrichmentService: () => ({ enrichCompany, enrichContactFromWeb }),
}));

import ContactPage from '../pages/ContactPage';
import CompanyPage from '../pages/CompanyPage';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';
import { useCompanyStore } from '../store/companyStore';
import { __resetLocalCompanies } from '../services/companyService';
import type { Deal, PipelineStage } from '../types';

const stage = (key: string, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position: 0, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra,
});
const deal = (id: string, extra: Partial<Deal>): Deal => ({
  id, company: 'Acme', contact: '', value: 1000, stage: 'open', probability: 50, priority: 'medium', createdAt: new Date(), updatedAt: new Date(), ...extra,
});

const updateContact = jest.fn(async (_id: string, u: any) => ({ id: 'k1', ...u }));
const fetchContacts = jest.fn(async () => undefined);
const fetchDeals = jest.fn(async () => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  __resetLocalCompanies();
  useCompanyStore.setState({ companies: {} });
  useDealStore.setState({
    deals: {
      d1: deal('d1', { title: 'Acme pilot', contactId: 'k1', contact: 'Jane Doe', value: 1000, probability: 50, stage: 'open' }),
      d2: deal('d2', { title: 'Acme expansion', value: 4000, stage: 'won' }),
      d3: deal('d3', { title: 'Lost one', value: 9000, stage: 'lost' }),
      d4: deal('d4', { title: 'Other co', company: 'Other', value: 1 }),
    },
    stages: [stage('open'), stage('won', { isWon: true }), stage('lost', { isLost: true })],
    fetchDeals,
  } as any);
  useContactStore.setState({
    contacts: [
      { id: 'k1', name: 'Jane Doe', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', title: 'CEO', company: 'Acme', status: 'lead', interestLevel: 'hot', sources: [], createdAt: new Date(), updatedAt: new Date() } as any,
    ],
    updateContact, fetchContacts,
  } as any);
});

describe('ContactPage', () => {
  const renderPage = (id = 'k1') => render(
    <MemoryRouter initialEntries={[`/contacts/${id}`]}>
      <Routes><Route path="/contacts/:id" element={<ContactPage />} /></Routes>
    </MemoryRouter>,
  );

  it('shows details, linked company and related deals', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText(/Deals \(1\)/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Acme pilot' });
    expect(link).toHaveAttribute('href', '/deals/d1');
    expect(screen.getByText('$1,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add deal/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Acme' })).toHaveAttribute('href', expect.stringMatching(/^\/companies\/local-co-acme/)));
  });

  it('runs web enrichment and applies the returned fields', async () => {
    renderPage();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /research public info/i })); });
    expect(enrichContactFromWeb).toHaveBeenCalled();
    expect(updateContact).toHaveBeenCalledWith('k1', { title: 'CTO' });
    expect(await screen.findByText(/Applied:/)).toBeInTheDocument();
  });

  it('renders a not-found state', () => {
    renderPage('zzz');
    expect(screen.getByRole('heading', { name: 'Contact not found' })).toBeInTheDocument();
  });
});

describe('CompanyPage', () => {
  const renderPage = (id: string) => render(
    <MemoryRouter initialEntries={[`/companies/${id}`]}>
      <Routes><Route path="/companies/:id" element={<CompanyPage />} /></Routes>
    </MemoryRouter>,
  );

  it('shows related deals, contacts and totals from stage flags', async () => {
    const c = await useCompanyStore.getState().create('Acme', { industry: 'Tech' });
    renderPage(c.id);
    expect(await screen.findByRole('heading', { name: 'Acme' })).toBeInTheDocument();
    await screen.findByText(/Deals \(3\)/);
    const open = screen.getByText('Open value').parentElement as HTMLElement;
    expect(within(open).getByText('$1,000')).toBeInTheDocument();
    expect(within(screen.getByText('Weighted').parentElement as HTMLElement).getByText('$500')).toBeInTheDocument();
    expect(within(screen.getByText('Won value').parentElement as HTMLElement).getByText('$4,000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jane Doe' })).toHaveAttribute('href', '/contacts/k1');
    expect(screen.getByRole('link', { name: 'Acme expansion' })).toHaveAttribute('href', '/deals/d2');
  });

  it('researches the company and fills only empty fields', async () => {
    const c = await useCompanyStore.getState().create('Acme', { industry: 'Tech' });
    renderPage(c.id);
    await screen.findByRole('heading', { name: 'Acme' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /research company/i })); });
    expect(enrichCompany).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme', industry: 'Tech' }));
    await waitFor(() => expect(useCompanyStore.getState().companies[c.id].notes).toContain('Makes robots'));
    expect(useCompanyStore.getState().companies[c.id].industry).toBe('Tech'); // existing value kept
  });

  it('renders a not-found state', async () => {
    renderPage('nope');
    expect(await screen.findByRole('heading', { name: 'Company not found' })).toBeInTheDocument();
  });
});
