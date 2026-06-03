import { CustomMetric, MetricValue, Deal } from '../types';
import { getSupabaseService } from './supabaseService';

/**
 * Custom Metrics Service
 * Handles calculation and management of custom KPIs and metrics
 */
export class CustomMetricsService {
  /**
   * Calculate a custom metric based on its formula
   */
  static async calculateMetric(
    metric: CustomMetric,
    deals: Deal[],
    filters?: any[]
  ): Promise<number> {
    try {
      switch (metric.category) {
        case 'sales':
          return this.calculateSalesMetric(metric, deals, filters);
        case 'performance':
          return this.calculatePerformanceMetric(metric, deals, filters);
        case 'efficiency':
          return this.calculateEfficiencyMetric(metric, deals, filters);
        case 'quality':
          return this.calculateQualityMetric(metric, deals, filters);
        default:
          return this.calculateCustomFormula(metric, deals, filters);
      }
    } catch (error) {
      console.error('Error calculating metric:', error);
      return 0;
    }
  }

  /**
   * Calculate sales-related metrics
   */
  private static calculateSalesMetric(
    metric: CustomMetric,
    deals: Deal[],
    filters?: any[]
  ): number {
    const filteredDeals = this.applyFilters(deals, filters);

    switch (metric.formula.toLowerCase()) {
      case 'total_pipeline_value':
        return filteredDeals.reduce((sum, deal) => sum + deal.value, 0);

      case 'weighted_pipeline_value':
        return filteredDeals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0);

      case 'average_deal_size':
        return filteredDeals.length > 0
          ? filteredDeals.reduce((sum, deal) => sum + deal.value, 0) / filteredDeals.length
          : 0;

      case 'conversion_rate':
        const total = filteredDeals.length;
        const won = filteredDeals.filter(d => d.stage === 'closed-won').length;
        return total > 0 ? (won / total) * 100 : 0;

      case 'sales_velocity':
        // Deals closed per month
        const closedDeals = filteredDeals.filter(d => d.stage === 'closed-won');
        const now = new Date();
        const months = closedDeals.length > 0 ? 1 : 0; // Simplified - should calculate actual time span
        return months > 0 ? closedDeals.length / months : 0;

      case 'win_rate':
        const qualified = filteredDeals.filter(d => ['proposal', 'negotiation', 'closed-won', 'closed-lost'].includes(d.stage));
        const wonDealsCount = qualified.filter(d => d.stage === 'closed-won').length;
        return qualified.length > 0 ? (wonDealsCount / qualified.length) * 100 : 0;

      default:
        return this.evaluateFormula(metric.formula, filteredDeals);
    }
  }

  /**
   * Calculate performance-related metrics
   */
  private static calculatePerformanceMetric(
    metric: CustomMetric,
    deals: Deal[],
    filters?: any[]
  ): number {
    const filteredDeals = this.applyFilters(deals, filters);

    switch (metric.formula.toLowerCase()) {
      case 'deals_created_this_month':
        const thisMonth = new Date();
        thisMonth.setDate(1);
        return filteredDeals.filter(deal =>
          new Date(deal.createdAt) >= thisMonth
        ).length;

      case 'deals_closed_this_month':
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return filteredDeals.filter(deal =>
          ['closed-won', 'closed-lost'].includes(deal.stage) &&
          new Date(deal.updatedAt) >= startOfMonth
        ).length;

      case 'average_time_to_close':
        const closedDeals = filteredDeals.filter(d => d.stage === 'closed-won');
        if (closedDeals.length === 0) return 0;

        const totalDays = closedDeals.reduce((sum, deal) => {
          const created = new Date(deal.createdAt);
          const closed = new Date(deal.updatedAt);
          return sum + (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);

        return totalDays / closedDeals.length;

      case 'pipeline_growth_rate':
        // Simplified - compare current vs previous period
        const currentPeriod = filteredDeals.length;
        // This would need historical data to calculate properly
        return currentPeriod; // Placeholder

      default:
        return this.evaluateFormula(metric.formula, filteredDeals);
    }
  }

  /**
   * Calculate efficiency-related metrics
   */
  private static calculateEfficiencyMetric(
    metric: CustomMetric,
    deals: Deal[],
    filters?: any[]
  ): number {
    const filteredDeals = this.applyFilters(deals, filters);

    switch (metric.formula.toLowerCase()) {
      case 'deals_per_rep':
        // This would need user/team data
        return filteredDeals.length; // Placeholder

      case 'activity_per_deal':
        // This would need activity data
        return filteredDeals.length > 0 ? 5 : 0; // Placeholder average

      case 'response_time':
        // This would need communication data
        return 24; // Placeholder in hours

      default:
        return this.evaluateFormula(metric.formula, filteredDeals);
    }
  }

  /**
   * Calculate quality-related metrics
   */
  private static calculateQualityMetric(
    metric: CustomMetric,
    deals: Deal[],
    filters?: any[]
  ): number {
    const filteredDeals = this.applyFilters(deals, filters);

    switch (metric.formula.toLowerCase()) {
      case 'data_completeness':
        const totalFields = filteredDeals.length * 10; // Assume 10 key fields
        let filledFields = 0;
        filteredDeals.forEach(deal => {
          if (deal.title) filledFields++;
          if (deal.company) filledFields++;
          if (deal.contact) filledFields++;
          if (deal.value > 0) filledFields++;
          if (deal.stage) filledFields++;
          if (deal.probability > 0) filledFields++;
          // Add more fields as needed
        });
        return totalFields > 0 ? (filledFields / totalFields) * 100 : 0;

      case 'deal_health_score':
        return filteredDeals.length > 0
          ? filteredDeals.reduce((sum, deal) => sum + (deal.healthScore || 0), 0) / filteredDeals.length
          : 0;

      case 'forecast_accuracy':
        // This would need historical forecast vs actual data
        return 85; // Placeholder

      default:
        return this.evaluateFormula(metric.formula, filteredDeals);
    }
  }

  /**
   * Calculate custom formula metrics
   */
  private static calculateCustomFormula(
    metric: CustomMetric,
    deals: Deal[],
    filters?: any[]
  ): number {
    return this.evaluateFormula(metric.formula, deals);
  }

  /**
   * Evaluate a custom formula expression
   */
  private static evaluateFormula(formula: string, deals: Deal[]): number {
    try {
      // Simple formula evaluation - in production, use a proper expression parser
      const variables: Record<string, number> = {
        total_deals: deals.length,
        total_value: deals.reduce((sum, d) => sum + d.value, 0),
        avg_deal_size: deals.length > 0 ? deals.reduce((sum, d) => sum + d.value, 0) / deals.length : 0,
        won_deals: deals.filter(d => d.stage === 'closed-won').length,
        lost_deals: deals.filter(d => d.stage === 'closed-lost').length,
        active_deals: deals.filter(d => !['closed-won', 'closed-lost'].includes(d.stage)).length,
        avg_probability: deals.length > 0 ? deals.reduce((sum, d) => sum + d.probability, 0) / deals.length : 0
      };

      // Replace variables in formula
      let expression = formula;
      Object.entries(variables).forEach(([key, value]) => {
        expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), value.toString());
      });

      // Simple arithmetic evaluation (very basic - use a proper math parser in production)
      return this.evaluateArithmetic(expression);
    } catch (error) {
      console.error('Error evaluating formula:', error);
      return 0;
    }
  }

  /**
   * Simple arithmetic expression evaluator
   */
  private static evaluateArithmetic(expression: string): number {
    try {
      // Remove any unsafe characters and evaluate
      const safeExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
      // Use Function constructor for evaluation (in production, use a proper parser)
      return new Function('return ' + safeExpression)();
    } catch {
      return 0;
    }
  }

  /**
   * Apply filters to deals
   */
  private static applyFilters(deals: Deal[], filters?: any[]): Deal[] {
    if (!filters || filters.length === 0) return deals;

    return deals.filter(deal => {
      return filters.every(filter => {
        const value = (deal as any)[filter.field];
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greater_than':
            return Number(value) > Number(filter.value);
          case 'less_than':
            return Number(value) < Number(filter.value);
          default:
            return true;
        }
      });
    });
  }

  /**
   * Get metric trend over time
   */
  static async getMetricTrend(
    metricId: string,
    period: 'day' | 'week' | 'month',
    days: number = 30
  ): Promise<MetricValue[]> {
    try {
      const supabase = getSupabaseService();
      // This would query metric_values table
      // For now, return mock data
      const trend: MetricValue[] = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        trend.push({
          metricId,
          value: Math.random() * 100, // Mock value
          timestamp: date,
          period
        });
      }

      return trend;
    } catch (error) {
      console.error('Error fetching metric trend:', error);
      return [];
    }
  }

  /**
   * Calculate multiple metrics at once for efficiency
   */
  static async calculateMetricsBatch(
    metrics: CustomMetric[],
    deals: Deal[],
    filters?: any[]
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    for (const metric of metrics) {
      results[metric.id] = await this.calculateMetric(metric, deals, filters);
    }

    return results;
  }

  /**
   * Validate a custom metric formula
   */
  static validateFormula(formula: string): { isValid: boolean; error?: string } {
    try {
      // Check for basic syntax
      if (!formula || formula.trim().length === 0) {
        return { isValid: false, error: 'Formula cannot be empty' };
      }

      // Check for balanced parentheses
      const openParens = (formula.match(/\(/g) || []).length;
      const closeParens = (formula.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return { isValid: false, error: 'Unbalanced parentheses' };
      }

      // Check for valid characters (allow comparison operators)
      const validChars = /^[0-9+\-*/().\s\w><=]+$/;
      if (!validChars.test(formula)) {
        return { isValid: false, error: 'Invalid characters in formula' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid formula syntax' };
    }
  }
}

// Export convenience functions
export const calculateMetric = CustomMetricsService.calculateMetric;
export const calculateMetricsBatch = CustomMetricsService.calculateMetricsBatch;
export const getMetricTrend = CustomMetricsService.getMetricTrend;
export const validateFormula = CustomMetricsService.validateFormula;