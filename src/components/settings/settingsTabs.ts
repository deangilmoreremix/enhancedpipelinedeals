import type { RoleName } from '../../services/permissionService';

export type SettingsTabKey = 'data-model' | 'api-keys' | 'webhooks' | 'roles' | 'email-templates' | 'general';
/** none = hidden / no access, read = visible but view-only, edit = full access. */
export type TabAccess = 'none' | 'read' | 'edit';

export interface SettingsTab { key: SettingsTabKey; label: string; description: string }

export const SETTINGS_TABS: readonly SettingsTab[] = [
  { key: 'data-model', label: 'Data model', description: 'Custom fields and field definitions' },
  { key: 'api-keys', label: 'API keys', description: 'Keys for the public REST API' },
  { key: 'webhooks', label: 'Webhooks', description: 'Outbound webhooks and inbound workflow triggers' },
  { key: 'roles', label: 'Roles & permissions', description: 'Who can do what' },
  { key: 'email-templates', label: 'Email templates', description: 'Templates and snippets with variables' },
  { key: 'general', label: 'General', description: 'App preferences' },
];

/**
 * Access per tab for a role. The server enforces the same limits (api-keys function: admin/manager, role RPCs: admin);
 * this only decides what the UI shows. Demo mode and signed-out users are 'admin' (see usePermissions).
 */
export function tabAccess(tab: SettingsTabKey, role: RoleName): TabAccess {
  const privileged = role === 'admin' || role === 'manager';
  switch (tab) {
    case 'data-model': return 'edit'; // the Data model tab applies its own manage permissions
    case 'api-keys': return privileged ? 'edit' : 'none';
    case 'webhooks': return privileged ? 'edit' : 'none';
    case 'roles': return role === 'admin' ? 'edit' : 'read';
    case 'email-templates': return role === 'viewer' ? 'read' : 'edit';
    case 'general': return 'edit';
  }
}

export const visibleTabs = (role: RoleName): SettingsTab[] => SETTINGS_TABS.filter(t => tabAccess(t.key, role) !== 'none');

export const isTabKey = (v: string | undefined): v is SettingsTabKey => SETTINGS_TABS.some(t => t.key === v);
