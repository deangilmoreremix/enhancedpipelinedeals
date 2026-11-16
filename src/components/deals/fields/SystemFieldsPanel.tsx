import React, { useState } from 'react';
import { Check, Copy, Lock } from 'lucide-react';
import type { Deal } from '../../../types';
import { usePermissions } from '../../../hooks/usePermissions';
import { pushToast } from '../../../store/dealRecordStore';

export interface SystemFieldsPanelProps {
  deal: Deal & { source?: string };
}

const fmt = (d?: Date | string | null) => {
  if (!d) return '-';
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

/** Read-only system fields: id, created by/at, updated at, workspace, source. */
export const SystemFieldsPanel: React.FC<SystemFieldsPanelProps> = ({ deal }) => {
  const perms = usePermissions();
  const [copied, setCopied] = useState(false);

  const createdBy = deal.createdBy
    ? deal.createdBy === perms.userId ? 'You' : deal.createdBy
    : '-';
  const workspace = deal.workspaceId
    ? (deal.workspaceId === perms.workspaceId && perms.workspaceName ? perms.workspaceName : deal.workspaceId)
    : (perms.workspaceName ?? '-');
  const source = deal.source ?? (deal.id.startsWith('deal-') || !/^[0-9a-f-]{36}$/i.test(deal.id) ? 'Local / demo' : 'CRM');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(deal.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      pushToast('error', 'Could not copy the deal id');
    }
  };

  const rows: Array<[string, React.ReactNode]> = [
    ['Created by', createdBy],
    ['Created', fmt(deal.createdAt)],
    ['Updated', fmt(deal.updatedAt)],
    ['Workspace', workspace],
    ['Source', source],
  ];

  return (
    <section aria-label="System fields" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h4 className="mb-4 flex items-center text-lg font-semibold text-gray-900 dark:text-white">
        <Lock className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-400" />System fields
      </h4>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Deal ID</dt>
          <dd className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
            <code className="truncate rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">{deal.id}</code>
            <button type="button" onClick={() => void copy()} aria-label="Copy deal ID" className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </dd>
        </div>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{k}</dt>
            <dd className="truncate text-sm text-gray-900 dark:text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default SystemFieldsPanel;
