import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

jest.mock('../lib/core/supabaseClient', () => ({ isSupabaseConfigured: false, supabase: {} }));
jest.mock('../config/demoMode', () => ({ isDemoMode: () => true }));

// Heavy tab bodies are replaced by markers so the test checks which component each tab mounts.
const marker = (name: string) => (props: any) => (
  <div data-testid={name} data-signal={props.composeSignal ?? props.focusSignal ?? props.scheduleSignal ?? props.editTitleSignal ?? ''}>{name}</div>
);
jest.mock('../components/DealCommunicationHub', () => ({ DealCommunicationHub: (p: any) => marker('comm-hub')(p) }));
jest.mock('../components/DealAnalyticsDashboard', () => ({ DealAnalyticsDashboard: (p: any) => marker('analytics-dashboard')(p) }));
jest.mock('../components/DealAutomationPanel', () => ({ DealAutomationPanel: (p: any) => marker('automation-panel')(p) }));
jest.mock('../components/DealDetailView/DealDetailOverview', () => ({ DealDetailOverview: (p: any) => marker('overview')(p) }));
jest.mock('../components/DealDetailView/DealManagementPanel', () => ({ __esModule: true, default: (p: any) => marker('management')(p) }));
jest.mock('../components/deals/DealNotes', () => ({ __esModule: true, default: (p: any) => marker('notes')(p) }));
jest.mock('../components/deals/DealTasks', () => ({ __esModule: true, default: (p: any) => marker('tasks')(p) }));
jest.mock('../components/deals/DealFiles', () => ({ __esModule: true, default: (p: any) => marker('files')(p) }));
jest.mock('../components/deals/DealTimeline', () => ({ __esModule: true, default: (p: any) => marker('timeline')(p) }));
jest.mock('../components/deals/DealActivityPanel', () => ({ __esModule: true, default: (p: any) => marker('journey')(p) }));
jest.mock('../components/deals/DealCalendarPanel', () => ({ __esModule: true, default: (p: any) => marker('calendar')(p) }));
jest.mock('../components/deals/ai', () => ({ DealInsightsTab: (p: any) => marker('insights')(p), DealAssistantPanel: (p: any) => marker('assistant')(p) }));
jest.mock('../components/AIEmailComposer', () => ({ AIEmailComposer: () => <div data-testid="ai-email" /> }));
jest.mock('../components/EmailComposer', () => ({ EmailComposer: (p: any) => <div data-testid={p.inline ? 'email-inline' : 'email-modal'} data-queued={typeof p.onQueued} data-onsend={typeof p.onSend} /> }));
jest.mock('../components/ContactsModal', () => ({ ContactsModal: () => <div data-testid="contacts-modal" /> }));
jest.mock('../components/deals/fields/ManageFieldsDialog', () => ({ ManageFieldsDialog: (p: any) => (p.isOpen ? <div data-testid="manage-fields" /> : null) }));
jest.mock('../components/deals/MergeDealsModal', () => ({ __esModule: true, default: (p: any) => (p.isOpen ? <div data-testid="merge-modal" data-ids={p.initialIds.join(',')} /> : null) }));
jest.mock('../components/DealDetail', () => ({ __esModule: true, default: (p: any) => <div data-testid="detail" data-variant={p.variant} /> }));
jest.mock('../components/agents/EmbeddedAgentInterface', () => ({ EmbeddedAgentInterface: () => null }));
jest.mock('../components/ui/CustomizableAIToolbar', () => ({ AIGoalsButton: () => <button type="button">AI Goals</button> }));
jest.mock('../components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../services/contextDetectionService', () => ({ contextDetectionService: { analyzeContext: () => ({ recommendedAgents: ['sdr-follow-up'] }) } }));
jest.mock('../services/sdrPreferencesService', () => ({ sdrPreferencesService: { getUserPreferences: jest.fn(), saveUserPreferences: jest.fn() } }));
jest.mock('../services/errorReportingService', () => ({ getErrorReportingService: () => ({ reportError: jest.fn() }) }));
jest.mock('../services/phoneService', () => ({ getPhoneService: () => ({ makeCall: jest.fn() }) }));
jest.mock('../services/aiEnrichmentService', () => ({ getAIEnrichmentService: () => ({ enrichContactFromWeb: jest.fn() }) }));
const mockRunSdr = jest.fn();
const mockResumeSdr = jest.fn();
jest.mock('../services/sdrAgentClient', () => ({
  runSdrAgent: (...a: any[]) => mockRunSdr(...a),
  resumeSdrRun: (...a: any[]) => mockResumeSdr(...a)
}));

