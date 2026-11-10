/** Event used by the global Ctrl/Cmd+K shortcut (useKeyboardShortcuts) to open/toggle the command palette. */
export const OPEN_COMMAND_PALETTE_EVENT = 'command-palette:open';

export const openCommandPalette = (): void => {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
};
