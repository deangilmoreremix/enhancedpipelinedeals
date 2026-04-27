import React, { useState, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Workflow,
  WorkflowStep,
  WorkflowTrigger,
  WorkflowAction,
  TriggerType,
  ActionType
} from '../../types/workflow';
import {
  Play,
  Pause,
  Settings,
  Plus,
  Trash2,
  Copy,
  Save,
  Zap,
  Clock,
  Mail,
  Code,
  Globe,
  Bot,
  Filter,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer
} from 'lucide-react';

interface WorkflowBuilderProps {
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
  onSave: () => void;
  onExecute: () => void;
  isExecuting?: boolean;
}

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  workflow,
  onWorkflowChange,
  onSave,
  onExecute,
  isExecuting = false
}) => {
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // Handle dropping new items onto canvas
    if (source.droppableId === 'toolbar' && destination.droppableId === 'canvas') {
      const itemType = draggableId;
      const rect = canvasRef.current?.getBoundingClientRect();
      const x = destination.x - (rect?.left || 0);
      const y = destination.y - (rect?.top || 0);

      addStepToCanvas(itemType, x, y);
    }

    // Handle reordering steps (if needed)
    // This would be implemented for rearranging existing steps
  }, [workflow.steps]);

  const addStepToCanvas = (itemType: string, x: number, y: number) => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      name: getDefaultStepName(itemType),
      type: itemType as any,
      position: { x, y },
      connections: [],
      isActive: true
    };

    // Initialize step-specific properties
    switch (itemType) {
      case 'trigger':
        newStep.trigger = {
          id: `trigger_${Date.now()}`,
          type: 'record_created',
          name: 'New Record Created',
          description: 'Triggers when a new record is created',
          config: {},
          isActive: true
        };
        break;
      case 'action':
        newStep.action = {
          id: `action_${Date.now()}`,
          type: 'send_email',
          name: 'Send Email',
          description: 'Send an email notification',
          config: {},
          isActive: true
        };
        break;
      case 'condition':
        // Conditions are handled differently
        newStep.type = 'condition';
        break;
      case 'delay':
        newStep.delay = 60; // 1 hour default
        break;
    }

    const updatedWorkflow = {
      ...workflow,
      steps: [...workflow.steps, newStep]
    };

    onWorkflowChange(updatedWorkflow);
  };

  const getDefaultStepName = (type: string): string => {
    switch (type) {
      case 'trigger': return 'New Trigger';
      case 'action': return 'New Action';
      case 'condition': return 'Condition';
      case 'delay': return 'Delay';
      default: return 'Step';
    }
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    const updatedSteps = workflow.steps.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    );

    onWorkflowChange({
      ...workflow,
      steps: updatedSteps
    });
  };

  const deleteStep = (stepId: string) => {
    const updatedSteps = workflow.steps.filter(step => step.id !== stepId);

    // Remove connections to deleted step
    const stepsWithRemovedConnections = updatedSteps.map(step => ({
      ...step,
      connections: step.connections.filter(conn => conn !== stepId)
    }));

    onWorkflowChange({
      ...workflow,
      steps: stepsWithRemovedConnections
    });

    if (selectedStep?.id === stepId) {
      setSelectedStep(null);
    }
  };

  const duplicateStep = (step: WorkflowStep) => {
    const newStep: WorkflowStep = {
      ...step,
      id: `step_${Date.now()}`,
      name: `${step.name} (Copy)`,
      position: {
        x: step.position.x + 20,
        y: step.position.y + 20
      },
      connections: []
    };

    onWorkflowChange({
      ...workflow,
      steps: [...workflow.steps, newStep]
    });
  };

  const connectSteps = (fromStepId: string, toStepId: string) => {
    const updatedSteps = workflow.steps.map(step => {
      if (step.id === fromStepId) {
        return {
          ...step,
          connections: step.connections.includes(toStepId)
            ? step.connections.filter(id => id !== toStepId)
            : [...step.connections, toStepId]
        };
      }
      return step;
    });

    onWorkflowChange({
      ...workflow,
      steps: updatedSteps
    });
  };

  const renderStepIcon = (step: WorkflowStep) => {
    switch (step.type) {
      case 'trigger':
        return <Zap className="w-4 h-4" />;
      case 'action':
        switch (step.action?.type) {
          case 'send_email':
            return <Mail className="w-4 h-4" />;
          case 'code':
            return <Code className="w-4 h-4" />;
          case 'http_request':
            return <Globe className="w-4 h-4" />;
          case 'ai_agent':
            return <Bot className="w-4 h-4" />;
          case 'delay':
            return <Clock className="w-4 h-4" />;
          default:
            return <Play className="w-4 h-4" />;
        }
      case 'condition':
        return <Filter className="w-4 h-4" />;
      case 'delay':
        return <Timer className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const renderToolbarItem = (type: string, icon: React.ReactNode, label: string) => (
    <Draggable key={type} draggableId={type} index={0}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`flex flex-col items-center p-3 bg-white border border-gray-200 rounded-lg cursor-grab hover:border-blue-300 hover:shadow-md transition-all ${
            snapshot.isDragging ? 'shadow-lg rotate-2' : ''
          }`}
        >
          <div className="text-gray-600 mb-1">{icon}</div>
          <span className="text-xs text-gray-600 text-center">{label}</span>
        </div>
      )}
    </Draggable>
  );

  const renderCanvasStep = (step: WorkflowStep, index: number) => (
    <div
      key={step.id}
      className={`absolute border-2 rounded-lg p-3 cursor-pointer transition-all ${
        selectedStep?.id === step.id
          ? 'border-blue-500 bg-blue-50 shadow-lg'
          : 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-md'
      } ${step.isActive ? '' : 'opacity-50'}`}
      style={{
        left: step.position.x,
        top: step.position.y,
        minWidth: '120px'
      }}
      onClick={() => setSelectedStep(step)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {renderStepIcon(step)}
          <span className="text-sm font-medium text-gray-900 truncate max-w-20">
            {step.name}
          </span>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              duplicateStep(step);
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteStep(step.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Connection points */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
        <div className="w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
      </div>
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
        <div className="w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-gray-50">
      {/* Toolbar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-4">Workflow Elements</h3>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="toolbar" isDropDisabled={true}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                {/* Triggers */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Triggers</h4>
                  {renderToolbarItem('trigger', <Zap className="w-5 h-5" />, 'Trigger')}
                </div>

                {/* Actions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {renderToolbarItem('send_email', <Mail className="w-4 h-4" />, 'Send Email')}
                    {renderToolbarItem('create_record', <Plus className="w-4 h-4" />, 'Create Record')}
                    {renderToolbarItem('update_record', <Settings className="w-4 h-4" />, 'Update Record')}
                    {renderToolbarItem('code', <Code className="w-4 h-4" />, 'Run Code')}
                    {renderToolbarItem('http_request', <Globe className="w-4 h-4" />, 'HTTP Request')}
                    {renderToolbarItem('ai_agent', <Bot className="w-4 h-4" />, 'AI Agent')}
                    {renderToolbarItem('delay', <Clock className="w-4 h-4" />, 'Delay')}
                  </div>
                </div>

                {/* Logic */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Logic</h4>
                  {renderToolbarItem('condition', <Filter className="w-5 h-5" />, 'Condition')}
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{workflow.name}</h2>
            <p className="text-sm text-gray-600">{workflow.description}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={onExecute}
              disabled={isExecuting}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center space-x-2"
            >
              {isExecuting ? (
                <RotateCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>{isExecuting ? 'Running...' : 'Execute'}</span>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-auto">
          <Droppable droppableId="canvas">
            {(provided, snapshot) => (
              <div
                ref={(el) => {
                  provided.innerRef(el);
                  canvasRef.current = el;
                }}
                {...provided.droppableProps}
                className={`w-full h-full min-h-screen relative ${
                  snapshot.isDraggingOver ? 'bg-blue-50' : ''
                }`}
                style={{
                  backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              >
                {workflow.steps.map((step, index) => renderCanvasStep(step, index))}

                {/* Connection Lines */}
                <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
                  {workflow.steps.map(step =>
                    step.connections.map(targetId => {
                      const targetStep = workflow.steps.find(s => s.id === targetId);
                      if (!targetStep) return null;

                      const startX = step.position.x + 60; // Center of step
                      const startY = step.position.y + 60; // Bottom of step
                      const endX = targetStep.position.x + 60; // Center of target
                      const endY = targetStep.position.y; // Top of target

                      return (
                        <line
                          key={`${step.id}-${targetId}`}
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#6b7280"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })
                  )}

                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill="#6b7280"
                      />
                    </marker>
                  </defs>
                </svg>

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        {selectedStep ? (
          <div>
            <h3 className="text-lg font-semibold mb-4">Step Properties</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={selectedStep.name}
                  onChange={(e) => updateStep(selectedStep.id, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {selectedStep.trigger && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Type
                  </label>
                  <select
                    value={selectedStep.trigger.type}
                    onChange={(e) => updateStep(selectedStep.id, {
                      trigger: {
                        ...selectedStep.trigger,
                        type: e.target.value as TriggerType
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="record_created">Record Created</option>
                    <option value="record_updated">Record Updated</option>
                    <option value="record_deleted">Record Deleted</option>
                    <option value="stage_changed">Stage Changed</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="manual">Manual</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </div>
              )}

              {selectedStep.action && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action Type
                  </label>
                  <select
                    value={selectedStep.action.type}
                    onChange={(e) => updateStep(selectedStep.id, {
                      action: {
                        ...selectedStep.action,
                        type: e.target.value as ActionType
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="send_email">Send Email</option>
                    <option value="create_record">Create Record</option>
                    <option value="update_record">Update Record</option>
                    <option value="delete_record">Delete Record</option>
                    <option value="search_records">Search Records</option>
                    <option value="code">Run Code</option>
                    <option value="http_request">HTTP Request</option>
                    <option value="ai_agent">AI Agent</option>
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedStep.isActive}
                    onChange={(e) => updateStep(selectedStep.id, { isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-8">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Select a step to edit its properties</p>
          </div>
        )}
      </div>
    </div>
  );
};