import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/pipelineStageService', () => ({ getStages: jest.fn(() => Promise.resolve([])), subscribe: jest.fn(() => () => {}), DEFAULT_STAGES: [] }));
jest.mock('../services/aiEnrichmentService', () => ({ getAIEnrichmentService: () => ({ enrichCompany: jest.fn(), enrichContactFromWeb: jest.fn() }) }));

import ContactPage from '../pages/ContactPage';
import CompanyPage from '../pages/CompanyPage';
import { useDealStore } from '../store/dealStore';
import { useContactStore } from '../store/contactStore';
import { useCompanyStore } from '../store/companyStore';
import { __resetLocalCompanies } from '../services/companyService';
import { __resetDefinitionCache, createFieldDefinition, recordCustomValues } from '../services/customFieldService';
import type { Deal, PipelineStage } from '../types';

const stage = (key: string, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id: key, key, name: key.toUpperCase(), color: 'blue', position: 0, visible: true, probability: 0, isWon: false, isLost: false, wipLimit: null, ...extra,
});
const deal = (id: string, extra: Partial<Deal>): Deal => ({
  id, company: 'Acme', contact: '', value: 1000, stage: 'open', probability: 50, priority: 'medium', createdAt: new Date(), updatedAt: new Date(), ...extra,
});

beforeEach(async () => {
  localStorage.clear();
  __resetLocalCompanies();
  __resetDefinitionCache();
  useCompanyStore.setState({ companies: {} });
  useDealStore.setState({
    deals: {
      d1: deal('d1', { title: 'Acme pilot', contactId: 'k1', contact: 'Jane Doe', value: 1000, stage: 'open' }),
      d2: deal('d2', { title: 'Acme expansion', value: 4000, stage: 'won' }),
      d3: deal('d3', { title: 'Lost one', value: 9000, stage: 'lost' }),
    },
    stages: [stage('open'), stage('won', { isWon: true }), stage('lost', { isLost: true })],
    fetchDeals: jest.fn(async () => undefined),
  } as any);
  useContactStore.setState({
    contacts: [{ id: 'k1', name: 'Jane Doe', firstName: 'Jane', lastName: 'Doe', email: 'jane@acme.com', title: 'CEO', company: 'Acme', status: 'lead', interestLevel: 'hot', sources: [], createdAt: new Date(), updatedAt: new Date() } as any],
    fetchContacts: jest.fn(async () => undefined),
  } as any);
});

const contactPage = () => render(
  <MemoryRouter initialEntries={['/contacts/k1']}><Routes><Route path="/contacts/:id" element={<ContactPage />} /></Routes></MemoryRouter>,
);
const companyPage = () => render(
  <MemoryRouter initialEntries={['/companies/local-co-acme']}><Routes><Route path="/companies/:id" element={<CompanyPage />} /></Routes></MemoryRouter>,
);

describe('ContactPage custom fields', () => {
  it('shows contact custom fields, saves a value (validated) and mirrors it into the store', async () => {
    await createFieldDefinition({ label: 'Birthday', type: 'date' }, 'contact');
    await createFieldDefinition({ label: 'Mobile', type: 'phone' }, 'contact');
    await createFieldDefinition({ label: 'Deal-only field', type: 'text' }, 'deal');
    contactPage();
    const section = await screen.findByRole('region', { name: 'Custom fields' });
    expect(within(section).getByText('Birthday')).toBeInTheDocument();
    expect(within(section).queryByText('Deal-only field')).toBeNull();

    // invalid phone is rejected inline, nothing saved
    fireEvent.click(within(section).getAllByRole('button', { name: /Empty|Click to edit/ })[0]);
    const input = await within(section).findByRole('textbox', { name: 'Mobile' });
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await within(section).findByText('Enter a valid phone number')).toBeInTheDocument();
    expect(recordCustomValues('contact', 'k1', null)).toEqual({});

    fireEvent.change(input, { target: { value: '+1 555 0100' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(recordCustomValues('contact', 'k1', null)).toEqual({ mobile: '+1 555 0100' }));
    await waitFor(() => expect(useContactStore.getState().contacts[0].customFields).toEqual({ mobile: '+1 555 0100' }));
    expect(await within(section).findByText('+1 555 0100')).toBeInTheDocument();
  });

  it('opens Manage fields for contacts and adds a field that appears immediately', async () => {
    contactPage();
    fireEvent.click(await screen.findByRole('button', { name: /Manage fields/ }));
    fireEvent.change(screen.getByLabelText('New field name'), { target: { value: 'Hobby' } });
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Custom fields' })).getByText('Hobby')).toBeInTheDocument());
  });

  it('computes a formula over built-in contact fields and shows #ERR with a tooltip for broken ones', async () => {
    await createFieldDefinition({ label: 'Badge', type: 'formula', config: { formula: 'CONCAT({firstName}, " ", {lastName}, " - ", {title})' } }, 'contact');
    await createFieldDefinition({ label: 'Broken', type: 'formula', config: { formula: '1 / 0' } }, 'contact');
    contactPage();
    expect(await screen.findByLabelText('Badge: Jane Doe - CEO')).toBeInTheDocument();
    const broken = screen.getByTestId('computed-broken');
    expect(within(broken).getByText('#ERR')).toBeInTheDocument();
    expect(within(broken).getByTitle('Division by zero')).toBeInTheDocument();
  });
});

describe('CompanyPage custom fields, rollups and duplicates', () => {
  it('shows rollup and formula fields computed from the company deals/contacts', async () => {
    await createFieldDefinition({ label: 'Open pipeline', type: 'rollup', config: { metric: 'open_deal_value' } }, 'company');
    await createFieldDefinition({ label: 'Won', type: 'rollup', config: { metric: 'won_deal_value' } }, 'company');
    await createFieldDefinition({ label: 'Open deals', type: 'rollup', config: { metric: 'open_deal_count' } }, 'company');
    await createFieldDefinition({ label: 'People', type: 'rollup', config: { metric: 'contact_count' } }, 'company');
    await createFieldDefinition({ label: 'Won x2', type: 'formula', config: { formula: '{won} * 2' } }, 'company');
    companyPage();
    expect(await screen.findByLabelText('Open pipeline: $1,000')).toBeInTheDocument();
    expect(screen.getByLabelText('Won: $4,000')).toBeInTheDocument();
    expect(screen.getByLabelText('Open deals: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('People: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Won x2: 8,000')).toBeInTheDocument();
    // rollups are read-only: no editor opens
    expect(within(screen.getByTestId('computed-open_pipeline')).queryByRole('button')).toBeNull();
  });

  it('edits a stored company field', async () => {
    await createFieldDefinition({ label: 'Account tier', type: 'select', options: ['A', 'B'] }, 'company');
    companyPage();
    const section = await screen.findByRole('region', { name: 'Custom fields' });
    fireEvent.click(await within(section).findByRole('button', { name: /None/ }));
    fireEvent.change(await within(section).findByRole('combobox', { name: 'Account tier' }), { target: { value: 'B' } });
    await waitFor(() => expect(recordCustomValues('company', 'local-co-acme', null)).toEqual({ account_tier: 'B' }));
  });

  it('has a Find duplicate companies button that opens the scan dialog', async () => {
    companyPage();
    fireEvent.click(await screen.findByRole('button', { name: /Find duplicate companies/ }));
    expect(await screen.findByRole('dialog', { name: 'Find duplicate companies' })).toBeInTheDocument();
    expect(await screen.findByText(/No duplicate companies found/)).toBeInTheDocument();
  });
});
