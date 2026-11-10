import React, { useState } from 'react';
import { SavedPipelineView as BaseSavedPipelineView, normalizeSavedFilters } from '../../services/savedPipelineViewService';
import { ChevronDown, Check, Star, Filter, BarChart3, Globe, Pencil, X } from 'lucide-react';

// Views may carry an optional description that the service type does not declare yet.
type SavedPipelineView = BaseSavedPipelineView & { description?: string };

interface ViewPickerDropdownProps {
  views: SavedPipelineView[];
  currentView: SavedPipelineView | null;
  onViewSelect: (view: SavedPipelineView) => void;
  onViewCreate?: () => void;
  onViewEdit?: (view: SavedPipelineView) => void;
  onViewDelete?: (viewId: string) => void;
  onViewRename?: (view: SavedPipelineView) => void;
  /** Toggle "default view" (a default view is applied when the board opens). */
  onSetDefault?: (view: SavedPipelineView) => void;
  /** Toggle whether the view is shared with everybody (is_public). */
  onTogglePublic?: (view: SavedPipelineView) => void;
  /** The live configuration differs from the selected view. */
  dirty?: boolean;
  /** Footer link opening the full management panel. */
  onManage?: () => void;
}

export const ViewPickerDropdown: React.FC<ViewPickerDropdownProps> = ({
  views,
  currentView,
  onViewSelect,
  onViewCreate,
  onViewEdit,
  onViewDelete,
  onViewRename,
  onSetDefault,
  onTogglePublic,
  dirty = false,
  onManage
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredViews = views.filter(view =>
    view.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (view.description && view.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const groupedViews = {
    default: filteredViews.filter(v => v.is_default),
    recent: filteredViews.filter(v => !v.is_default),
    all: filteredViews
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[200px]"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {currentView?.name || 'Select View'}{dirty ? ' (modified)' : ''}
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
                    onRename={onViewRename}
                    onSetDefault={onSetDefault}
                    onTogglePublic={onTogglePublic}
                    isDefault
                  />
                ))}
              </div>
            )}

            {searchQuery === '' && groupedViews.recent.length > 0 && (
              <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 py-1">Saved Views</p>
                {groupedViews.recent.map(view => (
                  <ViewItem
                    key={view.id}
                    view={view}
                    isActive={currentView?.id === view.id}
                    onSelect={onViewSelect}
                    onEdit={onViewEdit}
                    onDelete={onViewDelete}
                    onRename={onViewRename}
                    onSetDefault={onSetDefault}
                    onTogglePublic={onTogglePublic}
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
                    onRename={onViewRename}
                    onSetDefault={onSetDefault}
                    onTogglePublic={onTogglePublic}
                  />
                ))}
              </div>
            )}
          </div>

          {onViewCreate && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
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
              {onManage && (
                <button
                  onClick={() => { onManage(); setIsOpen(false); }}
                  className="w-full px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:underline"
                >
                  Manage views...
                </button>
              )}
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
  onRename?: (view: SavedPipelineView) => void;
  onSetDefault?: (view: SavedPipelineView) => void;
  onTogglePublic?: (view: SavedPipelineView) => void;
  isDefault?: boolean;
}

const ViewItem: React.FC<ViewItemProps> = ({ view, isActive, onSelect, onEdit, onDelete, onRename, onSetDefault, onTogglePublic, isDefault }) => {
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
          {(isDefault || view.is_default) && (
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" aria-label="Default view" />
          )}
          {view.is_public && <Globe className="w-3 h-3 text-green-600" aria-label="Shared" />}
          {isActive && <Check className="w-4 h-4 text-blue-600" />}
        </div>
        {view.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {view.description}
          </p>
        )}
        <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="capitalize">{view.view_type}</span>
          {(() => {
            const f = normalizeSavedFilters(view.filters);
            const n = f.conditions.length + f.groups.length;
            return n > 0 ? <span>{n} filter{n === 1 ? '' : 's'}</span> : null;
          })()}
        </div>
      </div>

      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {onSetDefault && (
          <button
            type="button"
            onClick={() => onSetDefault(view)}
            className="p-1 text-gray-400 hover:text-yellow-500"
            title={view.is_default ? 'Unset default' : 'Set as default'}
            aria-label={view.is_default ? 'Unset default view' : 'Set as default view'}
          >
            <Star className="w-3 h-3" />
          </button>
        )}
        {onTogglePublic && (
          <button
            type="button"
            onClick={() => onTogglePublic(view)}
            className={`p-1 hover:text-green-600 ${view.is_public ? 'text-green-600' : 'text-gray-400'}`}
            title={view.is_public ? 'Stop sharing' : 'Share with everyone'}
            aria-label={view.is_public ? 'Stop sharing view' : 'Share view'}
          >
            <Globe className="w-3 h-3" />
          </button>
        )}
        {onRename && (
          <button
            type="button"
            onClick={() => onRename(view)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Rename view"
            aria-label="Rename view"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
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
            aria-label="Delete view"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ViewPickerDropdown;