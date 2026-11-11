import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import type { PermissionAction, EntityKind, PermissionRecord } from '../../services/permissionService';

interface PermissionGateProps {
  action: PermissionAction;
  kind: EntityKind;
  record?: PermissionRecord | null;
  /** Several records (bulk): all must be allowed. Takes precedence over `record`. */
  records?: Array<PermissionRecord | null | undefined>;
  /** 'hide' renders nothing, 'disable' renders children inert with a tooltip, or pass a node to render instead. */
  fallback?: 'hide' | 'disable' | React.ReactNode;
  children: React.ReactNode;
}

/** Renders children only (or enabled) when the current user may perform the action. */
export const PermissionGate: React.FC<PermissionGateProps> = ({ action, kind, record, records, fallback = 'hide', children }) => {
  const perms = usePermissions();
  const result = records ? perms.canAll(action, kind, records) : perms.can(action, kind, record);
  if (result.allowed) return <>{children}</>;
  if (fallback === 'hide') return null;
  if (fallback === 'disable') {
    return (
      <span
        title={result.reason}
        aria-disabled="true"
        data-testid="permission-disabled"
        className="inline-flex opacity-50 cursor-not-allowed [&>*]:pointer-events-none"
      >
        {children}
      </span>
    );
  }
  return <>{fallback}</>;
};

export default PermissionGate;
