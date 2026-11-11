import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Deal } from '../../types';
import { useDealStore } from '../../store/dealStore';
import { formatMoney } from '../../utils/currencyMicros';
import { stageChip } from '../deals/fields/stageColors';
import { pushToast } from '../../store/dealRecordStore';

/** Deals with value + stage chips, each linking to /deals/:id. */
export const RelatedDealsList: React.FC<{ deals: Deal[]; emptyText?: string }> = ({ deals, emptyText = 'No deals yet.' }) => {
  const stages = useDealStore(s => s.stages);
  if (deals.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>;
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {deals.map(d => {
        const stage = stages.find(s => s.key === d.stage);
        const chip = stageChip(stage?.color);
        return (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2">
            <Link to={`/deals/${d.id}`} className="min-w-0 truncate text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
              {d.title ?? d.company}
            </Link>
            <div className="flex flex-shrink-0 items-center gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-200">{formatMoney(d.value, d.currencyCode ?? 'USD')}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                <span className={`h-2 w-2 rounded-full ${chip.className}`} style={chip.style} aria-hidden />
                {stage?.name ?? d.stage}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

/** "Add deal" button: creates a deal in the first stage preset with the given contact/company, then opens it. */
export const AddDealButton: React.FC<{ preset: Partial<Deal> & { company: string; contact: string } }> = ({ preset }) => {
  const stages = useDealStore(s => s.stages);
  const createDeal = useDealStore(s => s.createDeal);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const first = stages.filter(s => s.visible)[0] ?? stages[0];

  const add = async () => {
    if (!first) return;
    setBusy(true);
    try {
      const deal = await createDeal({
        title: preset.company ? `${preset.company} deal` : 'New deal',
        value: 0, stage: first.key, probability: first.probability ?? 0, priority: 'medium',
        ...preset,
      });
      navigate(`/deals/${deal.id}`);
    } catch (e) {
      pushToast('error', `Could not create deal: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={() => void add()} disabled={busy || !first}
      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
      <Plus className="h-4 w-4" aria-hidden />Add deal
    </button>
  );
};

export const SectionCard: React.FC<{ title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, actions, children }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      {actions}
    </div>
    {children}
  </section>
);
