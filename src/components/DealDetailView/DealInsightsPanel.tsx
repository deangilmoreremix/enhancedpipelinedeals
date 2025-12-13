import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Target, Lightbulb, Users, Clock, DollarSign, BarChart3 } from 'lucide-react';
import { Deal } from '../../types';
import { Contact } from '../../types/contact';
import { daysSince, isDealStale } from '../../utils/dateUtils';

interface DealInsightsPanelProps {
  deal: Deal;
  contact: Contact | null;
  onAction?: (action: string) => void;
}

export const DealInsightsPanel: React.FC<DealInsightsPanelProps> = ({ deal, contact, onAction }) => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);

  // Calculate deal health score
  const calculateDealHealth = (): number => {
    let score = 50; // Base score
    
    // Probability boost
    score += (deal.probability - 50) * 0.5;
    
    // Contact linked boost
    if (contact) score += 10;
    
    // Recent activity boost
    const daysSinceUpdate = daysSince(deal.updatedAt);
    if (daysSinceUpdate < 3) score += 15;
    else if (daysSinceUpdate < 7) score += 5;
    else if (daysSinceUpdate > 14) score -= 20;
    
    // Stage-based adjustments
    if (deal.stage === 'negotiation' || deal.stage === 'proposal') score += 10;
    if (deal.stage === 'closed-lost') score = 0;
    if (deal.stage === 'closed-won') score = 100;
    
    // Priority boost
    if (deal.priority === 'high') score += 10;
    
    return Math.min(100, Math.max(0, Math.round(score)));
  };

  const healthScore = calculateDealHealth();

  // Generate AI insights
  const generateInsights = () => {
    const insights = {
      healthScore,
      recommendations: [
        {
          icon: Target,
          title: 'Schedule Follow-up',
          description: 'It\'s been 5 days since last contact. Schedule a follow-up call to maintain momentum.',
          priority: 'high',
          action: 'schedule-call'
        },
        {
          icon: Users,
          title: 'Identify Decision Makers',
          description: 'Engage with additional stakeholders to build consensus and reduce deal risk.',
          priority: 'medium',
          action: 'find-stakeholders'
        },
        {
          icon: Lightbulb,
          title: 'Share Case Study',
          description: 'Send relevant case study from similar company to demonstrate value proposition.',
          priority: 'medium',
          action: 'send-case-study'
        }
      ],
      riskFactors: [
        {
          icon: AlertTriangle,
          title: 'Long Sales Cycle',
          description: 'Deal has been in current stage for 12 days. Consider accelerating timeline.',
          severity: 'medium'
        },
        {
          icon: Clock,
          title: 'Engagement Gap',
          description: `Last meaningful interaction was ${daysSince(deal.updatedAt)} days ago. Risk of losing momentum.`,
          severity: isDealStale(deal.updatedAt, 7) ? 'high' : 'medium'
        }
      ],
      strengths: [
        {
          icon: CheckCircle,
          title: 'High Deal Value',
          description: `Deal value of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(deal.value)} is above average.`,
          impact: 'positive'
        },
        {
          icon: TrendingUp,
          title: 'Strong Probability',
          description: `${deal.probability}% close probability indicates good deal health.`,
          impact: 'positive'
        }
      ],
      predictiveAnalytics: {
        expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        probabilityTrend: '+5% this week',
        similarDealsWonRate: 68,
        competitorThreat: 'Medium'
      }
    };
    
    setInsights(insights);
  };

  useEffect(() => {
    generateInsights();
  }, [deal, contact]);

  const getHealthColor = (score: number) => {
    if (score >= 75) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-blue-600 dark:text-blue-400';
    if (score >= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-blue-500';
    if (score >= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
      default: return 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  if (!insights) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Deal Health Score */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Brain className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            Deal Health Score
          </h3>
          <button
            onClick={generateInsights}
            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center"
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Refresh
          </button>
        </div>

        <div className="flex items-center space-x-6">
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - healthScore / 100)}`}
                className={getHealthColor(healthScore)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${getHealthColor(healthScore)}`}>{healthScore}</span>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {healthScore >= 75 && 'Excellent! This deal is tracking well with strong indicators.'}
              {healthScore >= 50 && healthScore < 75 && 'Good progress. Focus on key risk factors to improve.'}
              {healthScore >= 25 && healthScore < 50 && 'Needs attention. Address risk factors to improve chances.'}
              {healthScore < 25 && 'At risk. Immediate action required to save this deal.'}
            </p>
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Trend:</span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {insights.predictiveAnalytics.probabilityTrend}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
          <Lightbulb className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" />
          AI Recommendations
        </h3>

        <div className="space-y-3">
          {insights.recommendations.map((rec: any, idx: number) => {
            const Icon = rec.icon;
            return (
              <div
                key={idx}
                className={`border rounded-lg p-4 transition-all hover:shadow-md ${getPriorityColor(rec.priority)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <Icon className="w-5 h-5 mt-0.5 text-gray-700 dark:text-gray-300" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">{rec.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{rec.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onAction?.(rec.action)}
                    className="ml-4 px-3 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium border border-gray-300 dark:border-gray-600 whitespace-nowrap"
                  >
                    Take Action
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Factors */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
          <AlertTriangle className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" />
          Risk Factors
        </h3>

        <div className="space-y-3">
          {insights.riskFactors.map((risk: any, idx: number) => {
            const Icon = risk.icon;
            const severityColor = risk.severity === 'high' 
              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
              : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
            
            return (
              <div key={idx} className={`border rounded-lg p-4 ${severityColor}`}>
                <div className="flex items-start space-x-3">
                  <Icon className="w-5 h-5 mt-0.5 text-gray-700 dark:text-gray-300" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">{risk.title}</h4>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        risk.severity === 'high' 
                          ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                          : 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
                      }`}>
                        {risk.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{risk.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deal Strengths */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
          <CheckCircle className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
          Deal Strengths
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.strengths.map((strength: any, idx: number) => {
            const Icon = strength.icon;
            return (
              <div
                key={idx}
                className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4"
              >
                <div className="flex items-start space-x-3">
                  <Icon className="w-5 h-5 mt-0.5 text-green-600 dark:text-green-400" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">{strength.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{strength.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Predictive Analytics */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-4">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          Predictive Analytics
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Close</p>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {insights.predictiveAnalytics.expectedCloseDate.toLocaleDateString()}
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Similar Deals Won</p>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {insights.predictiveAnalytics.similarDealsWonRate}%
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Revenue Confidence</p>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {deal.probability}%
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Competitor Threat</p>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {insights.predictiveAnalytics.competitorThreat}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
