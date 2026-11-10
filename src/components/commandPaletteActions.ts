import type { BoardActionRequest } from '../store/boardViewStore';

/** Everything an action may need; supplied by the palette so actions stay plain functions. */
export interface PaletteActionContext {
  navigate: (to: string) => void;
  toggleDarkMode: () => void;
  /** Ask the pipeline board to do something once it is mounted (e.g. open the new deal dialog). */
  requestBoardAction: (action: BoardActionRequest) => void;
  clearFilters: () => void;
}

export interface PaletteAction {
  id: string;
  label: string;
  /** Extra words that should match the action when searching. */
  keywords: string[];
  hint?: string;
  run: (ctx: PaletteActionContext) => void;
}

const goto = (id: string, label: string, to: string, keywords: string[] = []): PaletteAction => ({
  id,
  label,
  keywords: ['go', 'open', 'navigate', ...keywords],
  hint: to === '/' ? 'Page' : 'Page',
  run: ctx => ctx.navigate(to)
});

const onBoard = (id: string, label: string, action: BoardActionRequest, keywords: string[]): PaletteAction => ({
  id,
  label,
  keywords,
  hint: 'Action',
  run: ctx => {
    ctx.navigate('/');
    ctx.requestBoardAction(action);
  }
});

/** Action registry: plain data + functions, no framework state. */
export const PALETTE_ACTIONS: PaletteAction[] = [
  onBoard('new-deal', 'New deal', 'new-deal', ['create', 'add']),
  onBoard('import-deals', 'Import deals from CSV / Excel', 'import', ['upload', 'csv', 'xlsx']),
  onBoard('export-deals', 'Export deals', 'export', ['download', 'csv', 'xlsx', 'json']),
  onBoard('show-deleted', 'Show deleted deals', 'show-deleted', ['trash', 'restore', 'recycle']),
  onBoard('find-duplicates', 'Find duplicate deals', 'find-duplicates', ['merge', 'dedupe', 'duplicates']),
  {
    id: 'clear-filters',
    label: 'Clear filters',
    keywords: ['reset', 'filter', 'search', 'remove'],
    hint: 'Action',
    run: ctx => ctx.clearFilters()
  },
  {
    id: 'toggle-dark-mode',
    label: 'Toggle dark mode',
    keywords: ['theme', 'light', 'appearance'],
    hint: 'Action',
    run: ctx => ctx.toggleDarkMode()
  },
  goto('go-pipeline', 'Go to Pipeline', '/', ['deals', 'board', 'kanban']),
  goto('go-contacts', 'Go to Contacts', '/contacts', ['people']),
  goto('go-agents', 'Go to Agents', '/agents', ['ai', 'sdr']),
  goto('go-calendar', 'Go to Calendar', '/calendar', ['events', 'meetings']),
  goto('go-email', 'Go to Email', '/email', ['inbox', 'mail']),
  goto('go-views', 'Go to Views', '/views', ['saved', 'reports']),
  goto('go-workflows', 'Go to Workflows', '/workflows', ['automation']),
  goto('go-analytics', 'Go to Analytics', '/analytics', ['charts', 'reports', 'forecast']),
  goto('go-apps', 'Go to Apps', '/apps', ['integrations'])
];

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').trim();

/** Actions matching every word of `query` in the label or keywords (all actions when empty). */
export function filterActions(query: string, actions: PaletteAction[] = PALETTE_ACTIONS): PaletteAction[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return actions;
  return actions.filter(a => {
    const haystack = norm(`${a.label} ${a.keywords.join(' ')}`);
    return words.every(w => haystack.includes(w));
  });
}
