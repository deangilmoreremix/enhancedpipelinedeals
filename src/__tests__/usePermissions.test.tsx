import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

let mockDemo = false;
jest.mock('../config/demoMode', () => ({ isDemoMode: () => mockDemo }));
jest.mock('../services/supabaseService', () => ({ supabase: {}, isSupabaseConfigured: false, getSupabaseService: () => ({}) }));

import { usePermissions } from '../hooks/usePermissions';
import { usePermissionStore } from '../store/permissionStore';
import { PermissionGate } from '../components/ui/PermissionGate';

const Probe: React.FC<{ record?: { ownerId?: string } }> = ({ record }) => {
  const p = usePermissions();
  return (
    <div>
      <span data-testid="role">{p.role}</span>
      <span data-testid="mode">{p.rlsMode}</span>
      <span data-testid="edit">{String(p.can('edit', 'deal', record).allowed)}</span>
      <span data-testid="stages">{String(p.can('manage_stages', 'stage').allowed)}</span>
    </div>
  );
};

const signIn = (role: 'admin' | 'member' | 'viewer' | null, mode: 'open' | 'workspace') =>
  usePermissionStore.setState({ userId: 'me', role, rlsMode: mode, loadedAt: Date.now(), isLoading: false });

describe('usePermissions', () => {
  beforeEach(() => { mockDemo = false; usePermissionStore.getState().reset(); });

  it('demo mode: admin and everything allowed', () => {
    mockDemo = true;
    signIn('viewer', 'workspace');
    render(<Probe record={{ ownerId: 'someone' }} />);
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(screen.getByTestId('edit')).toHaveTextContent('true');
    expect(screen.getByTestId('stages')).toHaveTextContent('true');
  });

  it('signed out: everything allowed', () => {
    render(<Probe record={{ ownerId: 'someone' }} />);
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(screen.getByTestId('edit')).toHaveTextContent('true');
  });

  it('rls mode open: a viewer can still do everything (unchanged behaviour)', () => {
    signIn('viewer', 'open');
    render(<Probe record={{ ownerId: 'someone' }} />);
    expect(screen.getByTestId('edit')).toHaveTextContent('true');
  });

  it('workspace mode viewer is read-only', () => {
    signIn('viewer', 'workspace');
    render(<Probe />);
    expect(screen.getByTestId('role')).toHaveTextContent('viewer');
    expect(screen.getByTestId('edit')).toHaveTextContent('false');
  });

  it('workspace mode member: own records only, no stage management', () => {
    signIn('member', 'workspace');
    const { rerender } = render(<Probe record={{ ownerId: 'me' }} />);
    expect(screen.getByTestId('edit')).toHaveTextContent('true');
    rerender(<Probe record={{ ownerId: 'someone' }} />);
    expect(screen.getByTestId('edit')).toHaveTextContent('false');
    expect(screen.getByTestId('stages')).toHaveTextContent('false');
  });

  it('authenticated user without a role row defaults to member', () => {
    signIn(null, 'workspace');
    render(<Probe record={{ ownerId: 'someone' }} />);
    expect(screen.getByTestId('role')).toHaveTextContent('member');
    expect(screen.getByTestId('edit')).toHaveTextContent('false');
  });

  it('reacts when the store changes', () => {
    signIn('member', 'workspace');
    render(<Probe record={{ ownerId: 'someone' }} />);
    expect(screen.getByTestId('edit')).toHaveTextContent('false');
    act(() => { usePermissionStore.setState({ role: 'admin' }); });
    expect(screen.getByTestId('edit')).toHaveTextContent('true');
  });
});

describe('PermissionGate', () => {
  beforeEach(() => { mockDemo = false; usePermissionStore.getState().reset(); });

  it('renders children when allowed', () => {
    signIn('admin', 'workspace');
    render(<PermissionGate action="delete" kind="deal"><button>Delete</button></PermissionGate>);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides by default when denied', () => {
    signIn('viewer', 'workspace');
    render(<PermissionGate action="delete" kind="deal"><button>Delete</button></PermissionGate>);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it("fallback='disable' keeps it visible but inert with a reason", () => {
    signIn('viewer', 'workspace');
    render(<PermissionGate action="delete" kind="deal" fallback="disable"><button>Delete</button></PermissionGate>);
    const wrapper = screen.getByTestId('permission-disabled');
    expect(wrapper).toHaveAttribute('aria-disabled', 'true');
    expect(wrapper.getAttribute('title')).toMatch(/viewer role/);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('renders a custom fallback node', () => {
    signIn('viewer', 'workspace');
    render(<PermissionGate action="edit" kind="deal" fallback={<span>read only</span>}><button>Edit</button></PermissionGate>);
    expect(screen.getByText('read only')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('checks the record for members (own vs. others) and all records in bulk mode', () => {
    signIn('member', 'workspace');
    const { rerender } = render(<PermissionGate action="edit" kind="deal" record={{ ownerId: 'me' }}><button>Edit</button></PermissionGate>);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    rerender(<PermissionGate action="edit" kind="deal" record={{ ownerId: 'x' }}><button>Edit</button></PermissionGate>);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    rerender(<PermissionGate action="bulk" kind="deal" records={[{ ownerId: 'me' }, { ownerId: 'x' }]}><button>Bulk</button></PermissionGate>);
    expect(screen.queryByRole('button', { name: 'Bulk' })).not.toBeInTheDocument();
  });
});
