import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { BTN, BTN_PRIMARY } from '../ui/buttonStyles';
import { PERMISSION_ACTIONS, ROLE_NAMES, type PermissionAction } from '../../services/permissionService';
import {
  ACTION_LABEL, assignRole, defaultPermissions, diffPermissions, isLockedRole, listMembers, listRoles, removeRole, saveRolePermissions,
  toggled, wouldRemoveLastAdmin, type MemberRow, type RoleRow,
} from '../../services/roleAdminService';
import { pushToast } from '../../store/dealRecordStore';
import { CARD, ErrorLine, ReadOnlyNotice, SectionHeader, TD, TH, errText } from './settingsUi';

/** Effective permission list of a role: the stored list, or the built-in defaults for an unconfigured built-in role. */
export function effectivePermissions(r: RoleRow): PermissionAction[] {
  if (r.permissions.length > 0) return r.permissions;
  const n = r.name.trim().toLowerCase();
  return (ROLE_NAMES as readonly string[]).includes(n) ? defaultPermissions(n as typeof ROLE_NAMES[number]) : [];
}

/** Roles list, permission matrix editor and member role assignment. Admin only; everyone else gets a read-only view. */
export const RolesSettings: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [draft, setDraft] = useState<Record<string, PermissionAction[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([listRoles(), listMembers()]);
      setRoles(r); setMembers(m);
      setDraft(Object.fromEntries(r.map(x => [x.id, effectivePermissions(x)])));
      setError(null);
    } catch (e) { setError(errText(e, 'Could not load roles')); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changes = useMemo(() => roles.map(r => ({ role: r, diff: diffPermissions(effectivePermissions(r), draft[r.id] ?? effectivePermissions(r)) })).filter(c => c.diff.length > 0), [roles, draft]);
  const roleName = (id: string) => roles.find(r => r.id === id)?.name ?? 'unknown';

  const saveAll = async () => {
    setSaving(true);
    const failures: string[] = [];
    for (const c of changes) {
      try { await saveRolePermissions(c.role.id, draft[c.role.id]); } catch (e) { failures.push(`${c.role.name}: ${errText(e)}`); }
    }
    setSaving(false);
    if (failures.length) setError(`Some roles were not saved. ${failures.join('; ')}`); else { setError(null); pushToast('success', `Saved permissions for ${changes.length} role${changes.length === 1 ? '' : 's'}`); }
    await load();
  };

  const assign = async (userId: string, roleId: string) => {
    if (!roleId) return;
    try { await assignRole(userId, roleId); pushToast('success', `Assigned ${roleName(roleId)}`); await load(); } catch (e) { pushToast('error', errText(e, 'Could not assign the role')); }
  };
  const unassign = async (m: MemberRow, roleId: string) => {
    if (wouldRemoveLastAdmin(roles, members, roleId)) { pushToast('error', 'You cannot remove the last admin.'); return; }
    try { await removeRole(m.user_id, roleId); pushToast('success', `Removed ${roleName(roleId)} from ${m.name}`); await load(); } catch (e) { pushToast('error', errText(e, 'Could not remove the role')); }
  };

  return (
    <section aria-label="Roles and permissions">
      <SectionHeader title="Roles & permissions" description="Choose what each role may do and who has which role." />
      {!canEdit && <ReadOnlyNotice>Only admins can change roles and permissions. You can review them here.</ReadOnlyNotice>}
      <ErrorLine message={error} />
      {loading ? <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p> : roles.length === 0 ? <p className="text-sm text-gray-600 dark:text-gray-400">No roles are defined for this workspace.</p> : (
        <>
          <div className={`${CARD} overflow-x-auto !p-0`}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" aria-label="Permission matrix">
              <thead><tr><th className={TH} scope="col">Permission</th>{roles.map(r => (
                <th key={r.id} className={`${TH} text-center`} scope="col">{r.name}{isLockedRole(r) && <Lock className="ml-1 inline h-3 w-3" aria-label="locked" />}</th>))}</tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {PERMISSION_ACTIONS.map(a => (
                  <tr key={a}>
                    <th scope="row" className={`${TD} text-left font-normal`}>{ACTION_LABEL[a]}</th>
                    {roles.map(r => {
                      const locked = isLockedRole(r);
                      const on = locked || (draft[r.id] ?? []).includes(a);
                      return (
                        <td key={r.id} className={`${TD} text-center`}>
                          <input type="checkbox" aria-label={`${r.name}: ${ACTION_LABEL[a]}`} checked={on} disabled={!canEdit || locked}
                            onChange={e => setDraft(d => ({ ...d, [r.id]: toggled(d[r.id] ?? [], a, e.target.checked) }))} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className={BTN_PRIMARY} disabled={changes.length === 0 || saving} onClick={() => void saveAll()}>{saving ? 'Saving...' : 'Save permissions'}</button>
              <button type="button" className={BTN} disabled={changes.length === 0 || saving} onClick={() => setDraft(Object.fromEntries(roles.map(x => [x.id, effectivePermissions(x)])))}>Discard</button>
              <span className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">{changes.length === 0 ? 'No unsaved changes' : `${changes.reduce((n, c) => n + c.diff.length, 0)} unsaved change(s) in ${changes.length} role(s)`}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">The admin role is fixed. Record-level access in the database follows the role name; the saved permission list is what this workspace has configured for it.</p>

          <h3 className="mb-2 mt-8 text-sm font-semibold text-gray-900 dark:text-white">Members</h3>
          <div className={`${CARD} overflow-x-auto !p-0`}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" aria-label="Members">
              <thead><tr><th className={TH}>Member</th><th className={TH}>Roles</th>{canEdit && <th className={TH}>Add role</th>}</tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {members.length === 0 && <tr><td className={TD} colSpan={3}>No members found.</td></tr>}
                {members.map(m => (
                  <tr key={m.user_id} data-testid="member-row">
                    <td className={TD}>{m.name}</td>
                    <td className={TD}><div className="flex flex-wrap gap-1">{m.role_ids.map(id => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{roleName(id)}
                        {canEdit && <button type="button" aria-label={`Remove ${roleName(id)} from ${m.name}`} onClick={() => void unassign(m, id)}><X className="h-3 w-3" /></button>}</span>))}
                      {m.role_ids.length === 0 && <span className="text-xs text-gray-500">No role</span>}</div></td>
                    {canEdit && <td className={TD}>
                      <select aria-label={`Add role for ${m.name}`} value="" onChange={e => void assign(m.user_id, e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                        <option value="">Add role...</option>{roles.filter(r => !m.role_ids.includes(r.id)).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export default RolesSettings;
