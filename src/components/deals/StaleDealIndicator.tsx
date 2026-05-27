import React from 'react';
import { Deal } from '../../types';
import { Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface StaleDealIndicatorProps {
  deal: Deal;
  daysThreshold?: number;
  onStaleAlert?: (dealId: string) => void;
}

const StaleDealIndicator: React.FC<StaleDealIndicatorProps> = ({
  deal,
  daysThreshold = 30,
  onStaleAlert
}) => {
  const getTimeInStage = (): number => {
    const stageDates: Record<string, Date> = {
      qualification: deal.createdAt,
      proposal: deal.updatedAt,
      negotiation: deal.updatedAt
    };

    const relevantDate = stageDates[deal.stage] || deal.updatedAt || deal.createdAt;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - relevantDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const timeInStage = getTimeInStage();
  const isStale = timeInStage > daysThreshold;

  const getStaleWarningLevel = (days: number): 'warning' | 'danger' | null => {
    if (days > 45) return 'danger';
    if (days > 30) return 'warning';
    return null;
  };

  const warningLevel = getStaleWarningLevel(timeInStage);

  if (!isStale) return null;

  const handleAlertClick = () => {
    onStaleAlert?.(deal.id);
  };

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
      warningLevel === 'danger'
        ? 'bg-red-100 text-red-700 border border-red-200'
        : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    }`}>
      <Clock className="w-3.5 h-3.5 mr-1" />
      <span>Stale {timeInStage} days</span>
      {warningLevel === 'danger' && (
        <AlertCircle
          className="w-3.5 h-3.5 ml-1 cursor-pointer hover:text-red-900"
          onClick={handleAlertClick}
        />
      )}
    </div>
  );
};

export default StaleDealIndicator;