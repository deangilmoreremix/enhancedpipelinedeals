import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, jest } from '@jest/globals';

let role: 'admin' | 'manager' | 'member' | 'viewer' = 'admin';
jest.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ role, isLoading: false, isAdmin: role === 'admin' }) }));
jest.mock('../components/settings/DataModelSettings', () => ({ __esModule: true, default: () => <div>Data model stub</div> }));
jest.mock('../components/settings/ApiKeysSettings', () => ({ __esModule: true, default: ({ canEdit }: { canEdit: boolean }) => <div>API keys stub {String(canEdit)}</div> }));
jest.mock('../components/settings/WebhooksSettings', () => ({ __esModule: true, default: () => <div>Webhooks stub</div> }));
jest.mock('../components/settings/RolesSettings', () => ({ __esModule: true, default: ({ canEdit }: { canEdit: boolean }) => <div>Roles stub {String(canEdit)}</div> }));
jest.mock('../components/settings/EmailTemplatesSettings', () => ({ __esModule: true, default: ({ canEdit }: { canEdit: boolean }) => <div>Templates stub {String(canEdit)}</div> }));
jest.mock('../components/settings/GeneralSettings', () => ({ __esModule: true, default: () => <div>General stub</div> }));

import SettingsPage from '../pages/SettingsPage';
import { tabAccess, visibleTabs } from '../components/settings/settingsTabs';

const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/settings/*" element={<SettingsPage />} /></Routes></MemoryRouter>);

describe('settings tab gating', () => {
  it('tabAccess by role', () => {
    expect(tabAccess('api-keys', 'admin')).toBe('edit');
    expect(tabAccess('api-keys', 'manager')).toBe('edit');
    expect(tabAccess('api-keys', 'member')).toBe('none');
    expect(tabAccess('webhooks', 'viewer')).toBe('none');
    expect(tabAccess('roles', 'admin')).toBe('edit');
    expect(tabAccess('roles', 'manager')).toBe('read');
    expect(tabAccess('email-templates', 'viewer')).toBe('read');
    expect(tabAccess('email-templates', 'member')).toBe('edit');
    expect(visibleTabs('member').map(t => t.key)).toEqual(['data-model', 'roles', 'email-templates', 'general']);
  });

  it('admin sees every tab and the Data model tab is the default', async () => {
    role = 'admin';
    at('/settings');
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(nav.querySelectorAll('a')).toHaveLength(6);
    expect(await screen.findByText('Data model stub')).toBeInTheDocument();
  });

  it('a member does not see API keys / Webhooks and gets a notice on a direct URL', async () => {
    role = 'member';
    at('/settings/api-keys');
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(nav).not.toHaveTextContent('API keys');
    expect(nav).not.toHaveTextContent('Webhooks');
    expect(await screen.findByText(/does not have access/i)).toBeInTheDocument();
  });

  it('roles is read-only for non-admins and editable for admins', async () => {
    role = 'manager';
    const { unmount } = at('/settings/roles');
    expect(await screen.findByText('Roles stub false')).toBeInTheDocument();
    unmount();
    role = 'admin';
    at('/settings/roles');
    expect(await screen.findByText('Roles stub true')).toBeInTheDocument();
  });
});
