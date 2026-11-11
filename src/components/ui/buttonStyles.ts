/**
 * Single source of truth for pipeline / deal-view button chrome.
 * Every toolbar and record-header action uses the same height (h-9), radius, border, type scale and hover state;
 * icon-only buttons are the same h-9 square. Icons inside are always w-4 h-4.
 */
const BASE =
  'inline-flex items-center justify-center gap-2 h-9 text-sm font-medium rounded-lg border whitespace-nowrap transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const NEUTRAL =
  'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700';

const PRIMARY = 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700';
const DANGER = 'border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700';

/** Standard text(+icon) button. */
export const BTN = `${BASE} px-3 ${NEUTRAL}`;
/** Standard icon-only button (h-9 w-9). */
export const BTN_ICON = `${BASE} w-9 ${NEUTRAL}`;
/** Primary call-to-action (same size). */
export const BTN_PRIMARY = `${BASE} px-3 ${PRIMARY}`;
/** Confirm-destructive (same size). */
export const BTN_DANGER = `${BASE} px-3 ${DANGER}`;
/** Standard height for selects / inputs that sit in the same toolbar rows. */
export const CONTROL = 'h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white';
