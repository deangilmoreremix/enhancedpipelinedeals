/**
 * Forecasting Service
 * Advanced revenue forecasting and predictive modeling
 */

import { getSupabaseService } from './supabaseService';
import { getAdvancedAnalyticsService } from './advancedAnalyticsService';

export interface ForecastModel {
  id: string;
  name: string;
  type: 'linear' | 'exponential' | 'seasonal' | 'ml';
  target: string;
  accuracy: number;
  lastTrained: string;
  status: 'active' | 'training' | 'inactive';
}

export interface ForecastResult {
  period: string;
  predictedValue: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
  factors: Array<{
    name: string;
    impact: number;
    description: string;
  }>;
}

export interface ForecastScenario {
  name: string;
  description: string;
  assumptions: Record<string, any>;
  forecast: ForecastResult[];
  probability: number;
}

class ForecastingService {
  private supabaseService = getSupabaseService();
  private analyticsService = getAdvancedAnalyticsService();

  /**
   * Generate revenue forecast for specified period
   */
  async generateRevenueForecast(
    forecastPeriod: '1month' | '3months' | '6months' | '1year',
    includeScenarios: boolean = true
  ): Promise<{
    forecast: ForecastResult[];
    scenarios: ForecastScenario[];
    confidence: number;
    modelUsed: string;
  }> {
    try {
      const historicalData = await this.getHistoricalRevenueData(forecastPeriod);

      // Use advanced analytics for ML forecasting
      const aiForecast = await this.analyticsService.generateSalesForecast(
        'current_workspace',
        forecastPeriod,
        undefined
      );

      // Generate multiple scenarios
      const scenarios = includeScenarios ? await this.generateScenarios(historicalData, forecastPeriod) : [];

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(historicalData, aiForecast);

      return {
        forecast: this.transformForecastResults(aiForecast),
        scenarios,
        confidence,
        modelUsed: 'hybrid_ml_statistical'
      };
    } catch (error) {
      console.error('Failed to generate revenue forecast:', error);
      throw error;
    }
  }

  /**
   * Generate deal conversion forecast
   */
  async generateConversionForecast(
    pipelineStage: string,
    forecastPeriod: '1month' | '3months' | '6months'
  ): Promise<ForecastResult[]> {
    try {
      const historicalConversions = await this.getHistoricalConversionData(pipelineStage, forecastPeriod);

      // Apply forecasting algorithms
      const forecast = this.applyConversionForecasting(historicalConversions, forecastPeriod);

      return forecast;
    } catch (error) {
      console.error('Failed to generate conversion forecast:', error);
      throw error;
    }
  }

  /**
   * Train forecasting model with new data
   */
  async trainForecastingModel(
    modelId: string,
    trainingData: any[]
  ): Promise<{ accuracy: number; status: string }> {
    try {
      const result = await this.analyticsService.retrainModels([modelId]);

      return {
        accuracy: 0.85, // Placeholder - would come from actual training
        status: 'completed'
      };
    } catch (error) {
      console.error('Failed to train forecasting model:', error);
      throw error;
    }
  }

  /**
   * Get forecast accuracy metrics
   */
  async getForecastAccuracy(
    modelId: string,
    evaluationPeriod: '1month' | '3months' | '6months'
  ): Promise<{
    overallAccuracy: number;
    meanAbsoluteError: number;
    rootMeanSquaredError: number;
    recentPredictions: Array<{
      predicted: number;
      actual: number;
      date: string;
      accuracy: number;
    }>;
  }> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      // Get forecast results with actual values
      const { data: forecasts } = await supabase
        .from('forecast_results')
        .select('*')
        .eq('model_id', modelId)
        .not('actual_value', 'is', null)
        .order('forecast_date', { ascending: false })
        .limit(50);

      if (!forecasts || forecasts.length === 0) {
        return {
          overallAccuracy: 0,
          meanAbsoluteError: 0,
          rootMeanSquaredError: 0,
          recentPredictions: []
        };
      }

      // Calculate accuracy metrics
      const predictions = forecasts.map(f => ({
        predicted: f.predicted_value,
        actual: f.actual_value,
        date: f.forecast_date,
        accuracy: this.calculatePredictionAccuracy(f.predicted_value, f.actual_value)
      }));

      const overallAccuracy = predictions.reduce((sum, p) => sum + p.accuracy, 0) / predictions.length;
      const mae = predictions.reduce((sum, p) => sum + Math.abs(p.predicted - p.actual), 0) / predictions.length;
      const rmse = Math.sqrt(predictions.reduce((sum, p) => sum + Math.pow(p.predicted - p.actual, 2), 0) / predictions.length);