import { DealDetailModal } from '../components/DealDetailView/DealDetailModal';
import { DealDetailSidebar } from '../components/DealDetailView/DealDetailSidebar';
import { DealDetailTabs } from '../components/DealDetailView/DealDetailTabs';
import { DealSidePanel } from '../components/DealDetailView/DealSidePanel';
import { useContactStore } from '../store/contactStore';
import { useDealStore } from '../store/dealStore';
import { useDealViewPrefsStore } from '../store/dealViewPrefsStore';
import { LS_PREFS_KEY } from '../services/dealViewPrefsService';
import { useDealRecordStore } from '../store/dealRecordStore';
import { dispatchDealRecordAction, getCommandContext } from '../components/commandPaletteContext';

const contact: any = { id: 'c1', name: 'Jane Buyer', email: 'jane@example.com', phone: '555-0100', title: 'CTO', company: 'Acme' };
const deal: any = {
  id: 'd1', title: 'Acme renewal', company: 'Acme', contact: 'Jane Buyer', contactId: 'c1', value: 1000, stage: 'proposal',
  probability: 40, priority: 'medium', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-02-01'), isFavorite: false
};

const renderModal = (props: Partial<React.ComponentProps<typeof DealDetailModal>> = {}) => {
  const onClose = jest.fn();
  const onUpdate = jest.fn(async (_id: string, u: any) => ({ ...deal, ...u }));
  const utils = render(
    <MemoryRouter>
      <DealDetailModal deal={deal} isOpen onClose={onClose} onUpdate={onUpdate} variant="page" {...props} />
    </MemoryRouter>
  );
  return { ...utils, onClose, onUpdate };
};
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Deal sections' })).getByRole('button', { name: new RegExp(`^${name}( \\d)?$`) });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useDealViewPrefsStore.getState().reset();
  useContactStore.setState({ contacts: [contact] } as any);
  useDealStore.setState({ deals: { d1: deal }, stages: [] } as any);
  useDealRecordStore.setState({ toasts: [] } as any);
});

