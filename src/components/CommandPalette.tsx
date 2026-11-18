import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ChevronLeft, CornerDownLeft, Crosshair, Search, User, Zap } from 'lucide-react';
import type { Deal } from '../types';
import { useContactStore } from '../store/contactStore';
import { useBoardViewStore } from '../store/boardViewStore';
import { pushToast } from '../store/dealRecordStore';
import { usePermissions } from '../hooks/usePermissions';
import { toastFailure } from '../utils/permissionToast';
import { useTheme } from '../contexts/ThemeContext';
import { isDemoMode } from '../config/demoMode';
import { OPEN_COMMAND_PALETTE_EVENT, openCommandPalette } from './commandPaletteEvents';
import { PALETTE_ACTIONS, PaletteAction, filterActions } from './commandPaletteActions';
import { dealIdFromPath, dispatchDealRecordAction, useCommandContext } from './commandPaletteContext';
import { DEAL_ACTIONS, DealActionDef } from './commandPaletteDealActions';
import { useDealRecordData } from './commandPaletteDealData';

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong');
const loadDealStore = async () => (await import('../store/dealStore')).useDealStore;

export { OPEN_COMMAND_PALETTE_EVENT, openCommandPalette };
export { setCommandContext, DEAL_RECORD_ACTION_EVENT, onDealRecordAction } from './commandPaletteContext';
export type { DealRecordActionDetail, DealRecordActionName } from './commandPaletteContext';

type Section = 'This deal' | 'Change stage' | 'Confirm' | 'Deals' | 'Contacts' | 'Actions';
type Mode = 'root' | 'stage' | 'confirm-delete';

interface PaletteItem {
  id: string;
  section: Section;
  label: string;
  detail?: string;
  run: () => void;
  /** Switches to a second step instead of running (the palette stays open). */
  next?: Mode;
}

const SECTION_ICON: Record<Section, React.ReactNode> = {
  'This deal': <Crosshair className="w-4 h-4" aria-hidden="true" />,
  'Change stage': <Crosshair className="w-4 h-4" aria-hidden="true" />,
  Confirm: <Crosshair className="w-4 h-4" aria-hidden="true" />,
  Deals: <Briefcase className="w-4 h-4" aria-hidden="true" />,
  Contacts: <User className="w-4 h-4" aria-hidden="true" />,
  Actions: <Zap className="w-4 h-4" aria-hidden="true" />
};

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/**
 * Global command palette (Ctrl/Cmd+K): deals (search), contacts, actions.
 * Pure React: ARIA combobox + listbox, arrow/enter/escape navigation, focus trapped in the dialog.
 */
