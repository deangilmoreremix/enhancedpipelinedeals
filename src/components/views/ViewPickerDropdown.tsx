import React, { useState } from 'react';
import { SavedPipelineView } from '../../services/savedPipelineViewService';
import { ChevronDown, Check, Star, Filter, BarChart3 } from 'lucide-react';

interface ViewPickerDropdownProps {
  views: SavedPipelineView[];
  currentView: SavedPipelineView | null;
  onViewSelect: (view: SavedPipelineView) => void;
  onViewCreate?: () => void;
  onViewEdit?: (view: SavedPipelineView) => void;
  onViewDelete?: (viewId: string) => void;
}

export const ViewPickerDropdown: React.FC<ViewPickerDropdownProps> = ({
  views,
  currentView,
  onViewSelect,
  onViewCreate,
  onViewEdit,
  onViewDelete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredViews = views.filter(view =>
    view.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (view.description && view.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const groupedViews = {
    default: filteredViews.filter(v => v.is_default),
    recent: filteredViews.filter(v => !v.is_default).slice(0, 5),
    all: filteredViews
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px]"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {currentView?.name || 'Select View'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-[400px] overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              placeholder="Search views..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="overflow-y-auto max-h-[300px]">
            {searchQuery === '' && groupedViews.default.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 py-1">Default Views</p>
                {groupedViews.default.map(view => (
                  <ViewItem
                    key={view.id}
                    view={view}
                    isActive={currentView?.id === view.id}
                    onSelect={onViewSelect}
                    onEdit={onViewEdit}
                    onDelete={onViewDelete}
                    isDefault
                  />
                ))}
              </div>
            )}

            {searchQuery === '' && groupedViews.recent.length > 0 && (
              <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 py-1">Recent Views</p>
                {groupedViews.recent.map(view => (
                  <ViewItem
                    key={view.id}
                    view={view}
                    isActive={currentView?.id === view.id}
                    onSelect={onViewSelect}
                    onEdit={onViewEdit}
                    onDelete={onViewDelete}
                  />
                ))}
              </div>
            )}

            {searchQuery !== '' && filteredViews.length === 0 && (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No views found matching "{searchQuery}"
              </div>
            )}

            {searchQuery !== '' && filteredViews.length > 0 && (
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 py-1">Search Results</p>
                {filteredViews.map(view => (
                  <ViewItem
                    key={view.id}
                    view={view}
                    isActive={currentView?.id === view.id}
                    onSelect={onViewSelect}
                    onEdit={onViewEdit}
                    onDelete={onViewDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {onViewCreate && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  onViewCreate();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md flex items-center justify-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Create New View</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ViewItemProps {
  view: SavedPipelineView;
  isActive: boolean;
  onSelect: (view: SavedPipelineView) => void;
  onEdit?: (view: SavedPipelineView) => void;
  onDelete?: (viewId: string) => void;
  isDefault?: boolean;
}

const ViewItem: React.FC<ViewItemProps> = ({ view, isActive, onSelect, onEdit, onDelete, isDefault }) => {
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      <div
        className="flex-1 min-w-0"
        onClick={() => onSelect(view)}
      >
        <div className="flex items-center space-x-2">
          <p className={`font-medium text-sm truncate ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
            {view.name}
          </p>
          {isDefault && (
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
          )}
          {isActive && <Check className="w-4 h-4 text-blue-600" />}
        </div>
        {view.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {view.description}
          </p>
        )}
        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="capitalize">{view.view_type}</span>
          {view.filters && Object.keys(view.filters).length > 0 && (
            <span>{Object.keys(view.filters).length} filters</span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button
            onClick={() => onEdit(view)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Edit view"
          >
            <BarChart3 className="w-3 h-3" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(view.id)}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete view"
          >
            <span className="text-xs">×</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ViewPickerDropdown;