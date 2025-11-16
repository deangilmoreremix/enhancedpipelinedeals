import React, { useMemo, useState } from 'react';
import { Deal } from '../types';
import {
  ChevronLeft, ChevronRight, DollarSign, Calendar as CalendarIcon,
  Star, Sparkles, TrendingUp
} from 'lucide-react';

interface DealCalendarViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

export const DealCalendarView: React.FC<DealCalendarViewProps> = ({
  deals,
  onDealClick,
  searchTerm,
  filterStage
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const filteredDeals = useMemo(() => {
    let result = Object.values(deals);

    if (searchTerm.trim()) {
      result = result.filter(deal =>
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStage !== 'all') {
      result = result.filter(deal => deal.stage === filterStage);
    }

    return result;
  }, [deals, searchTerm, filterStage]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const getDealsByDate = (date: Date) => {
    return filteredDeals.filter(deal => {
      const dealDate = new Date(deal.updatedAt);
      return (
        dealDate.getDate() === date.getDate() &&
        dealDate.getMonth() === date.getMonth() &&
        dealDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'qualification': 'border-l-blue-500',
      'proposal': 'border-l-indigo-500',
      'negotiation': 'border-l-amber-500',
      'closed-won': 'border-l-green-500',
      'closed-lost': 'border-l-red-500'
    };
    return colors[stage] || 'border-l-gray-500';
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const calendarDays: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  }

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {monthName}
          </h2>
          <button
            onClick={today}
            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
          {weekDays.map((day) => (
            <div
              key={day}
              className="bg-gray-50 dark:bg-gray-900 px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
          {calendarDays.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className="bg-gray-50 dark:bg-gray-900 min-h-[120px] p-2"
                />
              );
            }

            const dayDeals = getDealsByDate(date);
            const totalValue = dayDeals.reduce((sum, deal) => sum + deal.value, 0);
            const isCurrentDay = isToday(date);

            return (
              <div
                key={date.toISOString()}
                className={`bg-white dark:bg-gray-800 min-h-[120px] p-2 ${
                  isCurrentDay ? 'ring-2 ring-blue-500 ring-inset' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${
                    isCurrentDay
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {date.getDate()}
                  </span>
                  {dayDeals.length > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      {dayDeals.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayDeals.slice(0, 3).map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => onDealClick(deal.id)}
                      className={`text-xs p-1.5 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded border-l-2 ${getStageColor(deal.stage)} cursor-pointer transition-colors`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {deal.title}
                          </p>
                          <p className="text-gray-600 dark:text-gray-400 truncate">
                            {deal.company}
                          </p>
                        </div>
                        {deal.isFavorite && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0 ml-1" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {formatCurrency(deal.value)}
                        </span>
                        {deal.aiScore && deal.aiScore > 0 && (
                          <div className="flex items-center space-x-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                            <span className="text-purple-700 dark:text-purple-300 font-medium">
                              {deal.aiScore}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {dayDeals.length > 3 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 text-center py-1">
                      +{dayDeals.length - 3} more
                    </div>
                  )}
                </div>

                {totalValue > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Total:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(totalValue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Deals This Month</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredDeals.filter(deal => {
                  const dealDate = new Date(deal.updatedAt);
                  return (
                    dealDate.getMonth() === currentDate.getMonth() &&
                    dealDate.getFullYear() === currentDate.getFullYear()
                  );
                }).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(
                  filteredDeals
                    .filter(deal => {
                      const dealDate = new Date(deal.updatedAt);
                      return (
                        dealDate.getMonth() === currentDate.getMonth() &&
                        dealDate.getFullYear() === currentDate.getFullYear()
                      );
                    })
                    .reduce((sum, deal) => sum + deal.value, 0)
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Probability</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {(() => {
                  const monthDeals = filteredDeals.filter(deal => {
                    const dealDate = new Date(deal.updatedAt);
                    return (
                      dealDate.getMonth() === currentDate.getMonth() &&
                      dealDate.getFullYear() === currentDate.getFullYear()
                    );
                  });
                  const avg = monthDeals.length > 0
                    ? monthDeals.reduce((sum, deal) => sum + deal.probability, 0) / monthDeals.length
                    : 0;
                  return Math.round(avg);
                })()}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