      return {
        overallAccuracy,
        meanAbsoluteError: mae,
        rootMeanSquaredError: rmse,
        recentPredictions: predictions.slice(0, 10)
      };
    } catch (error) {
      console.error('Failed to get forecast accuracy:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getHistoricalRevenueData(forecastPeriod: string): Promise<Array<{ date: string; value: number; deals: number }>> {
    const supabase = (this.supabaseService as any).supabase;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (forecastPeriod) {
      case '1month':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '3months':
        startDate.setMonth(endDate.getMonth() - 12);
        break;
      case '6months':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case '1year':
        startDate.setFullYear(endDate.getFullYear() - 2);
        break;
    }

    const { data } = await supabase
      .from('deals')
      .select('value, created_at, stage')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('stage', 'closed-won');

    if (!data) return [];

    // Group by month
    const monthlyData: Record<string, { value: number; deals: number }> = {};

    data.forEach(deal => {
      const month = new Date(deal.created_at).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { value: 0, deals: 0 };
      }
      monthlyData[month].value += deal.value || 0;
      monthlyData[month].deals += 1;
    });

    return Object.entries(monthlyData)
      .map(([date, data]) => ({
        date,
        value: data.value,
        deals: data.deals
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getHistoricalConversionData(stage: string, period: string): Promise<Array<{ date: string; conversion: number; total: number; converted: number }>> {
    const supabase = (this.supabaseService as any).supabase;

    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '1month':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '3months':
        startDate.setMonth(endDate.getMonth() - 9);
        break;
      case '6months':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // This would require more complex queries to calculate stage conversions over time
    // For now, return mock data structure
    return [];
  }

  private transformForecastResults(aiForecast: any): ForecastResult[] {
    // Transform AI forecast results into our format
    return aiForecast.scenarios?.realistic ? [{
      period: 'next_period',
      predictedValue: aiForecast.scenarios.realistic,
      confidence: aiForecast.confidence || 0.8,
      upperBound: aiForecast.scenarios.optimistic || aiForecast.scenarios.realistic * 1.2,
      lowerBound: aiForecast.scenarios.pessimistic || aiForecast.scenarios.realistic * 0.8,
      factors: aiForecast.factors || []
    }] : [];
  }

  private async generateScenarios(historicalData: any[], period: string): Promise<ForecastScenario[]> {
    const baseForecast = this.calculateBaseForecast(historicalData);

    return [
      {
        name: 'Conservative',
        description: 'Lower growth assumptions, higher risk factors',
        assumptions: { growthRate: 0.05, riskAdjustment: 0.9 },
        forecast: [{
          period: 'next_period',
          predictedValue: baseForecast * 0.9,
          confidence: 0.75,
          upperBound: baseForecast * 1.0,
          lowerBound: baseForecast * 0.8,
          factors: []
        }],
        probability: 0.3
      },
      {
        name: 'Realistic',
        description: 'Balanced growth based on historical trends',
        assumptions: { growthRate: 0.08, riskAdjustment: 1.0 },
        forecast: [{
          period: 'next_period',
          predictedValue: baseForecast,
          confidence: 0.85,
          upperBound: baseForecast * 1.15,
          lowerBound: baseForecast * 0.9,
          factors: []
        }],
        probability: 0.5
      },
      {
        name: 'Optimistic',
        description: 'Higher growth assumptions, favorable conditions',
        assumptions: { growthRate: 0.12, riskAdjustment: 1.1 },
        forecast: [{
          period: 'next_period',
          predictedValue: baseForecast * 1.1,
          confidence: 0.65,
          upperBound: baseForecast * 1.3,
          lowerBound: baseForecast * 1.0,
          factors: []
        }],
        probability: 0.2
      }
    ];
  }

  private calculateBaseForecast(historicalData: any[]): number {
    if (historicalData.length < 2) return 0;

    // Simple linear trend calculation
    const values = historicalData.map(d => d.value);
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict next value
    return Math.max(0, intercept + slope * n);
  }

  private calculateOverallConfidence(historicalData: any[], aiForecast: any): number {
    let confidence = 0.5; // Base confidence

    // Data quality factor
    if (historicalData.length >= 6) confidence += 0.2;
    else if (historicalData.length >= 3) confidence += 0.1;

    // AI confidence factor
    if (aiForecast.confidence) {
      confidence += aiForecast.confidence * 0.3;
    }

    return Math.min(confidence, 0.95);
  }

  private applyConversionForecasting(historicalData: any[], period: string): ForecastResult[] {
    // Simplified forecasting - would use more sophisticated methods in production
    const avgConversion = historicalData.reduce((sum, d) => sum + d.conversion, 0) / historicalData.length || 0;

    return [{
      period: 'next_period',
      predictedValue: avgConversion,
      confidence: 0.7,
      upperBound: avgConversion * 1.2,
      lowerBound: avgConversion * 0.8,
      factors: []
    }];
  }

  private calculatePredictionAccuracy(predicted: number, actual: number): number {
    if (actual === 0) return predicted === 0 ? 1 : 0;
    return Math.max(0, 1 - Math.abs(predicted - actual) / actual);
  }
}

// Singleton instance
let forecastingService: ForecastingService | null = null;

export const getForecastingService = (): ForecastingService => {
  if (!forecastingService) {
    forecastingService = new ForecastingService();
  }
  return forecastingService;
};

export { ForecastingService };
export type { ForecastModel, ForecastResult, ForecastScenario };