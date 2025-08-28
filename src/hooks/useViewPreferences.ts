import { useState, useEffect } from 'react';
import { getSupabaseService } from '../services/supabaseService';

export type DealViewType = 'kanban' | 'list' | 'table' | 'calendar' | 'dashboard' | 'timeline';

interface ViewPreferences {
  defaultView: DealViewType;
  tableColumns: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export const useViewPreferences = () => {
  const [preferences, setPreferences] = useState<ViewPreferences>({
    defaultView: 'kanban',
    tableColumns: ['title', 'company', 'contact', 'value', 'stage', 'probability'],
    sortBy: 'updated',
    sortOrder: 'desc'
  });
  const [isLoading, setIsLoading] = useState(true);

  const supabaseService = getSupabaseService();

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        
        // Load all preference settings
        const [defaultView, tableColumns, sortBy, sortOrder] = await Promise.all([
          supabaseService.getSetting('default_deal_view'),
          supabaseService.getSetting('table_columns'),
          supabaseService.getSetting('list_sort_by'),
          supabaseService.getSetting('list_sort_order')
        ]);

        setPreferences({
          defaultView: defaultView || 'kanban',
          tableColumns: tableColumns || ['title', 'company', 'contact', 'value', 'stage', 'probability'],
          sortBy: sortBy || 'updated',
          sortOrder: sortOrder || 'desc'
        });
      } catch (error) {
        console.error('Failed to load view preferences:', error);
        // Keep default preferences
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Save individual preference
  const savePreference = async (key: keyof ViewPreferences, value: any) => {
    try {
      const settingKey = {
        defaultView: 'default_deal_view',
        tableColumns: 'table_columns',
        sortBy: 'list_sort_by',
        sortOrder: 'list_sort_order'
      }[key];

      await supabaseService.saveSetting(settingKey, value);
      
      setPreferences(prev => ({
        ...prev,
        [key]: value
      }));
    } catch (error) {
      console.error(`Failed to save ${key} preference:`, error);
    }
  };

  // Convenience methods
  const setDefaultView = (view: DealViewType) => savePreference('defaultView', view);
  const setTableColumns = (columns: string[]) => savePreference('tableColumns', columns);
  const setSortBy = (sortBy: string) => savePreference('sortBy', sortBy);
  const setSortOrder = (order: 'asc' | 'desc') => savePreference('sortOrder', order);

  return {
    preferences,
    isLoading,
    setDefaultView,
    setTableColumns,
    setSortBy,
    setSortOrder,
    savePreference
  };
};