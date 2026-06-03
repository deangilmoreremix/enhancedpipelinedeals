/**
 * KPI Service
 * Key Performance Indicator management and monitoring
 */

import { getSupabaseService } from './supabaseService';
import { getPipelineAnalyticsService } from './pipelineAnalyticsService';

export interface KPI {
  id: string;
  name: string;
  description?: string;
  formula: string;
  dataSource: string;
  targetValue?: number;
  targetDirection: 'higher' | 'lower';
  calculationPeriod: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KPIValue {
  id: string;
  kpiId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  targetValue?: number;
  status: 'on_track' | 'at_risk' | 'off_track';
  calculatedAt: string;
}

export interface KPISummary {
  kpi: KPI;
  currentValue: number;
  previousValue?: number;
  targetValue?: number;
  status: 'on_track' | 'at_risk' | 'off_track';
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  lastCalculated: string;
}

export interface KPIDashboard {
  totalKPIs: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
  summaries: KPISummary[];
  overallHealth: number; // 0-100
}

class KPIService {
  private supabaseService = getSupabaseService();
  private analyticsService = getPipelineAnalyticsService();

  /**
   * Get all KPIs for current user
   */
  async getKPIs(): Promise<KPI[]> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(k => this.transformKPI(k));
    } catch (error) {
      console.error('Failed to get KPIs:', error);
      return [];
    }
  }

  /**
   * Create new KPI
   */
  async createKPI(kpi: Omit<KPI, 'id' | 'createdAt' | 'updatedAt'>): Promise<KPI> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('kpi_definitions')
        .insert({
          name: kpi.name,
          description: kpi.description,
          formula: kpi.formula,
          data_source: kpi.dataSource,
          target_value: kpi.targetValue,
          target_direction: kpi.targetDirection,
          calculation_period: kpi.calculationPeriod,
          is_active: kpi.isActive
        })
        .select()
        .single();

      if (error) throw error;

      return this.transformKPI(data);
    } catch (error) {
      console.error('Failed to create KPI:', error);
      throw error;
    }
  }

  /**
   * Update KPI
   */
  async updateKPI(id: string, updates: Partial<KPI>): Promise<KPI> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.formula) updateData.formula = updates.formula;
      if (updates.dataSource) updateData.data_source = updates.dataSource;
      if (updates.targetValue !== undefined) updateData.target_value = updates.targetValue;
      if (updates.targetDirection) updateData.target_direction = updates.targetDirection;
      if (updates.calculationPeriod) updateData.calculation_period = updates.calculationPeriod;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const { data, error } = await supabase
        .from('kpi_definitions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.transformKPI(data);
    } catch (error) {
      console.error('Failed to update KPI:', error);
      throw error;
    }
  }

  /**
   * Delete KPI
   */
  async deleteKPI(id: string): Promise<boolean> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      const { error } = await supabase
        .from('kpi_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Failed to delete KPI:', error);
      return false;
    }
  }

  /**
   * Calculate KPI values for a specific period
   */
  async calculateKPIValue(kpiId: string, periodStart: Date, periodEnd: Date): Promise<KPIValue> {
    try {
      const kpi = await this.getKPIById(kpiId);
      const value = await this.executeKPIFormula(kpi, periodStart, periodEnd);

      const status = this.calculateKPIStatus(value, kpi.targetValue, kpi.targetDirection);

      const supabase = (this.supabaseService as any).supabase;

      const { data, error } = await supabase
        .from('kpi_values')
        .insert({
          kpi_id: kpiId,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          value,
          target_value: kpi.targetValue,
          status
        })
        .select()
        .single();

      if (error) throw error;

      return this.transformKPIValue(data);
    } catch (error) {
      console.error('Failed to calculate KPI value:', error);
      throw error;
    }
  }

  /**
   * Get KPI values for a date range
   */
  async getKPIValues(kpiId: string, startDate?: Date, endDate?: Date): Promise<KPIValue[]> {
    try {
      const supabase = (this.supabaseService as any).supabase;

      let query = supabase
        .from('kpi_values')
        .select('*')
        .eq('kpi_id', kpiId)
        .order('period_end', { ascending: false });

      if (startDate) {
        query = query.gte('period_start', startDate.toISOString().split('T')[0]);
      }
      if (endDate) {
        query = query.lte('period_end', endDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      return (data || []).map(v => this.transformKPIValue(v));
    } catch (error) {
      console.error('Failed to get KPI values:', error);
      return [];
    }
  }

  /**
   * Get KPI dashboard summary
   */
  async getKPIDashboard(): Promise<KPIDashboard> {
    try {
      const kpis = await this.getKPIs();
      const summaries: KPISummary[] = [];

      let onTrack = 0;
      let atRisk = 0;
      let offTrack = 0;

      for (const kpi of kpis) {
        const summary = await this.getKPISummary(kpi);
        summaries.push(summary);

        switch (summary.status) {
          case 'on_track':
            onTrack++;
            break;
          case 'at_risk':
            atRisk++;
            break;
          case 'off_track':
            offTrack++;
            break;
        }
      }

      const totalKPIs = kpis.length;
      const overallHealth = totalKPIs > 0 ? (onTrack / totalKPIs) * 100 : 0;

      return {
        totalKPIs,
        onTrack,
        atRisk,
        offTrack,
        summaries,
        overallHealth
      };
    } catch (error) {
      console.error('Failed to get KPI dashboard:', error);
      throw error;
    }
  }

  /**
   * Calculate all KPI values for current period
   */
  async calculateAllKPIs(): Promise<KPIValue[]> {
    try {
      const kpis = await this.getKPIs();
      const results: KPIValue[] = [];

      for (const kpi of kpis) {
        const period = this.getCurrentPeriod(kpi.calculationPeriod);
        try {
          const value = await this.calculateKPIValue(kpi.id, period.start, period.end);
          results.push(value);
        } catch (error) {
          console.error(`Failed to calculate KPI ${kpi.name}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to calculate all KPIs:', error);
      throw error;
    }
  }

  /**
   * Get predefined KPI templates
   */
  getKPITemplates(): Array<Omit<KPI, 'id' | 'createdAt' | 'updatedAt'>> {
    return [
      {
        name: 'Monthly Revenue',
        description: 'Total revenue from closed deals in the current month',
        formula: 'SUM(deals.value WHERE stage = "closed-won" AND closed_date >= period_start AND closed_date <= period_end)',
        dataSource: 'deals',
        targetValue: 50000,
        targetDirection: 'higher',
        calculationPeriod: 'monthly',
        isActive: true
      },
      {
        name: 'Conversion Rate',
        description: 'Percentage of deals that convert to closed-won',
        formula: '(COUNT(deals WHERE stage = "closed-won") / COUNT(deals)) * 100',
        dataSource: 'deals',
        targetValue: 25,
        targetDirection: 'higher',
        calculationPeriod: 'monthly',
        isActive: true
      },
      {
        name: 'Average Deal Size',
        description: 'Average value of closed deals',
        formula: 'AVG(deals.value WHERE stage = "closed-won")',
        dataSource: 'deals',
        targetValue: 15000,
        targetDirection: 'higher',
        calculationPeriod: 'monthly',
        isActive: true
      },
      {
        name: 'Sales Velocity',
        description: 'Average days to close deals',
        formula: 'AVG(days_in_stage FROM sales_velocity_metrics WHERE exited_at IS NOT NULL)',
        dataSource: 'sales_velocity_metrics',
        targetValue: 45,
        targetDirection: 'lower',
        calculationPeriod: 'monthly',
        isActive: true
      },
      {
        name: 'Pipeline Coverage',
        description: 'Ratio of pipeline value to monthly target',
        formula: 'SUM(deals.value WHERE stage NOT IN ("closed-won", "closed-lost")) / monthly_target',
        dataSource: 'deals',
        targetValue: 3,
        targetDirection: 'higher',
        calculationPeriod: 'monthly',
        isActive: true
      },
      {
        name: 'Lead Response Time',
        description: 'Average time to respond to new leads',
        formula: 'AVG(response_time FROM lead_responses WHERE created_at >= period_start AND created_at <= period_end)',
        dataSource: 'lead_responses',
        targetValue: 2,
        targetDirection: 'lower',
        calculationPeriod: 'daily',
        isActive: true
      }
    ];
  }

  // Private helper methods

  private transformKPI(data: any): KPI {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      formula: data.formula,
      dataSource: data.data_source,
      targetValue: data.target_value,
      targetDirection: data.target_direction,
      calculationPeriod: data.calculation_period,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private transformKPIValue(data: any): KPIValue {
    return {
      id: data.id,
      kpiId: data.kpi_id,
      periodStart: data.period_start,
      periodEnd: data.period_end,
      value: data.value,
      targetValue: data.target_value,
      status: data.status,
      calculatedAt: data.calculated_at
    };
  }

  private async getKPIById(id: string): Promise<KPI> {
    const supabase = (this.supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('kpi_definitions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return this.transformKPI(data);
  }

  private async executeKPIFormula(kpi: KPI, periodStart: Date, periodEnd: Date): Promise<number> {
    // This is a simplified implementation
    // In a real system, you'd have a more sophisticated formula parser

    switch (kpi.formula) {
      case 'SUM(deals.value WHERE stage = "closed-won")':
        return await this.calculateRevenueSum(periodStart, periodEnd);

      case '(COUNT(deals WHERE stage = "closed-won") / COUNT(deals)) * 100':
        return await this.calculateConversionRate(periodStart, periodEnd);

      case 'AVG(deals.value WHERE stage = "closed-won")':
        return await this.calculateAverageDealSize(periodStart, periodEnd);

      case 'AVG(days_in_stage FROM sales_velocity_metrics WHERE exited_at IS NOT NULL)':
        return await this.calculateAverageVelocity(periodStart, periodEnd);

      default:
        // For complex formulas, use the analytics service
        return await this.executeComplexFormula(kpi, periodStart, periodEnd);
    }
  }

  private async calculateRevenueSum(periodStart: Date, periodEnd: Date): Promise<number> {
    const supabase = (this.supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('deals')
      .select('value')
      .eq('stage', 'closed-won')
      .gte('updated_at', periodStart.toISOString())
      .lte('updated_at', periodEnd.toISOString());

    if (error) throw error;

    return (data || []).reduce((sum, deal) => sum + (deal.value || 0), 0);
  }

  private async calculateConversionRate(periodStart: Date, periodEnd: Date): Promise<number> {
    const supabase = (this.supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('deals')
      .select('stage')
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    if (error) throw error;

    const total = data?.length || 0;
    const won = data?.filter(d => d.stage === 'closed-won').length || 0;

    return total > 0 ? (won / total) * 100 : 0;
  }

  private async calculateAverageDealSize(periodStart: Date, periodEnd: Date): Promise<number> {
    const supabase = (this.supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('deals')
      .select('value')
      .eq('stage', 'closed-won')
      .gte('updated_at', periodStart.toISOString())
      .lte('updated_at', periodEnd.toISOString());

    if (error) throw error;

    const values = (data || []).map(d => d.value).filter(v => v > 0);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private async calculateAverageVelocity(periodStart: Date, periodEnd: Date): Promise<number> {
    const supabase = (this.supabaseService as any).supabase;

    const { data, error } = await supabase
      .from('sales_velocity_metrics')
      .select('days_in_stage')
      .not('exited_at', 'is', null)
      .gte('exited_at', periodStart.toISOString())
      .lte('exited_at', periodEnd.toISOString());

    if (error) throw error;

    const values = (data || []).map(d => d.days_in_stage).filter(v => v > 0);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private async executeComplexFormula(kpi: KPI, periodStart: Date, periodEnd: Date): Promise<number> {
    // For complex formulas, delegate to analytics service
    // This is a placeholder for more sophisticated formula execution
    console.warn(`Complex formula execution not implemented for: ${kpi.formula}`);
    return 0;
  }

  private calculateKPIStatus(value: number, target?: number, direction?: string): 'on_track' | 'at_risk' | 'off_track' {
    if (!target) return 'on_track';

    const threshold = 0.05; // 5% tolerance

    if (direction === 'higher') {
      if (value >= target) return 'on_track';
      if (value >= target * (1 - threshold)) return 'at_risk';
      return 'off_track';
    } else {
      if (value <= target) return 'on_track';
      if (value <= target * (1 + threshold)) return 'at_risk';
      return 'off_track';
    }
  }

  private async getKPISummary(kpi: KPI): Promise<KPISummary> {
    const currentPeriod = this.getCurrentPeriod(kpi.calculationPeriod);
    const previousPeriod = this.getPreviousPeriod(kpi.calculationPeriod);

    const currentValues = await this.getKPIValues(kpi.id, currentPeriod.start, currentPeriod.end);
    const previousValues = await this.getKPIValues(kpi.id, previousPeriod.start, previousPeriod.end);

    const currentValue = currentValues[0]?.value || 0;
    const previousValue = previousValues[0]?.value || 0;

    const changePercent = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
    const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';

    return {
      kpi,
      currentValue,
      previousValue: previousValue || undefined,
      targetValue: kpi.targetValue,
      status: currentValues[0]?.status || 'on_track',
      trend,
      changePercent,
      lastCalculated: currentValues[0]?.calculatedAt || new Date().toISOString()
    };
  }

  private getCurrentPeriod(period: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (period) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'quarterly':
        start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(start.getMonth() + 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yearly':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11, 31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  private getPreviousPeriod(period: string): { start: Date; end: Date } {
    const current = this.getCurrentPeriod(period);
    const start = new Date(current.start);
    const end = new Date(current.end);

    switch (period) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        end.setDate(end.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        end.setMonth(end.getMonth(), 0);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        end.setMonth(end.getMonth() - 3, 0);
        break;
      case 'yearly':
        start.setFullYear(start.getFullYear() - 1);
        end.setFullYear(end.getFullYear() - 1);
        break;
    }

    return { start, end };
  }
}

// Singleton instance
let kpiService: KPIService | null = null;

export const getKPIService = (): KPIService => {
  if (!kpiService) {
    kpiService = new KPIService();
  }
  return kpiService;
};

export { KPIService };
export type { KPI, KPIValue, KPISummary, KPIDashboard };