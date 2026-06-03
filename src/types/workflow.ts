// Enhanced workflow types for Twenty CRM Phase 5
export type TriggerType =
  | 'record_created'
  | 'record_updated'
  | 'record_deleted'
  | 'stage_changed'
  | 'field_changed'
  | 'scheduled'
  | 'manual'
  | 'webhook'
  | 'sla_breach'
  | 'milestone_reached';

export type ActionType =
  | 'create_record'
  | 'update_record'
  | 'delete_record'
  | 'search_records'
  | 'upsert_record'
  | 'send_email'
  | 'delay'
  | 'iterator'
  | 'filter'
  | 'code'
  | 'http_request'
  | 'form'
  | 'ai_agent'
  | 'notification'
  | 'update_stage'
  | 'assign_owner'
  | 'add_comment'
  | 'schedule_followup'
  | 'create_task'
  | 'update_sla'
  | 'webhook';

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  name: string;
  description: string;
  config: {
    // Record event triggers
    recordType?: 'deal' | 'contact' | 'company' | 'task';
    fieldName?: string;
    fieldValue?: any;
    previousValue?: any;

    // Stage change triggers
    fromStage?: string;
    toStage?: string;

    // Scheduled triggers
    schedule?: {
      frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
      time?: string; // HH:MM format
      daysOfWeek?: number[]; // 0-6, Sunday = 0
      cronExpression?: string;
    };

    // Webhook triggers
    webhookUrl?: string;
    webhookSecret?: string;

    // SLA triggers
    slaType?: 'response_time' | 'stage_duration' | 'milestone_deadline';
    threshold?: number; // minutes/hours/days
  };
  conditions?: WorkflowCondition[];
  isActive: boolean;
}

export interface WorkflowAction {
  id: string;
  type: ActionType;
  name: string;
  description: string;
  config: {
    // Record actions
    recordType?: 'deal' | 'contact' | 'company' | 'task';
    fields?: Record<string, any>;
    searchCriteria?: Record<string, any>;
    upsertKey?: string;

    // Email actions
    emailTemplate?: string;
    recipients?: string[];
    subject?: string;
    body?: string;
    attachments?: string[];

    // Delay action
    delayMinutes?: number;

    // Iterator action
    iteratorSource?: 'records' | 'array' | 'query_result';
    iteratorVariable?: string;

    // Filter action
    filterCriteria?: Record<string, any>;

    // Code action
    codeSnippet?: string;

    // HTTP request action
    httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    httpUrl?: string;
    httpHeaders?: Record<string, string>;
    httpBody?: any;

    // Form action
    formFields?: FormField[];
    formTitle?: string;
    formDescription?: string;

    // AI Agent action
    aiAgentPrompt?: string;
    aiAgentModel?: string;
    aiAgentTools?: string[];

    // Notification action
    notificationType?: 'email' | 'in_app' | 'sms' | 'webhook';
    notificationMessage?: string;
    notificationRecipients?: string[];

    // Stage/Assignment actions
    newStage?: string;
    newOwner?: string;

    // SLA actions
    slaType?: string;
    slaDuration?: number;

    // Webhook action
    webhookUrl?: string;
    webhookMethod?: 'GET' | 'POST' | 'PUT';
    webhookHeaders?: Record<string, string>;
    webhookPayload?: any;
  };
  conditions?: WorkflowCondition[];
  errorHandling?: {
    continueOnError: boolean;
    retryCount?: number;
    fallbackAction?: WorkflowAction;
  };
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'matches_regex';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: 'trigger' | 'action' | 'condition' | 'delay';
  trigger?: WorkflowTrigger;
  action?: WorkflowAction;
  condition?: WorkflowCondition;
  delay?: number; // minutes
  position: { x: number; y: number };
  connections: string[]; // IDs of connected steps
  isActive: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category: 'deal_progression' | 'lead_nurturing' | 'customer_success' | 'sales_automation' | 'compliance' | 'custom';
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  settings: {
    isActive: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    maxExecutionTime: number; // minutes
    retryPolicy: {
      enabled: boolean;
      maxRetries: number;
      retryDelay: number; // minutes
    };
    notifications: {
      onSuccess: boolean;
      onFailure: boolean;
      onTimeout: boolean;
    };
  };
  metadata: {
    version: number;
    lastModified: Date;
    createdBy: string;
    usageCount: number;
    successRate: number;
    averageExecutionTime: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggerId?: string;
  triggerType: TriggerType;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // milliseconds
  context: {
    recordId?: string;
    recordType?: string;
    userId?: string;
    inputData?: Record<string, any>;
    variables?: Record<string, any>;
  };
  steps: WorkflowExecutionStep[];
  logs: WorkflowExecutionLog[];
  error?: {
    message: string;
    stepId?: string;
    stackTrace?: string;
  };
}

export interface WorkflowExecutionStep {
  id: string;
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: any;
  error?: string;
}

export interface WorkflowExecutionLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  stepId?: string;
  data?: Record<string, any>;
}

export interface SLAPolicy {
  id: string;
  name: string;
  description: string;
  recordType: 'deal' | 'contact' | 'task';
  conditions: WorkflowCondition[];
  metrics: {
    type: 'response_time' | 'stage_duration' | 'milestone_deadline' | 'completion_time';
    target: number; // minutes/hours/days
    unit: 'minutes' | 'hours' | 'days';
    warningThreshold: number; // percentage of target
    criticalThreshold: number; // percentage of target
  };
  actions: {
    onWarning: WorkflowAction[];
    onBreach: WorkflowAction[];
    onRecovery: WorkflowAction[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SLAInstance {
  id: string;
  policyId: string;
  recordId: string;
  recordType: string;
  startedAt: Date;
  targetAt: Date;
  completedAt?: Date;
  status: 'active' | 'warning' | 'breached' | 'completed' | 'cancelled';
  currentValue: number; // current duration in minutes
  lastChecked: Date;
  notifications: SLANotification[];
}

export interface SLANotification {
  id: string;
  type: 'warning' | 'breach' | 'recovery';
  sentAt: Date;
  recipients: string[];
  message: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[]; // Available merge fields
  category: 'notification' | 'followup' | 'alert' | 'custom';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookConfiguration {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  secret?: string; // For webhook verification
  events: string[]; // Workflow events to trigger on
  isActive: boolean;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // seconds
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AIAgentConfiguration {
  id: string;
  name: string;
  description: string;
  model: string;
  prompt: string;
  tools: string[];
  maxTokens: number;
  temperature: number;
  contextWindow: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'number' | 'email' | 'phone';
  name: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For select/radio
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
  defaultValue?: any;
}

export interface Variable {
  name: string;
  type: FormField['type'];
  defaultValue?: string | number | boolean;
  description?: string;
}

export interface WorkflowAnalytics {
  workflowId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  stepPerformance: Record<string, {
    averageTime: number;
    successRate: number;
    errorCount: number;
  }>;
  triggerFrequency: Record<TriggerType, number>;
  actionFrequency: Record<ActionType, number>;
  lastUpdated: Date;
}