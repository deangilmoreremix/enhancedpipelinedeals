import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Company } from '../../types';
import type { Contact } from '../../types/contact';
import type { DealFieldDefinition } from '../../types/customFields';
import { useDealStore } from '../../store/dealStore';
import { useContactStore } from '../../store/contactStore';
import { useUserDirectoryStore } from '../../store/userDirectoryStore';
import { listAllTasks, seedDemoTasks, tasksRemote, DealTask } from '../../services/dealTasksService';
import { search as searchCompanies } from '../../services/companyService';
import { listFieldDefinitions } from '../../services/customFieldService';
import { errorMessage } from '../../services/dealRecordShared';
import { DEMO_ME } from '../tasks/useTasksData';
import type { WidgetObject } from './widgetModel';
import type { WidgetSources } from './widgetData';

export interface DashboardSources {
  sources: WidgetSources;
  defs: DealFieldDefinition[];
  /** Per-object load error (a widget on that object shows an error state with retry). */
  errors: Partial<Record<WidgetObject, string>>;
  loading: boolean;
  reload: () => void;
}

/** Everything widgets compute from: deals/stages from the deal store, tasks, contacts, companies and custom field definitions. */
export function useDashboardSources(): DashboardSources {
  const dealsMap = useDealStore(s => s.deals);
  const stages = useDealStore(s => s.stages);
  const fetchDeals = useDealStore(s => s.fetchDeals);
  const contacts = useContactStore(s => s.contacts);
  const fetchContacts = useContactStore(s => s.fetchContacts);
  const contactError = useContactStore(s => s.error);
  const users = useUserDirectoryStore(s => s.users);
  const loadUsers = useUserDirectoryStore(s => s.load);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [defs, setDefs] = useState<DealFieldDefinition[]>([]);
  const [errors, setErrors] = useState<DashboardSources['errors']>({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const dealCount = Object.keys(dealsMap).length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const errs: DashboardSources['errors'] = {};
    void (async () => {
      void loadUsers();
      if (Object.keys(useDealStore.getState().deals).length === 0) await fetchDeals().catch(e => { errs.deals = errorMessage(e); });
      await fetchContacts().catch(e => { errs.contacts = errorMessage(e); });
      try {
        if (!tasksRemote()) seedDemoTasks(Object.values(useDealStore.getState().deals), DEMO_ME.id, useUserDirectoryStore.getState().users.map(u => u.id));
        const t = await listAllTasks();
        if (!cancelled) setTasks(t);
      } catch (e) { errs.tasks = errorMessage(e, 'Failed to load tasks'); }
      try { const c = await searchCompanies('', 1000); if (!cancelled) setCompanies(c); } catch (e) { errs.companies = errorMessage(e); }
      const all = await Promise.all((['deal', 'contact', 'company'] as const).map(et => listFieldDefinitions(et).catch(() => [] as DealFieldDefinition[])));
      if (!cancelled) { setDefs(all.flat()); setErrors(errs); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick, loadUsers, fetchDeals, fetchContacts]);

  const userName = useCallback((id: string) => users.find(u => u.id === id)?.name ?? (id === DEMO_ME.id ? DEMO_ME.name : undefined), [users]);
  const deals = useMemo(() => Object.values(dealsMap), [dealsMap]);
  const sources: WidgetSources = useMemo(
    () => ({ deals, tasks, contacts: contacts as Contact[], companies, stages, userName }),
    [deals, tasks, contacts, companies, stages, userName],
  );
  const merged = useMemo(() => (contactError && !errors.contacts ? { ...errors, contacts: contactError } : errors), [errors, contactError]);
  void dealCount;
  return { sources, defs, errors: merged, loading, reload: () => setTick(t => t + 1) };
}