export const CommandPalette: React.FC<{ /** Mount already open (used when lazily mounted by the first shortcut press). */ defaultOpen?: boolean }> = ({ defaultOpen = false }) => {
  const navigate = useNavigate();
  const { toggleDarkMode } = useTheme();
  const contacts = useContactStore(s => s.contacts);
  const requestBoardAction = useBoardViewStore(s => s.requestAction);
  const clearFilters = useBoardViewStore(s => s.clearFilters);

  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [dealHits, setDealHits] = useState<Deal[]>([]);
  const [semanticIds, setSemanticIds] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Mode>('root');
  const [pathDealId, setPathDealId] = useState<string | null>(() => (typeof window === 'undefined' ? null : dealIdFromPath(window.location.pathname)));
  const ctxDealId = useCommandContext().dealId;
  const dealId = ctxDealId ?? pathDealId;
  const { deal, stages } = useDealRecordData(dealId);
  const perms = usePermissions();
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(defaultOpen && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setDebounced('');
    setDealHits([]);
    setSemanticIds([]);
    setActive(0);
    setMode('root');
    const el = returnFocusRef.current;
    if (el && typeof el.focus === 'function') window.setTimeout(() => el.focus(), 0);
  }, []);

  // Open via the global shortcut event
  useEffect(() => {
    const onOpen = () => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPathDealId(dealIdFromPath(window.location.pathname));
      setMode('root');
      setOpen(o => !o);
    };
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Debounce what we send to the search backends
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(t);
  }, [query]);

  // Deals
  useEffect(() => {
    if (!open || !debounced) { setDealHits([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { searchDeals } = await import('../services/dealSearchService');
        const rows = await searchDeals(debounced, 6);
        if (!cancelled) setDealHits(rows.slice(0, 6));
      } catch {
        if (!cancelled) setDealHits([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, debounced]);

  // Contacts: semantic search when the gateway is available (never in demo mode)
  useEffect(() => {
    if (!open || debounced.length < 3 || isDemoMode()) { setSemanticIds([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { searchContacts } = await import('../services/semanticSearchService');
        const matches = await searchContacts(debounced, 5);
        if (!cancelled) setSemanticIds(matches.map(m => m.contact_id));
      } catch {
        if (!cancelled) setSemanticIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, debounced]);

  const runDealAction = useCallback(async (def: DealActionDef, id: string) => {
    try {
      const dealStore = await loadDealStore();
      const d = dealStore.getState().deals[id];
      switch (def.id) {
        case 'toggle-favorite': {
          const { toggleFavorite } = await import('../services/favoritesService');
          const now = await toggleFavorite('deal', id);
          pushToast('success', now ? 'Added to favorites' : 'Removed from favorites');
          break;
        }
        case 'toggle-pin': {
          const { useDealViewPrefsStore } = await import('../store/dealViewPrefsStore');
          const prefs = useDealViewPrefsStore.getState();
          await prefs.getPrefs();
          if (prefs.isPinned(id)) { await prefs.unpin(id); pushToast('success', 'Deal unpinned'); }
          else { await prefs.pin(id); pushToast('success', 'Deal pinned'); }
          break;
        }
        case 'duplicate': {
          if (!d) return;
          const newId = await dealStore.getState().cloneDeal(id, { includeRelated: true });
          pushToast('success', 'Deal duplicated');
          navigate(`/deals/${newId}`);
          break;
        }
        case 'open-contact':
          navigate(d?.contactId ? `/contacts/${d.contactId}` : '/contacts');
          break;
        case 'open-company':
          navigate(d?.companyId ? `/companies/${d.companyId}` : '/contacts');
          break;
        case 'copy-link': {
          const url = `${window.location.origin}/deals/${id}`;
          if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
          else throw new Error('Clipboard is not available');
          pushToast('success', 'Link copied');
          break;
        }
        default:
          if (def.event) dispatchDealRecordAction(def.event, id);
      }
    } catch (e) {
      toastFailure(e, 'edit', 'deal', `${def.label.replace(/…$/, '')} failed: ${errorMessage(e)}`);
    }
  }, [navigate]);

  const changeStage = useCallback(async (id: string, stageKey: string, stageName: string) => {
    try {
      const store = await loadDealStore();
      const moved = await store.getState().bulkMoveDeals([id], stageKey);
      if (moved.length > 0) pushToast('success', `Moved to ${stageName}`);
      else if (!store.getState().error) pushToast('error', 'Could not change stage');
    } catch (e) {
      toastFailure(e, 'move', 'deal', `Could not change stage: ${errorMessage(e)}`);
    }
  }, []);

  const deleteDeal = useCallback(async (id: string) => {
    try {
      await (await loadDealStore()).getState().softDeleteDeal(id);
      pushToast('success', 'Deal deleted');
      if (dealIdFromPath(window.location.pathname) === id) navigate('/');
    } catch (e) {
      toastFailure(e, 'delete', 'deal', `Could not delete deal: ${errorMessage(e)}`);
    }
  }, [navigate]);

  const dealLabel = deal ? (deal.title || deal.company || 'this deal') : 'this deal';

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteItem[] = [];

    // Second steps replace the whole list
    if (dealId && mode === 'stage') {
      const words = q.split(/\s+/).filter(Boolean);
      stages.filter(st => st.visible !== false)
        .filter(st => words.every(w => st.name.toLowerCase().includes(w) || st.key.toLowerCase().includes(w)))
        .forEach(st => list.push({
          id: `stage-${st.key}`,
          section: 'Change stage',
          label: st.name,
          detail: deal?.stage === st.key ? 'Current stage' : undefined,
          run: () => { if (deal?.stage !== st.key) void changeStage(dealId, st.key, st.name); }
        }));
      return list;
    }
    if (dealId && mode === 'confirm-delete') {
      list.push({ id: 'confirm-delete', section: 'Confirm', label: `Delete "${dealLabel}"`, detail: 'Moves the deal to the trash (can be restored)', run: () => { void deleteDeal(dealId); } });
      list.push({ id: 'cancel-delete', section: 'Confirm', label: 'Cancel', run: () => { /* no-op */ } });
      return list;
    }

    if (dealId) {
      const visible = DEAL_ACTIONS.filter(def => {
        if (def.permission && !perms.allowed(def.permission, 'deal', deal ?? null)) return false;
        if (def.id === 'open-contact' && deal && !deal.contactId && !deal.contact) return false;
        if (def.id === 'open-company' && deal && !deal.companyId && !deal.company) return false;
        return true;
      });
      const asActions: PaletteAction[] = visible.map(def => ({ id: def.id, label: def.label, keywords: def.keywords, run: () => undefined }));
      const matched = new Set(filterActions(query, asActions).map(a => a.id));
      visible.filter(def => matched.has(def.id)).forEach(def => list.push({
        id: `deal-action-${def.id}`,
        section: 'This deal',
        label: def.label,
        detail: dealLabel === 'this deal' ? undefined : dealLabel,
        next: def.step,
        run: () => { void runDealAction(def, dealId); }
      }));
    }

    dealHits.forEach(d => list.push({
      id: `deal-${d.id}`,
      section: 'Deals',
      label: d.title || d.company || 'Untitled deal',
      detail: [d.company && d.title ? d.company : '', d.contact, money(d.value)].filter(Boolean).join(' · '),
      run: () => navigate(`/deals/${d.id}`)
    }));

    if (q) {
      const local = contacts.filter(c =>
        [c.name, c.company, c.email, c.title].some(f => (f ?? '').toLowerCase().includes(q))
      );
      const byId = new Map(contacts.map(c => [c.id, c]));
      const semantic = semanticIds.map(id => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
      const seen = new Set<string>();
      [...local, ...semantic].forEach(c => {
        if (seen.has(c.id) || seen.size >= 5) return;
        seen.add(c.id);
        list.push({
          id: `contact-${c.id}`,
          section: 'Contacts',
          label: c.name || c.email,
          detail: [c.title, c.company].filter(Boolean).join(' at '),
          run: () => navigate('/contacts')
        });
      });
    }

    const ctx = { navigate, toggleDarkMode, requestBoardAction, clearFilters };
    filterActions(query, PALETTE_ACTIONS).forEach((a: PaletteAction) => list.push({
      id: `action-${a.id}`,
      section: 'Actions',
      label: a.label,
      detail: a.hint,
      run: () => a.run(ctx)
    }));
    return list;
  }, [query, dealHits, contacts, semanticIds, navigate, toggleDarkMode, requestBoardAction, clearFilters,
    dealId, mode, stages, deal, dealLabel, perms, runDealAction, changeStage, deleteDeal]);

  // Keep the highlighted row in range as results change
  useEffect(() => { setActive(a => (items.length === 0 ? 0 : Math.min(a, items.length - 1))); }, [items.length]);

  const optionId = (i: number) => `${baseId}-opt-${i}`;
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return;
    if (item.next) {
      setMode(item.next);
      setQuery('');
      setDebounced('');
      setActive(0);
      return;
    }
    close();
    item.run();
  };

  const backToRoot = () => { setMode('root'); setQuery(''); setDebounced(''); setActive(0); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (items.length) setActive(a => (a + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (items.length) setActive(a => (a - 1 + items.length) % items.length);
        break;
      case 'Home':
        if (items.length) { e.preventDefault(); setActive(0); }
        break;
      case 'End':
        if (items.length) { e.preventDefault(); setActive(items.length - 1); }
        break;
      case 'Enter':
        e.preventDefault();
        choose(items[active]);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (mode !== 'root') backToRoot(); else close();
        break;
      case 'Backspace':
        if (mode !== 'root' && query === '') { e.preventDefault(); backToRoot(); }
        break;
      case 'Tab':
        // focus trap: the input is the only tab stop in the dialog
        e.preventDefault();
        inputRef.current?.focus();
        break;
      default:
    }
  };

  if (!open) return null;

  const sections: Section[] = ['This deal', 'Change stage', 'Confirm', 'Deals', 'Contacts', 'Actions'];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[15vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          {mode !== 'root' ? (
            <button type="button" tabIndex={-1} aria-label="Back" onClick={backToRoot} className="mr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <Search className="w-4 h-4 text-gray-400 mr-3" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items.length > 0 ? optionId(active) : undefined}
            aria-label="Search deals, contacts and actions"
            placeholder={mode === 'stage' ? 'Choose a stage...' : mode === 'confirm-delete' ? 'Confirm deletion...' : 'Search deals, contacts, or type a command...'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            className="flex-1 py-3 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
          />
          <kbd className="text-[11px] text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div id={listId} role="listbox" aria-label="Results" className="max-h-96 overflow-y-auto py-1">
          {items.length === 0 && (
            <p className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400" role="status">No results</p>
          )}
          {sections.map(section => {
            const sectionItems = items.map((item, index) => ({ item, index })).filter(x => x.item.section === section);
            if (sectionItems.length === 0) return null;
            return (
              <div key={section} role="group" aria-label={section}>
                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400" aria-hidden="true">{section}</p>
                {sectionItems.map(({ item, index }) => (
                  <div
                    key={item.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => { if (active !== index) setActive(index); }}
                    onClick={() => choose(item)}
                    className={`mx-1 px-3 py-2 rounded-lg flex items-center space-x-3 cursor-pointer text-sm ${
                      index === active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200' : 'text-gray-800 dark:text-gray-100'
                    }`}
                  >
                    <span className="text-gray-400">{SECTION_ICON[section]}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{item.label}</span>
                      {item.detail && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{item.detail}</span>}
                    </span>
                    {index === active && <CornerDownLeft className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
