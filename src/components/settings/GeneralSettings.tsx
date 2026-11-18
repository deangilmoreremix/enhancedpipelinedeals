import React from 'react';
import { Settings } from 'lucide-react';
import { BTN_PRIMARY } from '../ui/buttonStyles';
import { openSettings } from '../settingsEvents';
import { CARD, SectionHeader } from './settingsUi';

/** App preferences live in the existing settings modal; this tab links to it. */
export const GeneralSettings: React.FC = () => (
  <section aria-label="General settings">
    <SectionHeader title="General" description="Appearance, notifications, AI and integration preferences." />
    <div className={CARD}>
      <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">General preferences (theme, notifications, AI, data source, permissions mode) are in the app settings dialog.</p>
      <button type="button" className={BTN_PRIMARY} onClick={openSettings}><Settings className="h-4 w-4" />Open app settings</button>
    </div>
  </section>
);

export default GeneralSettings;
