import React from 'react';
import { Deal } from '../../types';
import DealAnalytics from '../DealAnalytics';

interface DealDashboardViewProps {
  deals: Record<string, Deal>;
  contacts?: any[];
}

export const DealDashboardView: React.FC<DealDashboardViewProps> = ({ 
  deals, 
  contacts = [] 
}) => {
  return (
    <div>
      <DealAnalytics deals={deals} contacts={contacts} />
    </div>
  );
};