describe('DealDetailModal tabs mount the real components', () => {
  it.each([
    ['Overview', 'overview'], ['Notes', 'notes'], ['Tasks', 'tasks'], ['Files', 'files'], ['Timeline', 'timeline'],
    ['AI Insights', 'insights'], ['Assistant', 'assistant'], ['Journey', 'journey'], ['Communication', 'comm-hub'],
    ['Calendar', 'calendar'], ['Analytics', 'analytics-dashboard'], ['Automation', 'automation-panel'], ['Management', 'management']
  ])('%s tab renders %s', async (label, testId) => {
    renderModal();
    await act(async () => { fireEvent.click(tab(label)); });
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByText(/would go here/i)).toBeNull();
  });

  it('Email tab renders the inline composer with onQueued and no onSend / fixed overlay', async () => {
    renderModal();
    await act(async () => { fireEvent.click(tab('Email')); });
    const inline = screen.getByTestId('email-inline');
    expect(inline).toHaveAttribute('data-queued', 'function');
    expect(inline).toHaveAttribute('data-onsend', 'undefined');
    expect(screen.queryByTestId('email-modal')).toBeNull();
  });

  it('Email tab asks to link a contact when none is linked', async () => {
    useContactStore.setState({ contacts: [] } as any);
    renderModal({ deal: { ...deal, contactId: undefined, contact: '' } });
    await act(async () => { fireEvent.click(tab('Email')); });
    expect(screen.getByRole('button', { name: 'Link Contact' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Link Contact' }));
    expect(screen.getByTestId('contacts-modal')).toBeInTheDocument();
  });

  it('panel variant has no profile sidebar; page variant does', () => {
    const { unmount, container } = renderModal({ variant: 'panel' });
    expect(container.querySelector('.w-80')).toBeNull();
    unmount();
    const page = renderModal({ variant: 'page' });
    expect(page.container.querySelector('.w-80')).not.toBeNull();
    expect(screen.getByText('Deal Profile')).toBeInTheDocument();
  });
});

describe('sidebar has no dead buttons', () => {
  it('every enabled sidebar button calls a handler (AI Goals is self-contained)', () => {
    const onAction = jest.fn();
    const onClose = jest.fn();
    const onToggleFavorite = jest.fn(async () => undefined);
    const { container } = render(
      <MemoryRouter>
        <DealDetailSidebar deal={deal} editedDeal={deal} linkedContact={contact} onAction={onAction} onClose={onClose} onToggleFavorite={onToggleFavorite} />
      </MemoryRouter>
    );
    const buttons = Array.from(container.querySelectorAll('button')).filter(b => !(b as HTMLButtonElement).disabled && b.textContent !== 'AI Goals');
    expect(buttons.length).toBeGreaterThan(8);
    for (const b of buttons) {
      const before = onAction.mock.calls.length + onClose.mock.calls.length + onToggleFavorite.mock.calls.length;
      fireEvent.click(b);
      const after = onAction.mock.calls.length + onClose.mock.calls.length + onToggleFavorite.mock.calls.length;
      expect({ label: b.getAttribute('aria-label') || b.textContent, called: after > before }).toEqual({ label: b.getAttribute('aria-label') || b.textContent, called: true });
    }
    const actions = onAction.mock.calls.map(c => c[0]);
    expect(actions).toEqual(expect.arrayContaining(['edit', 'meet', 'add-field', 'view-files', 'view-insights', 'view-analytics', 'change-contact', 'remove-contact']));
  });

  it('Add Contact is wired when no contact is linked', () => {
    const onAction = jest.fn();
    render(
      <MemoryRouter>
        <DealDetailSidebar deal={deal} editedDeal={deal} linkedContact={null} onAction={onAction} onClose={jest.fn()} onToggleFavorite={jest.fn(async () => undefined)} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Contact' }));
    expect(onAction).toHaveBeenCalledWith('add-contact');
  });

  it('sidebar actions switch tabs and open dialogs inside the modal', async () => {
    const { container } = renderModal();
    const side = within(container.querySelector('.w-80') as HTMLElement);
    fireEvent.click(side.getByRole('button', { name: /^Insights$/ }));
    expect(screen.getByTestId('insights')).toBeInTheDocument();
    fireEvent.click(side.getByRole('button', { name: /^Analytics$/ }));
    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    fireEvent.click(side.getByRole('button', { name: /^Files$/ }));
    expect(screen.getByTestId('files')).toBeInTheDocument();
    fireEvent.click(side.getByRole('button', { name: /Add Field/ }));
    expect(screen.getByTestId('manage-fields')).toBeInTheDocument();
    fireEvent.click(side.getByRole('button', { name: /^Meet$/ }));
    expect(screen.getByTestId('calendar')).toHaveAttribute('data-signal', '1');
    fireEvent.click(side.getByRole('button', { name: 'Change contact' }));
    expect(screen.getByTestId('contacts-modal')).toBeInTheDocument();
  });

  it('Edit focuses the title editor on the overview and unlinking the contact updates the deal', async () => {
    const { onUpdate, container } = renderModal();
    await act(async () => { fireEvent.click(tab('Notes')); });
    fireEvent.click(within(container.querySelector('.w-80') as HTMLElement).getByRole('button', { name: /^Edit$/ }));
    expect(screen.getByTestId('overview')).toHaveAttribute('data-signal', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Unlink contact' }));
    expect(onUpdate).toHaveBeenCalledWith('d1', { contact: '', contactId: undefined });
  });
});

describe('SDR agents', () => {
  it('shows the SDR group and runs the agent through sdrAgentClient, then shows the draft', async () => {
    mockRunSdr.mockResolvedValue({
      type: 'final', agent: 'sdr-follow-up',
      output: { strategy: 'Nudge on the proposal', outreach: { channel: 'email', subject: 'Checking in', body: 'Hi Jane', call_to_action: 'Reply' }, key_points: ['k1'], crm_updates: [], confidence: 0.8 }
    });
    renderModal();
    const btn = screen.getByRole('button', { name: /^Follow-Up SDR$/ });
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => expect(mockRunSdr).toHaveBeenCalled());
    expect(mockRunSdr.mock.calls[0][0]).toMatchObject({ agentId: 'sdr-follow-up', leadId: 'c1' });
    const dialog = await screen.findByRole('dialog', { name: /Follow-Up SDR results/ });
    expect(await within(dialog).findByText('Nudge on the proposal')).toBeInTheDocument();
  });

  it('approval flow sends the signed opaque state back unchanged', async () => {
    mockRunSdr.mockResolvedValue({ type: 'approval_required', state: 'opaque.SIGNED+state/==', approvals: [{ callId: 'call-1', tool: 'send_sdr_message', arguments: { to: 'jane' } }] });
    mockResumeSdr.mockResolvedValue({ type: 'final', output: 'Sent.' });
    renderModal();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Follow-Up SDR$/ })); });
    const dialog = await screen.findByRole('dialog', { name: /Follow-Up SDR results/ });
    await within(dialog).findByText('Approval required');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: /Submit decisions/ })); });
    await waitFor(() => expect(mockResumeSdr).toHaveBeenCalled());
    const [base, state, decisions] = mockResumeSdr.mock.calls[0];
    expect(base).toEqual({ agentId: 'sdr-follow-up', leadId: 'c1' });
    expect(state).toBe('opaque.SIGNED+state/==');
    expect(decisions).toEqual([{ callId: 'call-1', approve: true }]);
    expect(await within(dialog).findByText('Sent.')).toBeInTheDocument();
  });

  it('shows the error from a failed run', async () => {
    mockRunSdr.mockResolvedValue({ type: 'error', error: 'Guardrail tripped', blocked: true });
    renderModal();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Follow-Up SDR$/ })); });
    expect(await screen.findByText(/Guardrail tripped/)).toBeInTheDocument();
    expect(screen.getByText(/Blocked by guardrail/)).toBeInTheDocument();
  });

  it('asks for a contact when none is linked', async () => {
    useContactStore.setState({ contacts: [] } as any);
    renderModal({ deal: { ...deal, contactId: undefined, contact: '' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Follow-Up SDR$/ })); });
    expect(mockRunSdr).not.toHaveBeenCalled();
    expect(useDealRecordStore.getState().toasts.some(t => /Link a contact/.test(t.message))).toBe(true);
  });
});

