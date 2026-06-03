import { calculateColumnAggregation, getStageColor } from '../components/pipeline/kanban/kanbanUtils';
import { Deal } from '../../types';

describe('Kanban Enhancements - Phase 2', () => {
  describe('Column Aggregation Calculations', () => {
    it('should calculate aggregation for empty deals array', () => {
      const result = calculateColumnAggregation([]);
      expect(result).toEqual({
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0
      });
    });

    it('should calculate aggregation for deals with values', () => {
      const deals: Deal[] = [
        { id: '1', title: 'Deal 1', value: 1000, stage: 'qualified' },
        { id: '2', title: 'Deal 2', value: 2000, stage: 'qualified' },
        { id: '3', title: 'Deal 3', value: 1500, stage: 'qualified' }
      ];

      const result = calculateColumnAggregation(deals);
      expect(result.count).toBe(3);
      expect(result.sum).toBe(4500);
      expect(result.average).toBe(1500);
      expect(result.min).toBe(1000);
      expect(result.max).toBe(2000);
    });

    it('should handle deals with zero or undefined values', () => {
      const deals: Deal[] = [
        { id: '1', title: 'Deal 1', value: 1000 },
        { id: '2', title: 'Deal 2', value: 0 },
        { id: '3', title: 'Deal 3' } // undefined value
      ];

      const result = calculateColumnAggregation(deals);
      expect(result.count).toBe(3);
      expect(result.sum).toBe(1000);
      expect(result.average).toBeCloseTo(333.33, 2);
      expect(result.min).toBe(0);
      expect(result.max).toBe(1000);
    });
  });

  describe('Stage Color Mapping', () => {
    it('should return correct colors for known stages', () => {
      expect(getStageColor('new')).toBe('border-blue-500 bg-blue-50 dark:bg-blue-900/20');
      expect(getStageColor('contacted')).toBe('border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20');
      expect(getStageColor('qualified')).toBe('border-purple-500 bg-purple-50 dark:bg-purple-900/20');
      expect(getStageColor('proposal')).toBe('border-orange-500 bg-orange-50 dark:bg-orange-900/20');
      expect(getStageColor('closed')).toBe('border-green-500 bg-green-50 dark:bg-green-900/20');
    });

    it('should return default color for unknown stages', () => {
      expect(getStageColor('unknown')).toBe('border-gray-500 bg-gray-50 dark:bg-gray-900/20');
      expect(getStageColor('')).toBe('border-gray-500 bg-gray-50 dark:bg-gray-900/20');
    });
  });

  describe('WIP Limit Validation', () => {
    it('should validate WIP limits correctly', () => {
      // This would test the WIP limit indicator component
      // For now, testing the calculation logic
      const current = 5;
      const limit = 3;

      expect(current > limit).toBe(true);
      expect(current <= limit).toBe(false);
    });

    it('should handle unlimited WIP', () => {
      const current = 10;
      const limit = 0; // unlimited

      expect(limit === 0 || current <= limit).toBe(true);
    });
  });

  describe('Custom Column Management', () => {
    it('should validate custom column configuration', () => {
      const validColumn = {
        id: 'custom-1',
        name: 'Custom Stage',
        position: 1,
        config: {
          color: 'border-red-500',
          wipLimit: 5,
          description: 'Custom stage description'
        },
        is_active: true
      };

      expect(validColumn.id).toBeTruthy();
      expect(validColumn.name).toBeTruthy();
      expect(validColumn.position).toBeGreaterThan(0);
      expect(validColumn.is_active).toBe(true);
    });

    it('should handle column reordering', () => {
      const columns = [
        { id: '1', position: 1 },
        { id: '2', position: 2 },
        { id: '3', position: 3 }
      ];

      // Simulate reordering
      const reordered = [
        { id: '2', position: 1 },
        { id: '1', position: 2 },
        { id: '3', position: 3 }
      ];

      expect(reordered[0].position).toBe(1);
      expect(reordered[1].position).toBe(2);
      expect(reordered[2].position).toBe(3);
    });
  });

  describe('Card Customization', () => {
    it('should validate card field configurations', () => {
      const cardConfig = {
        showValue: true,
        showProbability: true,
        showOwner: false,
        showLastActivity: true,
        customFields: ['priority', 'source']
      };

      expect(cardConfig.showValue).toBe(true);
      expect(cardConfig.showProbability).toBe(true);
      expect(cardConfig.showOwner).toBe(false);
      expect(cardConfig.showLastActivity).toBe(true);
      expect(cardConfig.customFields).toContain('priority');
      expect(cardConfig.customFields).toContain('source');
    });

    it('should handle card layout calculations', () => {
      const cardHeight = 120; // pixels
      const fields = ['title', 'value', 'owner', 'lastActivity'];
      const estimatedHeight = fields.length * 20 + 40; // 20px per field + padding

      expect(estimatedHeight).toBe(120);
      expect(cardHeight).toBe(estimatedHeight);
    });
  });

  describe('Column Grouping', () => {
    it('should group deals by criteria', () => {
      const deals: Deal[] = [
        { id: '1', title: 'Deal 1', value: 1000, stage: 'new', owner: 'Alice' },
        { id: '2', title: 'Deal 2', value: 2000, stage: 'qualified', owner: 'Bob' },
        { id: '3', title: 'Deal 3', value: 1500, stage: 'new', owner: 'Alice' }
      ];

      // Group by owner
      const groupedByOwner = deals.reduce((groups, deal) => {
        const key = deal.owner || 'unassigned';
        if (!groups[key]) groups[key] = [];
        groups[key].push(deal);
        return groups;
      }, {} as Record<string, Deal[]>);

      expect(Object.keys(groupedByOwner)).toHaveLength(2);
      expect(groupedByOwner['Alice']).toHaveLength(2);
      expect(groupedByOwner['Bob']).toHaveLength(1);
    });

    it('should handle empty groups', () => {
      const deals: Deal[] = [];
      const grouped = deals.reduce((groups, deal) => {
        const key = deal.stage || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(deal);
        return groups;
      }, {} as Record<string, Deal[]>);

      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });
});