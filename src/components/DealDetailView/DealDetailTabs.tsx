import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, SlidersHorizontal } from 'lucide-react';
import { DealDetailTabsProps } from './types';
import { useDealViewPrefs } from '../../store/dealViewPrefsStore';
import { BTN, BTN_ICON } from '../ui/buttonStyles';
import { LOCKED_TAB, MAX_SHORTCUT_TABS, orderedTabs, shortcutFor, visibleTabs } from './tabConfig';

const digitFrom = (e: KeyboardEvent): number | null => {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code ?? '') ?? /^([1-9])$/.exec(e.key ?? '');
  return m ? Number(m[1]) : null;
};

export const DealDetailTabs: React.FC<DealDetailTabsProps> = ({ activeTab, onTabChange, compact = false }) => {
  const { prefs, setTabOrder, setHiddenTabs } = useDealViewPrefs();
  const tabs = visibleTabs(prefs);
  const [customizing, setCustomizing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  // Alt + 1..9 switches to the first nine visible tabs (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (!e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
      const n = digitFrom(e);
      const tab = n ? tabsRef.current[n - 1] : undefined;
      if (tab) {
        e.preventDefault();
        onTabChangeRef.current(tab.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!customizing) return;
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setCustomizing(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setCustomizing(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc, true);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc, true); };
  }, [customizing]);

  const all = orderedTabs(prefs.tabOrder);
  const move = (id: string, delta: -1 | 1) => {
    const ids = all.map(t => t.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void setTabOrder(ids);
  };
  const toggle = (id: string) => {
    if (id === LOCKED_TAB) return;
    const hidden = prefs.hiddenTabs.includes(id);
    void setHiddenTabs(hidden ? prefs.hiddenTabs.filter(x => x !== id) : [...prefs.hiddenTabs, id]);
  };
  const isDefault = prefs.tabOrder.length === 0 && prefs.hiddenTabs.length === 0;
  const shortcutCount = Math.min(MAX_SHORTCUT_TABS, tabs.length);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
      <div className="flex items-center justify-between gap-2 px-5 py-3">
        <nav aria-label="Deal sections" className="flex min-w-0 flex-1 space-x-1 overflow-x-auto">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const shortcut = shortcutFor(index);
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                onClick={() => onTabChange(tab.id)}
                title={shortcut ? `${tab.label} (Alt+${shortcut})` : tab.label}
                className={`
                  relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3/4 h-0.5 bg-blue-500 rounded-t-full"></span>
                )}
                {shortcut && (
                  <span className="hidden xl:inline-block text-xs opacity-60 ml-1">{shortcut}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-3">
          <div
            className={`${compact ? 'hidden' : 'hidden lg:flex'} items-center space-x-2 text-xs text-gray-500 dark:text-gray-400`}
            title={tabs.length > MAX_SHORTCUT_TABS ? 'Tabs after the ninth have no shortcut' : undefined}
          >
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">Alt</kbd>
            <span>+</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">{shortcutCount > 1 ? `1-${shortcutCount}` : '1'}</kbd>
            <span className="ml-2">to switch tabs</span>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Customize tabs"
              aria-haspopup="dialog"
              aria-expanded={customizing}
              title="Customize tabs"
              onClick={() => setCustomizing(c => !c)}
              className={BTN_ICON}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {customizing && (
              <div role="dialog" aria-label="Customize tabs" className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <p className="px-2 pb-1 text-xs text-gray-500 dark:text-gray-400">Show, hide and reorder tabs. Saved for your account.</p>
                <ul className="max-h-80 overflow-y-auto">
                  {all.map((t, i) => (
                    <li key={t.id} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                        <input
                          type="checkbox"
                          aria-label={`Show ${t.label} tab`}
                          checked={t.id === LOCKED_TAB || !prefs.hiddenTabs.includes(t.id)}
                          disabled={t.id === LOCKED_TAB}
                          onChange={() => toggle(t.id)}
                        />
                        {t.label}
                      </label>
                      <button type="button" aria-label={`Move ${t.label} up`} disabled={i === 0} onClick={() => move(t.id, -1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-600">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" aria-label={`Move ${t.label} down`} disabled={i === all.length - 1} onClick={() => move(t.id, 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-600">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-end border-t border-gray-100 pt-2 dark:border-gray-700">
                  <button
                    type="button"
                    disabled={isDefault}
                    onClick={() => { void setTabOrder([]); void setHiddenTabs([]); }}
                    className={BTN}
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