describe('record hotkeys, shortcut help and palette actions', () => {
  it('n / t focus the composers, ? opens the help, Esc closes, Alt+digit switches tabs', async () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(screen.getByTestId('notes')).toHaveAttribute('data-signal', '1');
    fireEvent.keyDown(document.body, { key: 't' });
    expect(screen.getByTestId('tasks')).toHaveAttribute('data-signal', '1');
    fireEvent.keyDown(window, { key: '3', code: 'Digit3', altKey: true });
    expect(screen.getByTestId('tasks')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '4', code: 'Digit4', altKey: true });
    expect(screen.getByTestId('files')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Deal shortcuts' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Deal shortcuts' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('f toggles favorite through onUpdate', async () => {
    const { onUpdate } = renderModal();
    await act(async () => { fireEvent.keyDown(document.body, { key: 'f' }); });
    expect(onUpdate).toHaveBeenCalledWith('d1', { isFavorite: true });
  });

  it('sets the command context while open and clears it on close', () => {
    const { unmount } = renderModal();
    expect(getCommandContext().dealId).toBe('d1');
    unmount();
    expect(getCommandContext().dealId).toBeNull();
  });

  it('handles every deal-record:action event', async () => {
    renderModal();
    await act(async () => { dispatchDealRecordAction('add-note', 'd1'); });
    expect(screen.getByTestId('notes')).toHaveAttribute('data-signal', '1');
    await act(async () => { dispatchDealRecordAction('add-task', 'd1'); });
    expect(screen.getByTestId('tasks')).toHaveAttribute('data-signal', '1');
    await act(async () => { dispatchDealRecordAction('run-workflow', 'd1'); });
    expect(screen.getByTestId('automation-panel')).toBeInTheDocument();
    await act(async () => { dispatchDealRecordAction('find-duplicates', 'd1'); });
    expect(screen.getByTestId('merge-modal')).toBeInTheDocument();
  });

  it('ignores actions for another deal', async () => {
    renderModal();
    await act(async () => { dispatchDealRecordAction('add-note', 'other'); });
    expect(screen.getByTestId('overview')).toBeInTheDocument();
  });
});

describe('tab customization', () => {
  const Harness = () => {
    const [active, setActive] = React.useState('overview');
    return <DealDetailTabs activeTab={active} onTabChange={setActive} />;
  };

  it('hides and reorders tabs, persists the prefs, and keeps the Alt hint accurate', async () => {
    render(<Harness />);
    expect(screen.getByText('1-9')).toBeInTheDocument();
    // tab 10+ has no shortcut number
    expect(screen.getByRole('button', { name: 'Email' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Customize tabs' })); });
    const dlg = screen.getByRole('dialog', { name: 'Customize tabs' });
    expect(within(dlg).getByRole('checkbox', { name: 'Show Overview tab' })).toBeDisabled();
    await act(async () => { fireEvent.click(within(dlg).getByRole('checkbox', { name: 'Show Files tab' })); });
    expect(screen.queryByRole('button', { name: /^Files/ })).toBeNull();
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Move Notes down' })); });
    const names = Array.from(document.querySelectorAll('nav[aria-label="Deal sections"] button')).map(b => b.textContent);
    expect(names.indexOf('Tasks1')).toBe(-1);
    expect(names.slice(0, 3).join('|')).toMatch(/^Overview.*\|Tasks.*\|Notes/);
    const saved = JSON.parse(localStorage.getItem(LS_PREFS_KEY) || '{}');
    expect(saved.hiddenTabs).toEqual(['files']);
    expect(saved.tabOrder.slice(0, 3)).toEqual(['overview', 'tasks', 'notes']);
    await act(async () => { fireEvent.click(within(dlg).getByRole('button', { name: 'Reset to default' })); });
    expect(screen.getByRole('button', { name: /^Files/ })).toBeInTheDocument();
  });

  it('numbers the first nine visible tabs and the hint shrinks with fewer tabs', async () => {
    await act(async () => { await useDealViewPrefsStore.getState().setHiddenTabs(['files', 'timeline', 'insights', 'assistant', 'journey', 'communication', 'calendar', 'email']); });
    render(<Harness />);
    expect(screen.getByText('1-6')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '2', code: 'Digit2', altKey: true });
    expect(screen.getByRole('button', { name: /^Notes/ })).toHaveAttribute('aria-current', 'page');
  });
});

describe('side panel', () => {
  const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

  it('shows the deal in a drawer, expands to /deals/:id and closes', () => {
    const onClose = jest.fn();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Where />
        <Routes><Route path="*" element={<DealSidePanel dealId="d1" onClose={onClose} />} /></Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('deal-side-panel')).toBeInTheDocument();
    expect(screen.getByText('Acme renewal')).toBeInTheDocument();
    expect(screen.getByTestId('detail')).toHaveAttribute('data-variant', 'panel');
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Expand to full page' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/deals/d1');
  });
});
