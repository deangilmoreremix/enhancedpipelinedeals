import React, { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import { usePermissions } from '../../hooks/usePermissions';
import { usePermissionStore } from '../../store/permissionStore';
import { describeMatrix, PERMISSION_ACTIONS } from '../../services/permissionService';
import { ModernButton } from './ModernButton';

const ACTION_LABEL: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', bulk: 'Bulk',
  manage_stages: 'Stages', manage_workflows: 'Workflows', manage_views: 'Views',
  import: 'Import', export: 'Export', assign: 'Assign', manage_roles: 'Roles',
};

/** Permissions tab of the settings modal (admins and demo mode only). */
export const PermissionsSettings: React.FC = () => {
  const { role, rlsMode, workspaceId, workspaceName, isDemo, refresh } = usePermissions();
  const setRlsMode = usePermissionStore(s => s.setRlsMode);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const next = rlsMode === 'open' ? 'workspace' : 'open';

  const apply = async () => {
    setConfirming(false);
    setBusy(true);
    setMessage(null);
    try {
      if (isDemo) {
        setRlsMode(next); // demo has no database; purely illustrative
        setMessage({ ok: true, text: `RLS mode set to ${next} (demo only: nothing is enforced in demo mode)` });
        return;
      }
      const { error } = await supabase.rpc('set_rls_mode', { mode: next });
      if (error) throw error;
      setRlsMode(next);
      await refresh();
      setMessage({ ok: true, text: `RLS mode is now ${next}` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Could not change RLS mode' });
    } finally {
      setBusy(false);
    }
  };

  const matrix = describeMatrix();

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />Your access
        </h4>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-gray-500 dark:text-gray-400">Role</dt>
          <dd className="text-gray-900 dark:text-white capitalize" data-testid="perm-role">{role}</dd>
          <dt className="text-gray-500 dark:text-gray-400">Workspace</dt>
          <dd className="text-gray-900 dark:text-white truncate" data-testid="perm-workspace">{workspaceName ?? workspaceId ?? (isDemo ? 'Demo workspace' : 'None')}</dd>
          <dt className="text-gray-500 dark:text-gray-400">RLS mode</dt>
          <dd className="text-gray-900 dark:text-white" data-testid="perm-mode">{rlsMode}</dd>
        </dl>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Row-level security</h4>
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            aria-label="Enforce workspace permissions"
            checked={rlsMode === 'workspace'}
            disabled={busy}
            onChange={() => setConfirming(true)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Enforce workspace permissions (RLS mode: workspace)</span>
        </label>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 ml-7">
          Open mode keeps today's behaviour. Workspace mode restricts access to signed-in users, scopes rows to their workspace and limits edits to owners and admins.
        </p>
        {confirming && (
          <div role="alertdialog" aria-label="Confirm RLS mode change" className="mt-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {next === 'workspace'
                ? 'Switching to workspace mode stops anonymous access, and rows without a workspace_id become invisible. Make sure your data is backfilled and you have an admin role before continuing.'
                : 'Switching back to open mode restores unrestricted access for the app.'}
            </p>
            <div className="flex space-x-2">
              <ModernButton variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</ModernButton>
              <ModernButton variant="primary" size="sm" onClick={() => void apply()}>Switch to {next}</ModernButton>
            </div>
          </div>
        )}
        {message && (
          <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{message.text}</p>
        )}
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 overflow-x-auto">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Role capabilities</h4>
        <table className="w-full text-xs" aria-label="Role capabilities">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th className="py-1 pr-2 font-medium">Role</th>
              {PERMISSION_ACTIONS.map(a => <th key={a} className="py-1 px-1 font-medium">{ACTION_LABEL[a]}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr key={row.role} className="border-t border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                <td className="py-1 pr-2 capitalize font-medium">{row.role}</td>
                {PERMISSION_ACTIONS.map(a => (
                  <td key={a} className="py-1 px-1">
                    {row.caps[a] === true ? <Check className="w-3.5 h-3.5 text-green-600" aria-label="Allowed" />
                      : row.caps[a] === 'own' ? <span title="Own or assigned records only">own</span>
                      : <span className="text-gray-400" aria-label="Not allowed">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">"own" = records you own, are assigned to, or created. Enforcement of record is the database (RLS).</p>
      </div>
    </div>
  );
};

export default PermissionsSettings;
