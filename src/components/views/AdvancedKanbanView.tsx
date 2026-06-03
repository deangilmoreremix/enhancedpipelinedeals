import React, { useState, useMemo } from 'react';
import { Deal, KanbanViewConfig } from '../types';
import { Plus, MoreHorizontal, Users, DollarSign, Clock } from 'lucide-react';

interface AdvancedKanbanViewProps {
  deals: Record<string, Deal>;
  config: KanbanViewConfig;
  onDealClick: (dealId: string) => void;
  onDealMove: (dealId: string, newStage: string) => void;
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => void;
  onColumnAdd?: (column: { id: string; title: string; color: string }) => void;
  onColumnUpdate?: (columnId: string, updates: Partial<KanbanViewConfig['columns'][0]>) => void;
  showMetrics?: boolean;
}

export const AdvancedKanbanView: React.FC<AdvancedKanbanViewProps> = ({
  deals,
  config,
  onDealClick,
  onDealMove,
  onDealUpdate,
  onColumnAdd,
  onColumnUpdate,
  showMetrics = true
}) => {
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Group deals by stage/column
  const dealsByColumn = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};

    config.columns.forEach(column => {
      grouped[column.id] = [];
    });

    Object.values(deals).forEach(deal => {
      const column = config.columns.find(col => col.id === deal.stage);
      if (column) {
        grouped[column.id].push(deal);
      }
    });

    return grouped;
  }, [deals, config.columns]);

  // Calculate column metrics
  const columnMetrics = useMemo(() => {
    const metrics: Record<string, {
      count: number;
      totalValue: number;
      avgValue: number;
      overLimit: boolean;
    }> = {};

    config.columns.forEach(column => {
      const columnDeals = dealsByColumn[column.id] || [];
      const totalValue = columnDeals.reduce((sum, deal) => sum + deal.value, 0);
      const avgValue = columnDeals.length > 0 ? totalValue / columnDeals.length : 0;
      const overLimit = column.wipLimit ? columnDeals.length > column.wipLimit : false;

      metrics[column.id] = {
        count: columnDeals.length,
        totalValue,
        avgValue,
        overLimit
      };
    });

    return metrics;
  }, [dealsByColumn, config.columns]);

  const handleDragStart = (dealId: string) => {
    setDraggedDeal(dealId);
  };

  const handleDragEnd = () => {
    setDraggedDeal(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (draggedDeal) {
      const column = config.columns.find(col => col.id === columnId);
      if (column) {
        onDealMove(draggedDeal, column.id);
      }
    }
    setDraggedDeal(null);
    setDragOverColumn(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage: string) => {
    const column = config.columns.find(col => col.id === stage);
    return column?.color || '#6b7280';
  };

  return (
    <div className="flex gap-6 h-full overflow-x-auto p-6">
      {config.columns.map((column) => {
        const columnDeals = dealsByColumn[column.id] || [];
        const metrics = columnMetrics[column.id];
        const isOverLimit = metrics.overLimit;
        const isDragOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={`flex-shrink-0 w-80 bg-gray-50 rounded-lg border-2 transition-colors ${
              isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
            } ${isOverLimit ? 'border-red-300 bg-red-50' : ''}`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                  <h3 className="font-medium text-gray-900">{column.title}</h3>
                  {column.wipLimit && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isOverLimit
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {metrics.count}/{column.wipLimit}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onColumnAdd?.({
                      id: `new-${Date.now()}`,
                      title: 'New Deal',
                      color: '#3b82f6'
                    })}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showMetrics && (
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{metrics.count}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span>{formatCurrency(metrics.totalValue)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Avg: {formatCurrency(metrics.avgValue)}
                  </div>
                </div>
              )}
            </div>

            {/* Column Content */}
            <div className="p-2 min-h-96">
              <div className="space-y-3">
                {columnDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => handleDragStart(deal.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onDealClick(deal.id)}
                    className={`bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                      draggedDeal === deal.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm leading-tight">
                        {deal.title || `${deal.company} - ${deal.contact}`}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(deal.priority)}`}>
                        {deal.priority}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{deal.contact}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>{formatCurrency(deal.value)}</span>
                      </div>
                      {deal.dueDate && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(deal.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Deal health/progress indicator */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{deal.probability}%</span>
                    </div>

                    {/* Tags */}
                    {deal.tags && deal.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {deal.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {deal.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{deal.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Drop zone indicator */}
                {isDragOver && columnDeals.length === 0 && (
                  <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center text-blue-600">
                    Drop deal here
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add new column button */}
      <div className="flex-shrink-0 w-80">
        <button
          onClick={() => onColumnAdd?.({
            id: `column-${Date.now()}`,
            title: 'New Stage',
            color: '#6b7280'
          })}
          className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          <div className="text-center">
            <Plus className="w-8 h-8 mx-auto mb-2" />
            <span className="text-sm">Add Column</span>
          </div>
        </button>
      </div>
    </div>
  );
};