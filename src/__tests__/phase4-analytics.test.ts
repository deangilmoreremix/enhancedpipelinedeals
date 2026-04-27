/**
 * Phase 4 Analytics & Forecasting Implementation Test
 * Comprehensive test suite for all Phase 4 features
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { getPipelineAnalyticsService } from '../services/pipelineAnalyticsService';
import { getAdvancedAnalyticsService } from '../services/advancedAnalyticsService';
import { getForecastingService } from '../services/forecastingService';
import { getDashboardService } from '../services/dashboardService';
import { getKPIService } from '../services/kpiService';

// Mock services for testing
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({
    isConnectedToDatabase: () => true,
    getDeals: async () => [
      {
        id: '1',
        stage: 'closed-won',
        value: 50000,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: '2',
        stage: 'negotiation',
        value: 75000,
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-20')
      }
    ]
  })
}));

describe('Phase 4: Analytics & Forecasting', () => {
  let pipelineAnalytics: any;
  let advancedAnalytics: any;
  let forecasting: any;
  let dashboard: any;
  let kpi: any;

  beforeAll(() => {
    pipelineAnalytics = getPipelineAnalyticsService();
    advancedAnalytics = getAdvancedAnalyticsService();
    forecasting = getForecastingService();
    dashboard = getDashboardService();
    kpi = getKPIService();
  });

  describe('Pipeline Analytics', () => {
    test('should calculate pipeline metrics', async () => {
      const metrics = await pipelineAnalytics.getPipelineMetrics();

      expect(metrics).toHaveProperty('totalDeals');
      expect(metrics).toHaveProperty('totalValue');
      expect(metrics).toHaveProperty('conversionRate');
      expect(metrics).toHaveProperty('velocity');
      expect(metrics).toHaveProperty('pipelineHealth');

      expect(typeof metrics.totalDeals).toBe('number');
      expect(typeof metrics.totalValue).toBe('number');
      expect(metrics.pipelineHealth).toBeGreaterThanOrEqual(0);
      expect(metrics.pipelineHealth).toBeLessThanOrEqual(100);
    });

    test('should analyze stage performance', async () => {
      const stageAnalytics = await pipelineAnalytics.getStageAnalytics();

      expect(Array.isArray(stageAnalytics)).toBe(true);
      stageAnalytics.forEach((stage: any) => {
        expect(stage).toHaveProperty('stage');
        expect(stage).toHaveProperty('dealCount');
        expect(stage).toHaveProperty('totalValue');
        expect(stage).toHaveProperty('conversionRate');
        expect(['low', 'medium', 'high']).toContain(stage.bottleneckRisk);
      });
    });

    test('should generate trend analysis', async () => {
      const trends = await pipelineAnalytics.getTrendAnalysis('monthly', 3);

      expect(Array.isArray(trends)).toBe(true);
      expect(trends.length).toBeGreaterThan(0);
      trends.forEach((trend: any) => {
        expect(trend).toHaveProperty('period');
        expect(trend).toHaveProperty('dealsCreated');
        expect(trend).toHaveProperty('revenue');
        expect(trend).toHaveProperty('growth');
      });
    });

    test('should provide predictive insights', async () => {
      const insights = await pipelineAnalytics.getPredictiveInsights();

      expect(insights).toHaveProperty('nextMonthRevenue');
      expect(insights).toHaveProperty('confidence');
      expect(Array.isArray(insights.riskFactors)).toBe(true);
      expect(Array.isArray(insights.opportunities)).toBe(true);
      expect(Array.isArray(insights.recommendations)).toBe(true);

      expect(insights.confidence).toBeGreaterThanOrEqual(0);
      expect(insights.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('Advanced Analytics', () => {
    test('should generate sales forecast', async () => {
      const forecast = await advancedAnalytics.generateSalesForecast('current_workspace', '3months');

      expect(forecast).toHaveProperty('predictedValue');
      expect(forecast).toHaveProperty('confidence');
      expect(Array.isArray(forecast.factors)).toBe(true);
      expect(forecast).toHaveProperty('scenarios');

      expect(forecast.confidence).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence).toBeLessThanOrEqual(100);
    });

    test('should predict churn risk', async () => {
      const prediction = await advancedAnalytics.predictChurnRisk('contact-123');

      expect(prediction).toHaveProperty('churnProbability');
      expect(prediction).toHaveProperty('riskLevel');
      expect(Array.isArray(prediction.indicators)).toBe(true);
      expect(Array.isArray(prediction.recommendedActions)).toBe(true);

      expect(['low', 'medium', 'high', 'critical']).toContain(prediction.riskLevel);
    });

    test('should analyze deal velocity', async () => {
      const analysis = await advancedAnalytics.analyzeDealVelocity('deal-123');

      expect(analysis).toHaveProperty('currentVelocity');
      expect(analysis).toHaveProperty('predictedVelocity');
      expect(Array.isArray(analysis.accelerationOpportunities)).toBe(true);
      expect(Array.isArray(analysis.riskFactors)).toBe(true);
    });

    test('should run comprehensive predictive analytics', async () => {
      const results = await advancedAnalytics.runPredictiveAnalytics('current_workspace');

      expect(results).toHaveProperty('salesForecast');
      expect(results).toHaveProperty('churnPredictions');
      expect(results).toHaveProperty('dealVelocities');
      expect(results).toHaveProperty('marketTrends');
      expect(results).toHaveProperty('confidence');
      expect(results).toHaveProperty('generatedAt');
    });
  });

  describe('Forecasting Service', () => {
    test('should generate revenue forecast with scenarios', async () => {
      const result = await forecasting.generateRevenueForecast('3months', true);

      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('scenarios');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('modelUsed');

      expect(Array.isArray(result.scenarios)).toBe(true);
      result.scenarios.forEach((scenario: any) => {
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('forecast');
        expect(scenario).toHaveProperty('probability');
      });
    });

    test('should generate conversion forecast', async () => {
      const forecast = await forecasting.generateConversionForecast('negotiation', '3months');

      expect(Array.isArray(forecast)).toBe(true);
      forecast.forEach((point: any) => {
        expect(point).toHaveProperty('period');
        expect(point).toHaveProperty('predictedValue');
        expect(point).toHaveProperty('confidence');
      });
    });

    test('should calculate forecast accuracy', async () => {
      const accuracy = await forecasting.getForecastAccuracy('model-123', '3months');

      expect(accuracy).toHaveProperty('overallAccuracy');
      expect(accuracy).toHaveProperty('meanAbsoluteError');
      expect(accuracy).toHaveProperty('rootMeanSquaredError');
      expect(Array.isArray(accuracy.recentPredictions)).toBe(true);
    });
  });

  describe('Dashboard Service', () => {
    test('should create and manage dashboards', async () => {
      const newDashboard = await dashboard.createDashboard(
        'Test Dashboard',
        'Dashboard for testing',
        { theme: 'dark', autoRefresh: true, refreshInterval: 300 }
      );

      expect(newDashboard).toHaveProperty('id');
      expect(newDashboard.name).toBe('Test Dashboard');
      expect(newDashboard.config.theme).toBe('dark');

      const dashboards = await dashboard.getDashboards();
      expect(dashboards.length).toBeGreaterThan(0);
    });

    test('should manage dashboard widgets', async () => {
      const dashboard = await dashboard.getDefaultDashboard();
      expect(dashboard).toBeTruthy();

      const widget = await dashboard.addWidget(dashboard!.id, {
        type: 'kpi_card',
        title: 'Test KPI',
        config: { kpiType: 'totalRevenue' },
        position: { x: 0, y: 0, w: 4, h: 3 },
        refreshInterval: 300
      });

      expect(widget).toHaveProperty('id');
      expect(widget.type).toBe('kpi_card');
      expect(widget.title).toBe('Test KPI');

      const widgets = await dashboard.getDashboardWidgets(dashboard!.id);
      expect(widgets.length).toBeGreaterThan(0);
    });

    test('should export and import dashboards', async () => {
      const dashboard = await dashboard.getDefaultDashboard();
      expect(dashboard).toBeTruthy();

      const exportData = await dashboard.exportDashboard(dashboard!.id);
      expect(typeof exportData).toBe('string');

      const parsed = JSON.parse(exportData);
      expect(parsed).toHaveProperty('dashboard');
      expect(parsed).toHaveProperty('widgets');
    });
  });

  describe('KPI Service', () => {
    test('should create and manage KPIs', async () => {
      const newKPI = await kpi.createKPI({
        name: 'Test KPI',
        description: 'KPI for testing',
        formula: 'COUNT(deals)',
        dataSource: 'deals',
        targetValue: 100,
        targetDirection: 'higher',
        calculationPeriod: 'monthly',
        isActive: true
      });

      expect(newKPI).toHaveProperty('id');
      expect(newKPI.name).toBe('Test KPI');
      expect(newKPI.targetValue).toBe(100);

      const kpis = await kpi.getKPIs();
      expect(kpis.length).toBeGreaterThan(0);
    });

    test('should calculate KPI values', async () => {
      const kpis = await kpi.getKPIs();
      expect(kpis.length).toBeGreaterThan(0);

      const kpi = kpis[0];
      const period = kpi.getCurrentPeriod(kpi.calculationPeriod);
      const value = await kpi.calculateKPIValue(kpi.id, period.start, period.end);

      expect(value).toHaveProperty('id');
      expect(value).toHaveProperty('kpiId');
      expect(value).toHaveProperty('value');
      expect(['on_track', 'at_risk', 'off_track']).toContain(value.status);
    });

    test('should generate KPI dashboard summary', async () => {
      const dashboard = await kpi.getKPIDashboard();

      expect(dashboard).toHaveProperty('totalKPIs');
      expect(dashboard).toHaveProperty('onTrack');
      expect(dashboard).toHaveProperty('atRisk');
      expect(dashboard).toHaveProperty('offTrack');
      expect(dashboard).toHaveProperty('overallHealth');
      expect(Array.isArray(dashboard.summaries)).toBe(true);

      expect(dashboard.overallHealth).toBeGreaterThanOrEqual(0);
      expect(dashboard.overallHealth).toBeLessThanOrEqual(100);
    });

    test('should provide KPI templates', () => {
      const templates = kpi.getKPITemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      templates.forEach((template: any) => {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('formula');
        expect(template).toHaveProperty('targetDirection');
        expect(['higher', 'lower']).toContain(template.targetDirection);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should provide end-to-end analytics workflow', async () => {
      // 1. Get pipeline metrics
      const metrics = await pipelineAnalytics.getPipelineMetrics();
      expect(metrics.totalDeals).toBeGreaterThan(0);

      // 2. Generate forecast
      const forecast = await forecasting.generateRevenueForecast('3months');
      expect(forecast.confidence).toBeGreaterThan(0);

      // 3. Create dashboard
      const dashboard = await dashboard.createDashboard('Integration Test Dashboard');
      expect(dashboard.id).toBeTruthy();

      // 4. Add KPI widget
      const kpiWidget = await dashboard.addWidget(dashboard.id, {
        type: 'kpi_card',
        title: 'Revenue KPI',
        config: { kpiType: 'totalRevenue', target: 100000 },
        position: { x: 0, y: 0, w: 4, h: 3 },
        refreshInterval: 300
      });

      // 5. Get widget data
      const widgetData = await dashboard.getWidgetData(kpiWidget.id);
      expect(widgetData).toHaveProperty('data');
      expect(widgetData.metadata.cacheHit).toBeDefined();

      // 6. Calculate KPIs
      const kpiValues = await kpi.calculateAllKPIs();
      expect(Array.isArray(kpiValues)).toBe(true);
    });

    test('should handle feature flags correctly', () => {
      // Test that services are properly initialized
      expect(pipelineAnalytics).toBeDefined();
      expect(advancedAnalytics).toBeDefined();
      expect(forecasting).toBeDefined();
      expect(dashboard).toBeDefined();
      expect(kpi).toBeDefined();

      // Test service methods exist
      expect(typeof pipelineAnalytics.getPipelineMetrics).toBe('function');
      expect(typeof advancedAnalytics.generateSalesForecast).toBe('function');
      expect(typeof forecasting.generateRevenueForecast).toBe('function');
      expect(typeof dashboard.createDashboard).toBe('function');
      expect(typeof kpi.createKPI).toBe('function');
    });
  });
});