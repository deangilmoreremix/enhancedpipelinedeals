import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({ isInitialized: true }),
}));
jest.mock('../contexts/PersonalizationContext', () => ({ PersonalizationProvider: ({ children }: any) => children }));
jest.mock('../contexts/GamificationContext', () => ({ GamificationProvider: ({ children }: any) => children }));
jest.mock('../components/auth/AuthProvider', () => ({ AuthProvider: ({ children }: any) => children }));
jest.mock('../components/ui/DarkModeToggle', () => ({ DarkModeToggle: () => <div /> }));
jest.mock('../components/ui/EnhancedAIStatusIndicator', () => ({ EnhancedAIStatusIndicator: () => <div /> }));
jest.mock('../components/ui/SettingsModal', () => ({ SettingsModal: () => null }));
jest.mock('../hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: () => undefined, globalShortcuts: [] }));
jest.mock('../components/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => <>{children}</> }));
jest.mock('../pages/PipelinePage', () => ({ __esModule: true, default: () => <h2>Pipeline page</h2> }));
jest.mock('../pages/ContactsPage', () => ({ __esModule: true, default: () => <h2>Contacts page</h2> }));
jest.mock('../pages/AgentsPage', () => ({ __esModule: true, default: () => <h2>Agents page</h2> }));
jest.mock('../pages/CalendarPage', () => ({ __esModule: true, default: () => <h2>Calendar page</h2> }));
jest.mock('../pages/EmailPage', () => ({ __esModule: true, default: () => <h2>Email page</h2> }));
jest.mock('../pages/ViewsPage', () => ({ __esModule: true, default: () => <h2>Views page</h2> }));
jest.mock('../pages/WorkflowsPage', () => ({ __esModule: true, default: () => <h2>Workflows page</h2> }));
jest.mock('../pages/AnalyticsPage', () => ({ __esModule: true, default: () => <h2>Analytics page</h2> }));
jest.mock('../pages/AppsPage', () => ({ __esModule: true, default: () => <h2>Apps page</h2> }));

import App from '../App';

const LABELS = ['Pipeline', 'Contacts', 'Agents', 'Calendar', 'Email', 'Views', 'Workflows', 'Analytics', 'Apps'];

describe('app routes', () => {
  it('hides the top app bar on the Pipeline page', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByText('Smart CRM')).not.toBeInTheDocument();
  });

  it('renders all nav links on other pages', () => {
    render(<MemoryRouter initialEntries={['/contacts']}><App /></MemoryRouter>);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const l of LABELS) expect(within(nav).getByRole('link', { name: l })).toBeInTheDocument();
  });

  it('renders the route for the initial entry and navigates between pages', async () => {
    render(<MemoryRouter initialEntries={['/contacts']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Contacts page' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Agents' }));
    expect(await screen.findByRole('heading', { name: 'Agents page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Contacts page' })).not.toBeInTheDocument();
  });
});
