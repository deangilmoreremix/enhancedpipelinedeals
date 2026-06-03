import React from 'react';
import { Search, Filter, X } from 'lucide-react';

export interface SDRFilterOptions {
  category?: string;
  search?: string;
  favorites?: boolean;
  sortBy?: 'name' | 'usage' | 'recency';
}

interface SDRFilterPanelProps {
  filters: SDRFilterOptions;
  onFiltersChange: (filters: SDRFilterOptions) => void;
  categories: string[];
}

export const SDRFilterPanel: React.FC<SDRFilterPanelProps> = ({
  filters,
  onFiltersChange,
  categories
}) => {
  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const handleCategoryChange = (category: string) => {
    onFiltersChange({
      ...filters,
      category: filters.category === category ? undefined : category
    });
  };

  const handleFavoritesToggle = () => {
    onFiltersChange({ ...filters, favorites: !filters.favorites });
  };

  const handleSortChange = (sortBy: SDRFilterOptions['sortBy']) => {
    onFiltersChange({ ...filters, sortBy });
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = !!(
    filters.search ||
    filters.category ||
    filters.favorites ||
    filters.sortBy
  );

  return (
    <div
      style={{
        borderRadius: 12,
        padding: 16,
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        marginBottom: 16
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Filter size={18} color="#4a5568" />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1a202c' }}>
          Filter & Search Agents
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: 'none',
              background: '#f3f4f6',
              color: '#6b7280',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <X size={12} />
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            color="#9ca3af"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search agents by name, description, or tags..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 8px 8px 36px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 14,
              background: '#ffffff'
            }}
          />
        </div>
      </div>

      {/* Category filters */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
          Categories
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: filters.category === category ? '#3b82f6' : '#d1d5db',
                background: filters.category === category ? '#eff6ff' : '#ffffff',
                color: filters.category === category ? '#1d4ed8' : '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Quick filters */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
          Quick Filters
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleFavoritesToggle}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: filters.favorites ? '#fbbf24' : '#d1d5db',
              background: filters.favorites ? '#fefce8' : '#ffffff',
              color: filters.favorites ? '#92400e' : '#6b7280',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            ⭐ Favorites only
          </button>
        </div>
      </div>

      {/* Sort options */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>
          Sort by
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { value: 'name' as const, label: 'Name' },
            { value: 'usage' as const, label: 'Most Used' },
            { value: 'recency' as const, label: 'Recently Used' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: filters.sortBy === option.value ? '#3b82f6' : '#d1d5db',
                background: filters.sortBy === option.value ? '#eff6ff' : '#ffffff',
                color: filters.sortBy === option.value ? '#1d4ed8' : '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};