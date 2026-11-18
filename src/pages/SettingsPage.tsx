import React, { Suspense } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { SETTINGS_TABS, isTabKey, tabAccess, visibleTabs, type SettingsTabKey } from '../components/settings/settingsTabs';
import DealToasts from '../components/deals/DealToasts';
import { ReadOnlyNotice } from '../components/settings/settingsUi';

const DataModelSettings = React.lazy(() => import('../components/settings/DataModelSettings'));
const ApiKeysSettings = React.lazy(() => import('../components/settings/ApiKeysSettings'));
const WebhooksSettings = React.lazy(() => import('../components/settings/WebhooksSettings'));
const RolesSettings = React.lazy(() => import('../components/settings/RolesSettings'));
const EmailTemplatesSettings = React.lazy(() => import('../components/settings/EmailTemplatesSettings'));
const GeneralSettings = React.lazy(() => import('../components/settings/GeneralSettings'));

const NoAccess: React.FC = () => (
  <ReadOnlyNotice>Your role does not have access to this section. Ask an admin if you need it.</ReadOnlyNotice>
);

/** Settings hub at /settings/*: left tabs with sub-routes, gated by role (usePermissions). */
const SettingsPage: React.FC = () => {
  const { role, isLoading } = usePermissions();
  const { pathname } = useLocation();
  const active = pathname.replace(/^\/settings\/?/, '').split('/')[0];
  const tabs = visibleTabs(role);

  const guard = (key: SettingsTabKey, render: (access: 'read' | 'edit') => React.ReactNode) => {
    const access = tabAccess(key, role);
    if (isLoading) return <p role="status" className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>;
    return access === 'none' ? <NoAccess /> : render(access);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">Settings</h1>
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Settings sections" className="md:w-56 md:flex-shrink-0">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {tabs.map(t => (
              <li key={t.key}>
                <NavLink
                  to={`/settings/${t.key}`}
                  title={t.description}
                  className={({ isActive }) => `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1">
          <Suspense fallback={<p role="status" className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>}>
            <Routes>
              <Route index element={<Navigate to={`/settings/${SETTINGS_TABS[0].key}`} replace />} />
              <Route path="data-model" element={guard('data-model', () => <DataModelSettings />)} />
              <Route path="api-keys" element={guard('api-keys', a => <ApiKeysSettings canEdit={a === 'edit'} />)} />
              <Route path="webhooks" element={guard('webhooks', a => <WebhooksSettings canEdit={a === 'edit'} />)} />
              <Route path="roles" element={guard('roles', a => <RolesSettings canEdit={a === 'edit'} />)} />
              <Route path="email-templates" element={guard('email-templates', a => <EmailTemplatesSettings canEdit={a === 'edit'} />)} />
              <Route path="general" element={guard('general', () => <GeneralSettings />)} />
              <Route path="*" element={<Navigate to={isTabKey(active) ? `/settings/${active}` : `/settings/${SETTINGS_TABS[0].key}`} replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
      {active !== 'data-model' && <DealToasts />}
    </div>
  );
};

export default SettingsPage;
