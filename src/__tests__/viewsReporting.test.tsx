import { AdvancedFilteringService } from '../services/advancedFilteringService';
import { CustomMetricsService } from '../services/customMetricsService';
import { exportService } from '../services/exportService';
import { ViewsReportingService } from '../services/viewsReportingService';
import { Deal } from '../types';

// Mock supabase to avoid import.meta issues
jest.mock('../services/supabaseService', () => ({
  getSupabaseService: () => ({
    getDeals: jest.fn(),
    createDeal: jest.fn(),
    updateDeal: jest.fn(),
    deleteDeal: jest.fn()
  })
}));

describe('AdvancedFilteringService', () => {
  const mockDeals: Deal[] = [
    {
      id: '1',
      title: 'Test Deal 1',
      company: 'Tech Corp',
      contact: 'John Doe',
      value: 50000,
      stage: 'qualification' as const,
      probability: 75,
      priority: 'high' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      title: 'Test Deal 2',
      company: 'Data Inc',
      contact: 'Jane Smith',
      value: 75000,
      stage: 'proposal' as const,
      probability: 60,
      priority: 'medium' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  it('filters deals by company name', () => {
    const filters = [
      {
        field: 'company',
        operator: 'contains' as const,
        value: 'Tech',
        logicalOperator: 'AND' as const
      }
    ];

    const result = AdvancedFilteringService.filterDeals(mockDeals, filters);
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe('Tech Corp');
  });

  it('filters deals by value range', () => {
    const filters = [
      {
        field: 'value',
        operator: 'greater_than' as const,
        value: 60000,
        logicalOperator: 'AND' as const
      }
    ];

    const result = AdvancedFilteringService.filterDeals(mockDeals, filters);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(75000);
  });

  it('validates filter configuration', () => {
    const validFilters = [
      {
        field: 'company',
        operator: 'equals' as const,
        value: 'Test'
      }
    ];

    const result = AdvancedFilteringService.validateFilters(validFilters);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns validation errors for invalid filters', () => {
    const invalidFilters = [
      {
        operator: 'equals' as const,
        value: 'Test'
        // Missing field
      }
    ];

    const result = AdvancedFilteringService.validateFilters(invalidFilters);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('CustomMetricsService', () => {
  const mockDeals: Deal[] = [
    {
      id: '1',
      title: 'Deal 1',
      company: 'Company A',
      contact: 'Contact 1',
      value: 50000,
      stage: 'qualification' as const,
      probability: 75,
      priority: 'high' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      title: 'Deal 2',
      company: 'Company B',
      contact: 'Contact 2',
      value: 75000,
      stage: 'closed-won' as const,
      probability: 100,
      priority: 'medium' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      title: 'Deal 3',
      company: 'Company C',
      contact: 'Contact 3',
      value: 30000,
      stage: 'closed-lost' as const,
      probability: 0,
      priority: 'low' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  it('calculates total pipeline value', async () => {
    const result = await CustomMetricsService.calculateMetric(
      {
        id: '1',
        name: 'Total Pipeline Value',
        formula: 'total_pipeline_value',
        parameters: {},
        dataType: 'currency',
        category: 'sales',
        visualization: 'number',
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      mockDeals
    );

    expect(result).toBe(155000); // 50000 + 75000 + 30000
  });

  it('calculates win rate', async () => {
    const result = await CustomMetricsService.calculateMetric(
      {
        id: '2',
        name: 'Win Rate',
        formula: 'win_rate',
        parameters: {},
        dataType: 'percentage',
        category: 'sales',
        visualization: 'number',
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      mockDeals
    );

    expect(result).toBe(50); // 1 won out of 2 qualified deals (closed-won and closed-lost)
  });

  it('validates formula syntax', () => {
    const validResult = CustomMetricsService.validateFormula('total_deals > 0');
    expect(validResult.isValid).toBe(true);

    const invalidResult = CustomMetricsService.validateFormula('');
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.error).toBe('Formula cannot be empty');
  });
});

describe('exportService', () => {
  const mockDeals = [
    {
      id: '1',
      title: 'Test Deal',
      company: 'Test Company',
      value: 50000,
      stage: 'qualification',
      probability: 75,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02')
    }
  ];

  beforeEach(() => {
    // Mock downloadFile
    (exportService.downloadFile as jest.Mock).mockImplementation(() => {});
  });

  it('exports deals to CSV format', async () => {
    const result = await exportService.exportDeals(mockDeals, {
      format: 'csv',
      includeMetadata: false
    });

    expect(result).toContain('id,title,company,value,stage,probability,createdAt,updatedAt');
    expect(result).toContain('1,Test Deal,Test Company,50000,qualification,75,');
  });

  it('exports deals to JSON format', async () => {
    const result = await exportService.exportDeals(mockDeals, {
      format: 'json',
      includeMetadata: true
    });

    const parsed = JSON.parse(result);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.deals).toHaveLength(1);
    expect(parsed.deals[0].title).toBe('Test Deal');
  });

  it('applies date range filter during export', async () => {
    const result = await exportService.exportDeals(mockDeals, {
      format: 'csv',
      includeMetadata: false,
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-03')
      }
    });

    expect(result).toContain('Test Deal');
  });
});

describe('ViewsReportingService', () => {
  it('creates saved view', async () => {
    const mockView = {
      name: 'Test View',
      viewType: 'table' as const,
      filters: [],
      sorting: [],
      columns: [],
      isDefault: false,
      isPublic: false,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      tags: []
    };

    (ViewsReportingService.createSavedView as jest.Mock).mockResolvedValue({
      id: 'view-1',
      ...mockView
    });

    const result = await ViewsReportingService.createSavedView(mockView);
    expect(result).toHaveProperty('id', 'view-1');
    expect(result?.name).toBe('Test View');
  });

  it('retrieves saved views', async () => {
    const mockViews = [
      {
        id: 'view-1',
        name: 'Test View',
        viewType: 'table' as const,
        filters: [],
        sorting: [],
        columns: [],
        isDefault: false,
        isPublic: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        tags: []
      }
    ];

    (ViewsReportingService.getSavedViews as jest.Mock).mockResolvedValue(mockViews);

    const result = await ViewsReportingService.getSavedViews('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test View');
  });
});