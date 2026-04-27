import React from 'react';
import { HealthFactor } from '../../types';
import { Heart, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, DollarSign, Users } from 'lucide-react';

interface DealHealthIndicatorProps {
  healthScore: number;
  healthFactors: HealthFactor[];
  isLoading?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

const DealHealthIndicator: React.FC<DealHealthIndicatorProps> = ({
  healthScore,
  healthFactors,
  isLoading = false,
  onRefresh,
  compact = false
}) => {
  const getHealthColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-5 h-5" />;
    if (score >= 60) return <TrendingUp className="w-5 h-5" />;
    if (score >= 40) return <AlertTriangle className="w-5 h-5" />;
    return <TrendingDown className="w-5 h-5" />;
  };

  const getCategoryIcon = (category: HealthFactor['category']) => {
    switch (category) {
      case 'activity': return <Clock className="w-4 h-4" />;
      case 'engagement': return <Users className="w-4 h-4" />;
      case 'progress': return <TrendingUp className="w-4 h-4" />;
      case 'timeline': return <Clock className="w-4 h-4" />;
      case 'value': return <DollarSign className="w-4 h-4" />;
      default: return <Heart className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full border ${getHealthColor(healthScore)}`}>
        {getHealthIcon(healthScore)}
        <span className="ml-1 font-medium text-sm">{healthScore}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Heart className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Deal Health</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Health Score */}
      <div className="flex items-center mb-4">
        <div className={`flex items-center px-4 py-2 rounded-lg border ${getHealthColor(healthScore)}`}>
          {getHealthIcon(healthScore)}
          <span className="ml-2 font-bold text-lg">{healthScore}/100</span>
        </div>
        <div className="ml-3">
          <div className="text-sm text-gray-600">
            {healthScore >= 80 && 'Excellent health - Deal is performing well'}
            {healthScore >= 60 && healthScore < 80 && 'Good health - Some areas need attention'}
            {healthScore >= 40 && healthScore < 60 && 'Fair health - Requires monitoring'}
            {healthScore < 40 && 'Poor health - Immediate action needed'}
          </div>
        </div>
      </div>

      {/* Health Factors */}
      {healthFactors.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Health Factors</h4>
          <div className="space-y-2">
            {healthFactors.map((factor) => (
              <div key={factor.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(factor.category)}
                  <span className="text-sm font-medium text-gray-900">{factor.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${factor.score >= 70 ? 'text-green-600' : factor.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {factor.score}/100
                  </span>
                  {factor.isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="bg-blue-50 p-3 rounded">
          <div className="font-medium text-blue-900">Activity</div>
          <div className="text-blue-700">
            {healthFactors.filter(f => f.category === 'activity').length} factors
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <div className="font-medium text-green-900">Progress</div>
          <div className="text-green-700">
            {healthFactors.filter(f => f.category === 'progress').length} factors
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealHealthIndicator;