/** Event that asks the app shell to open the global Settings modal (the top app bar is hidden on the Pipeline page). */
export const OPEN_SETTINGS_EVENT = 'app-settings:open';

export const openSettings = (): void => {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
};
