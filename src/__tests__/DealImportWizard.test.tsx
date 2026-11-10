import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('../services/dataSyncService', () => ({ getDataSyncService: () => ({ isDatabaseConnected: () => false }) }));
jest.mock('../services/supabaseService', () => ({ getSupabaseService: () => ({}), supabase: {}, isSupabaseConfigured: false }));
jest.mock('../services/pipelineStageService', () => ({
  getStages: jest.fn(() => Promise.resolve([])),
  subscribe: jest.fn(() => () => undefined),
  DEFAULT_STAGES: []
}));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));
const mockDownload = jest.fn();
jest.mock('../components/import/downloadFile', () => ({ downloadTextFile: (...a: unknown[]) => mockDownload(...a) }));

import { DealImportWizard } from '../components/import/DealImportWizard';
import { useDealStore } from '../store/dealStore';
import type { Deal, PipelineStage } from '../types';

const stage = (key: string, name: string, position: number, probability: number): PipelineStage => ({
  id: key, key, name, color: 'blue', position, visible: true, probability, isWon: false, isLost: false, wipLimit: null
});

const CSV = [
  'Deal Name,Company,Contact,Amount,Stage,Priority,Close Date,Tags',
  'Website redesign,Acme,Jane Doe,"$12,500",Qualified,high,2026-12-31,"web;design"',
  'Support plan,Globex,John Smith,3000,Lead,,,',
  ',Initech,Nobody,100,Lead,,,',
  'Bad number,Initech,Pat,lots,Lead,,,',
  'Existing deal,Hooli,Gavin,50,Lead,,,'
].join('\n');

const fileOf = (name: string, text: string) => ({ name, size: text.length, type: 'text/csv', text: async () => text }) as unknown as File;

const existing = (): Deal => ({
  id: 'e1', title: 'Existing Deal', company: 'HOOLI', contact: 'x', value: 1, stage: 'lead', probability: 10, priority: 'low',
  createdAt: new Date(), updatedAt: new Date(), position: 4
});

describe('DealImportWizard', () => {
  const createDeal = jest.fn(async (d: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => ({ ...d, id: `n-${createDeal.mock.calls.length}`, createdAt: new Date(), updatedAt: new Date() }));
  const updateDeal = jest.fn(async (id: string) => ({ id }));
  const addStage = jest.fn(async (name: string) => stage(name.toLowerCase(), name, 9, 0));

  beforeEach(() => {
    jest.clearAllMocks();
    useDealStore.setState({
      deals: { e1: existing() },
      stages: [stage('lead', 'Lead', 0, 10), stage('qualified', 'Qualified', 1, 30)],
      createDeal, updateDeal, addStage
    });
  });

  const upload = async (text = CSV, name = 'deals.csv') => {
    await act(async () => {
      fireEvent.change(screen.getByTestId('import-file-input'), { target: { files: [fileOf(name, text)] } });
    });
  };

  it('imports a small CSV: upload, auto-map, validate, import and report', async () => {
    const onImported = jest.fn();
    render(<DealImportWizard isOpen onClose={jest.fn()} onImported={onImported} />);

    // Step 1: upload
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('1. Upload');
    await upload();

    // Step 2: columns were mapped automatically
    expect(await screen.findByText(/5 rows/)).toBeInTheDocument();
    expect(screen.getByLabelText('Map column Deal Name')).toHaveValue('title');
    expect(screen.getByLabelText('Map column Company')).toHaveValue('company');
    expect(screen.getByLabelText('Map column Amount')).toHaveValue('value');
    expect(screen.getByLabelText('Map column Stage')).toHaveValue('stage');
    expect(screen.getByLabelText('Map column Close Date')).toHaveValue('dueDate');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    // Step 3: validation + duplicates
    const table = screen.getByTestId('import-preview');
    expect(within(table).getByText('Missing title')).toBeInTheDocument();
    expect(within(table).getByText(/Invalid number "lots"/)).toBeInTheDocument();
    expect(within(table).getByText('Duplicate of existing deal')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 ready');
    expect(screen.getByRole('status')).toHaveTextContent('1 duplicate');
    expect(screen.getByRole('status')).toHaveTextContent('2 with errors');

    // Step 4/5: import (duplicates skipped by default)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Import 2 deals/ })); });
    const result = await screen.findByTestId('import-result');
    expect(result).toHaveTextContent('2 deals created');
    expect(result).toHaveTextContent('1 skipped as duplicates');
    expect(result).toHaveTextContent('2 rows with errors');

    expect(createDeal).toHaveBeenCalledTimes(2);
    expect(createDeal).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Website redesign', company: 'Acme', contact: 'Jane Doe', value: 12500, stage: 'qualified',
      priority: 'high', tags: ['web', 'design'], probability: 30
    }));
    expect(createDeal).toHaveBeenCalledWith(expect.objectContaining({ title: 'Support plan', value: 3000, stage: 'lead', priority: 'medium' }));
    // new deals are appended after the existing deal in the lead stage
    const leadPositions = createDeal.mock.calls.map(c => c[0]).filter(d => d.stage === 'lead').map(d => d.position);
    expect(leadPositions).toEqual([5]);
    expect(onImported).toHaveBeenCalledWith(2);

    // error CSV
    fireEvent.click(screen.getByRole('button', { name: /Download error CSV/ }));
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [csv, filename] = mockDownload.mock.calls[0];
    expect(filename).toBe('deal-import-errors.csv');
    expect(csv).toContain('Missing title');
    expect(csv).toContain('Invalid number');
  });

  it('requires a title mapping before continuing', async () => {
    render(<DealImportWizard isOpen onClose={jest.fn()} />);
    await upload('Foo,Bar\n1,2\n');
    const preview = await screen.findByRole('button', { name: 'Preview' });
    expect(preview).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Map a column to Title');
    fireEvent.change(screen.getByLabelText('Map column Foo'), { target: { value: 'title' } });
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
  });

  it('creates unknown stages and can update existing deals', async () => {
    render(<DealImportWizard isOpen onClose={jest.fn()} />);
    await upload('title,company,stage,amount\nExisting deal,Hooli,Negotiation,999\nBrand new,Acme,Negotiation,5\n');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
    expect(screen.getByLabelText('Stage for Negotiation')).toHaveValue('__new__');
    fireEvent.click(screen.getByLabelText('Update existing deals'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Import 2 deals/ })); });
    await screen.findByTestId('import-result');
    expect(addStage).toHaveBeenCalledTimes(1);
    expect(addStage).toHaveBeenCalledWith('Negotiation');
    expect(createDeal).toHaveBeenCalledWith(expect.objectContaining({ title: 'Brand new', stage: 'negotiation' }));
    expect(updateDeal).toHaveBeenCalledWith('e1', expect.objectContaining({ value: 999, stage: 'negotiation' }));
    expect(updateDeal.mock.calls[0][1]).not.toHaveProperty('title');
  });

  it('rejects unsupported and empty files with a readable message', async () => {
    render(<DealImportWizard isOpen onClose={jest.fn()} />);
    await upload('x', 'notes.pdf');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unsupported file type');
    await upload('title,company\n', 'empty.csv');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('no data rows'));
  });

  it('offers a CSV template download', () => {
    render(<DealImportWizard isOpen onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Download CSV template/ }));
    expect(mockDownload).toHaveBeenCalledWith(expect.stringContaining('title,company,contact,value,stage'), 'deal-import-template.csv');
  });
});
