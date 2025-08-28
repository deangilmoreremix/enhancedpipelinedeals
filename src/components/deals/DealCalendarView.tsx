import React, { useState, useMemo } from 'react';
import { Deal } from '../../types';
import { Calendar, ChevronLeft, ChevronRight, Target, DollarSign } from 'lucide-react';

interface DealCalendarViewProps {
  deals: Record<string, Deal>;
  onDealClick: (dealId: string) => void;
  onDealUpdate: (id: string, updates: Partial<Deal>) => void;
  searchTerm: string;
  filterStage: string;
}

export const DealCalendarView: React.FC<DealCalendarViewProps> = ({
  deals,
  onDealClick,
  onDealUpdate,
  searchTerm,
  filterStage
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'month' | 'week'>('month');

  // Filter deals
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

  // Get deals for current month/week
  const dealsForPeriod = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    return filteredDeals.filter(deal => {
      if (!deal.dueDate) return false;
      const dueDate = new Date(deal.dueDate);
      return dueDate >= startOfMonth && dueDate <= endOfMonth;
    });
  }, [filteredDeals, currentDate]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startOfCalendar = new Date(startOfMonth);
    const endOfCalendar = new Date(endOfMonth);

    // Start from the first Sunday before the month starts
    startOfCalendar.setDate(startOfCalendar.getDate() - startOfCalendar.getDay());
    
    // End on the last Saturday after the month ends
    endOfCalendar.setDate(endOfCalendar.getDate() + (6 - endOfCalendar.getDay()));

    const days = [];
    const current = new Date(startOfCalendar);

    while (current <= endOfCalendar) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  const getDealsForDate = (date: Date) => {
    return dealsForPeriod.filter(deal => {
      if (!deal.dueDate) return false;
      const dueDate = new Date(deal.dueDate);
      return dueDate.toDateString() === date.toDateString();
    });
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
      'qualification': 'bg-blue-500',
      'proposal': 'bg-indigo-500',
      'negotiation': 'bg-purple-500',
      'closed-won': 'bg-green-500',
      'closed-lost': 'bg-red-500'
    };
    return colors[stage] || 'bg-gray-500';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth('next')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {dealsForPeriod.length} deal{dealsForPeriod.length !== 1 ? 's' : ''} this month
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
          {calendarDays.map((date, index) => {
            const dayDeals = getDealsForDate(date);
            const isCurrentMonthDay = isCurrentMonth(date);
            const isTodayDate = isToday(date);

            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border-b border-gray-200 dark:border-gray-700 ${
                  !isCurrentMonthDay ? 'bg-gray-50 dark:bg-gray-900' : ''
                } ${isTodayDate ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
              >
                <div className={`text-sm font-medium mb-2 ${
                  !isCurrentMonthDay 
                    ? 'text-gray-400 dark:text-gray-600' 
                    : isTodayDate 
                    ? 'text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {date.getDate()}
                </div>
                
                <div className="space-y-1">
                  {dayDeals.slice(0, 2).map((deal) => (
                    <div
                      key={deal.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDealClick(deal.id);
                      }}
                      className={`p-1 rounded text-xs text-white cursor-pointer hover:opacity-80 transition-opacity ${getStageColor(deal.stage)}`}
                    >
                      <div className="font-medium truncate">{deal.title}</div>
                      <div className="truncate">{formatCurrency(deal.value)}</div>
                    </div>
                  ))}
                  
                  {dayDeals.length > 2 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 p-1">
                      +{dayDeals.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Due This Month</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{dealsForPeriod.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(dealsForPeriod.reduce((sum, deal) => sum + deal.value, 0))}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Probability</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {dealsForPeriod.length > 0 
                  ? Math.round(dealsForPeriod.reduce((sum, deal) => sum + deal.probability, 0) / dealsForPeriod.length)
                  : 0
                }%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};