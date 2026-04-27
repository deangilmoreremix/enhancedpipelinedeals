import React from 'react';
import { ProbabilityFactor } from '../../types';
import { Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';

interface WinProbabilityCalculatorProps {
  winProbability: number;
  probabilityFactors: ProbabilityFactor[];
  isLoading?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

const WinProbabilityCalculator: React.FC<WinProbabilityCalculatorProps> = ({
  winProbability,
  probabilityFactors,
  isLoading = false,
  onRefresh,
  compact = false
}) => {
  const getProbabilityColor = (probability: number): string => {
    if (probability >= 75) return 'text-green-600 bg-green-50 border-green-200';
    if (probability >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (probability >= 25) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getProbabilityIcon = (probability: number) => {
    if (probability >= 75) return <CheckCircle className="w-5 h-5" />;
    if (probability >= 50) return <TrendingUp className="w-5 h-5" />;
    if (probability >= 25) return <AlertCircle className="w-5 h-5" />;
    return <TrendingDown className="w-5 h-5" />;
  };

  const getCategoryIcon = (category: ProbabilityFactor['category']) => {
    switch (category) {
      case 'historical': return <BarChart3 className="w-4 h-4" />;
      case 'engagement': return <Target className="w-4 h-4" />;
      case 'competition': return <AlertCircle className="w-4 h-4" />;
      case 'market': return <TrendingUp className="w-4 h-4" />;
      case 'internal': return <CheckCircle className="w-4 h-4" />;
      default: return <Target className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-40"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full border ${getProbabilityColor(winProbability)}`}>
        {getProbabilityIcon(winProbability)}
        <span className="ml-1 font-medium text-sm">{winProbability}%</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Win Probability</h3>
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

      {/* Win Probability Score */}
      <div className="flex items-center mb-4">
        <div className={`flex items-center px-4 py-2 rounded-lg border ${getProbabilityColor(winProbability)}`}>
          {getProbabilityIcon(winProbability)}
          <span className="ml-2 font-bold text-lg">{winProbability}%</span>
        </div>
        <div className="ml-3">
          <div className="text-sm text-gray-600">
            {winProbability >= 75 && 'High probability - Deal likely to close'}
            {winProbability >= 50 && winProbability < 75 && 'Medium probability - Good chance with effort'}
            {winProbability >= 25 && winProbability < 50 && 'Low probability - Significant challenges'}
            {winProbability < 25 && 'Very low probability - Major obstacles present'}
          </div>
        </div>
      </div>

      {/* Probability Factors */}
      {probabilityFactors.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Probability Factors</h4>
          <div className="space-y-2">
            {probabilityFactors.map((factor) => (
              <div key={factor.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(factor.category)}
                  <span className="text-sm font-medium text-gray-900">{factor.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${
                    factor.impact > 10 ? 'text-green-600' :
                    factor.impact > 0 ? 'text-blue-600' :
                    factor.impact > -10 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {factor.impact > 0 ? '+' : ''}{factor.impact}%
                  </span>
                  <span className="text-xs text-gray-500">({factor.confidence}% confidence)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Probability Breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="bg-green-50 p-3 rounded">
          <div className="font-medium text-green-900">Positive Factors</div>
          <div className="text-green-700">
            {probabilityFactors.filter(f => f.impact > 0).length} factors
          </div>
        </div>
        <div className="bg-red-50 p-3 rounded">
          <div className="font-medium text-red-900">Negative Factors</div>
          <div className="text-red-700">
            {probabilityFactors.filter(f => f.impact < 0).length} factors
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinProbabilityCalculator;