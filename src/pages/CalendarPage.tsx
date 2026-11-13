import React, { useState } from 'react';
import { TwentyCalendar } from '../components/calendar/TwentyCalendar';
import { DealCalendarIntegration } from '../components/calendar/DealCalendarIntegration';
import { PageContainer, PageHeader } from './PageHeader';
import { useCurrentUserId, useDeals } from './hooks';

const CalendarPage: React.FC = () => {
  const userId = useCurrentUserId();
  const { deals } = useDeals();
  const [dealId, setDealId] = useState('');
  const dealList = Object.values(deals);

  return (
    <PageContainer>
      <PageHeader title="Calendar" subtitle="Meetings, deadlines and deal events" />
      {!userId ? (
        <p className="text-gray-600 dark:text-gray-400">Sign in to view your calendar.</p>
      ) : (
        <div className="space-y-8">
          <TwentyCalendar userId={userId} dealId={dealId || undefined} />
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-lg font-semibold">Deal calendar</h3>
              <select
                aria-label="Select deal"
                value={dealId}
                onChange={e => setDealId(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">All deals</option>
                {dealList.map(d => (
                  <option key={d.id} value={d.id}>{d.title || d.company}</option>
                ))}
              </select>
            </div>
            {dealId ? (
              <DealCalendarIntegration dealId={dealId} userId={userId} />
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">Select a deal to see its meetings and deadlines.</p>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  );
};

export default CalendarPage;
