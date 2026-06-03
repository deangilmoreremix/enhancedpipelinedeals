import React, { useState, useEffect } from 'react';
import { Variable, WorkflowAction, FormField } from '../../types/workflow';
import { ModernButton } from '../ui/ModernButton';
import { Plus, X, Edit2, Save, RefreshCw } from 'lucide-react';

interface WorkflowVariablePanelProps {
  action: WorkflowAction;
  onChange: (action: WorkflowAction) => void;
  className?: string;
}

interface VariableFormData {
  name: string;
  type: FormField['type'];
  defaultValue: string;
  description: string;
}

export const WorkflowVariablePanel: React.FC<WorkflowVariablePanelProps> = ({
  action,
  onChange,
  className = ''
}) => {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);
  const [formData, setFormData] = useState<VariableFormData>({
    name: '',
    type: 'text',
    defaultValue: '',
    description: ''
  });

  useEffect(() => {
    const actionVariables = action.config.formFields || [];
    const derivedVariables: Variable[] = actionVariables.map(field => ({
      name: field.name,
      type: field.type,
      defaultValue: field.defaultValue || '',
      description: field.label || ''
    }));
    setVariables(derivedVariables);
  }, [action]);

  const handleAddVariable = () => {
    if (!formData.name.trim()) return;

    const newVariable: Variable = {
      name: formData.name,
      type: formData.type,
      defaultValue: formData.defaultValue,
      description: formData.description
    };

    const updatedVariables = [...variables, newVariable];
    updateActionVariables(updatedVariables);
    resetForm();
  };

  const handleUpdateVariable = () => {
    if (!editingVariable) return;

    const updatedVariables = variables.map(v =>
      v.name === editingVariable.name ? { ...v, type: formData.type, ...formData } : v
    );
    updateActionVariables(updatedVariables);
    resetForm();
    setEditingVariable(null);
  };

  const handleDeleteVariable = (name: string) => {
    const updatedVariables = variables.filter(v => v.name !== name);
    updateActionVariables(updatedVariables);
  };

  const updateActionVariables = (updatedVariables: Variable[]) => {
    const formFields = updatedVariables.map(v => ({
      id: v.name,
      type: v.type as FormField['type'],
      name: v.name,
      label: v.description || '',
      placeholder: '',
      required: false,
      defaultValue: v.defaultValue
    }));

    onChange({
      ...action,
      config: {
        ...action.config,
        formFields
      }
    });
    setVariables(updatedVariables);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'text',
      defaultValue: '',
      description: ''
    });
    setShowAddForm(false);
  };

  const startEdit = (variable: Variable) => {
    setEditingVariable(variable);
    setFormData({
      name: variable.name,
      type: variable.type,
      defaultValue: variable.defaultValue || '',
      description: variable.description || ''
    });
    setShowAddForm(true);
  };

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Workflow Variables</h3>
        <ModernButton
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Variable
        </ModernButton>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="variable_name"
                disabled={!!editingVariable}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as FormField['type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="select">Select</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
              <input
                type="text"
                value={formData.defaultValue}
                onChange={e => setFormData({ ...formData, defaultValue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Default value"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Variable description"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <ModernButton
                variant="primary"
                size="sm"
                onClick={editingVariable ? handleUpdateVariable : handleAddVariable}
                leftIcon={editingVariable ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              >
                {editingVariable ? 'Update' : 'Add'} Variable
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

      {variables.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No variables defined yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {variables.map(variable => (
            <div
              key={variable.name}
              className="bg-white rounded-lg p-3 border border-gray-200 flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-gray-900">{variable.name}</div>
                <div className="text-sm text-gray-500">
                  Type: <span className="capitalize">{variable.type}</span>
                  {variable.description && ` • ${variable.description}`}
                </div>
                {variable.defaultValue && (
                  <div className="text-xs text-gray-400 mt-1">
                    Default: {variable.defaultValue}
                  </div>
                )}
              </div>

              <div className="flex space-x-1">
                <button
                  onClick={() => startEdit(variable)}
                  className="p-1.5 text-gray-500 hover:text-blue-600 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteVariable(variable.name)}
                  className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};