import React, { useState, useEffect, useCallback } from 'react';
import { ModernButton } from '../ui/ModernButton';
import { Plus, Edit2, Trash2, Save, Code, Type, List, Calendar, Hash, ToggleLeft } from 'lucide-react';

interface CustomFieldSchema {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'url' | 'email' | 'phone';
  options?: string[];
  required: boolean;
  defaultValue?: string | number | boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomFieldSchemaManagerProps {
  recordType?: 'deal' | 'contact' | 'company';
  className?: string;
}

interface FieldFormData {
  name: string;
  label: string;
  type: CustomFieldSchema['type'];
  required: boolean;
  options: string;
  defaultValue: string;
  description: string;
}

export const CustomFieldSchemaManager: React.FC<CustomFieldSchemaManagerProps> = ({
  recordType = 'deal',
  className = ''
}) => {
  const [schemas, setSchemas] = useState<CustomFieldSchema[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchema, setEditingSchema] = useState<CustomFieldSchema | null>(null);
  const [formData, setFormData] = useState<FieldFormData>({
    name: '',
    label: '',
    type: 'text',
    required: false,
    options: '',
    defaultValue: '',
    description: ''
  });

  useEffect(() => {
    loadSchemas();
  }, [loadSchemas]);

  const loadSchemas = useCallback(async () => {
    const stored = localStorage.getItem(`custom-fields-${recordType}`);
    if (stored) {
      setSchemas(JSON.parse(stored));
    }
  }, [recordType]);

  const saveSchemas = (updatedSchemas: CustomFieldSchema[]) => {
    localStorage.setItem(`custom-fields-${recordType}`, JSON.stringify(updatedSchemas));
    setSchemas(updatedSchemas);
  };

  const handleAddField = () => {
    if (!formData.name.trim() || !formData.label.trim()) return;

    const newSchema: CustomFieldSchema = {
      id: editingSchema?.id || `field-${Date.now()}`,
      name: formData.name.toLowerCase().replace(/\s+/g, '_'),
      label: formData.label,
      type: formData.type,
      required: formData.required,
      options: formData.type === 'select' || formData.type === 'multiselect'
        ? formData.options.split('\n').filter(o => o.trim())
        : undefined,
      defaultValue: formData.defaultValue || undefined,
      description: formData.description,
      createdAt: editingSchema?.createdAt || new Date(),
      updatedAt: new Date()
    };

    const updatedSchemas = editingSchema
      ? schemas.map(s => s.id === editingSchema.id ? newSchema : s)
      : [...schemas, newSchema];

    saveSchemas(updatedSchemas);
    resetForm();
  };

  const handleDeleteSchema = (id: string) => {
    if (confirm('Are you sure you want to delete this field?')) {
      const updatedSchemas = schemas.filter(s => s.id !== id);
      saveSchemas(updatedSchemas);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      type: 'text',
      required: false,
      options: '',
      defaultValue: '',
      description: ''
    });
    setShowAddForm(false);
    setEditingSchema(null);
  };

  const startEdit = (schema: CustomFieldSchema) => {
    setEditingSchema(schema);
    setFormData({
      name: schema.name,
      label: schema.label,
      type: schema.type,
      required: schema.required,
      options: schema.options?.join('\n') || '',
      defaultValue: schema.defaultValue?.toString() || '',
      description: schema.description || ''
    });
    setShowAddForm(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type className="w-4 h-4" />;
      case 'number': return <Hash className="w-4 h-4" />;
      case 'date': return <Calendar className="w-4 h-4" />;
      case 'boolean': return <ToggleLeft className="w-4 h-4" />;
      case 'select':
      case 'multiselect': return <List className="w-4 h-4" />;
      default: return <Code className="w-4 h-4" />;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Custom Fields Schema</h3>
        <ModernButton
          variant="primary"
          size="sm"
          onClick={() => setShowAddForm(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Field
        </ModernButton>
      </div>

      {showAddForm && (
        <div className="p-4 border-b bg-gray-50">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  disabled={!!editingSchema}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="field_name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={e => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Field Label"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as CustomFieldSchema['type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Boolean</option>
                <option value="select">Select</option>
                <option value="multiselect">Multi-select</option>
                <option value="url">URL</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </div>

            {(formData.type === 'select' || formData.type === 'multiselect') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options (one per line)
                </label>
                <textarea
                  value={formData.options}
                  onChange={e => setFormData({ ...formData, options: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows={3}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Field description"
                rows={2}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="required"
                checked={formData.required}
                onChange={e => setFormData({ ...formData, required: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="required" className="text-sm text-gray-700">Required field</label>
            </div>

            <div className="flex space-x-2 pt-2">
              <ModernButton
                variant="primary"
                size="sm"
                onClick={handleAddField}
                leftIcon={<Save className="w-4 h-4" />}
              >
                {editingSchema ? 'Update' : 'Add'} Field
              </ModernButton>
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                Cancel
              </ModernButton>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y">
        {schemas.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No custom fields defined for {recordType} records</p>
          </div>
        ) : (
          schemas.map(schema => (
            <div key={schema.id} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-3">
                  <div className="text-gray-500 mt-1">{getTypeIcon(schema.type)}</div>
                  <div>
                    <div className="font-medium text-gray-900">{schema.label}</div>
                    <div className="text-sm text-gray-500 font-mono">{schema.name}</div>
                    <div className="text-xs text-gray-600 mt-1 capitalize">
                      {schema.type}
                      {schema.required && <span className="ml-2 text-red-600">required</span>}
                      {schema.options && <span className="ml-2">({schema.options.length} options)</span>}
                    </div>
                    {schema.description && (
                      <div className="text-sm text-gray-600 mt-2">{schema.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-1">
                  <button
                    onClick={() => startEdit(schema)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSchema(schema.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};