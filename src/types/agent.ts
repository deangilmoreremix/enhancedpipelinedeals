/**
 * AI Agent System Types
 * Comprehensive type definitions for AI agents that operate the CRM
 */

export enum AgentType {
  SALES_ASSISTANT = 'sales_assistant',
  LEAD_QUALIFIER = 'lead_qualifier',
  CUSTOMER_SUCCESS = 'customer_success',
  RESEARCH_INTELLIGENCE = 'research_intelligence',
  ADMINISTRATIVE = 'administrative',
  DEAL_ANALYST = 'deal_analyst',
  CONTACT_INTELLIGENCE = 'contact_intelligence',
  COMMUNICATION_MANAGER = 'communication_manager',
  ANALYTICS_EXPERT = 'analytics_expert',
  CALENDAR_ASSISTANT = 'calendar_assistant',
  VIDEO_CREATOR = 'video_creator',
  VOICE_ASSISTANT = 'voice_assistant',
  RISK_ASSESSOR = 'risk_assessor',
  DATA_MANAGER = 'data_manager',
  ACHIEVEMENT_COACH = 'achievement_coach',
  SDR_CAMPAIGN_MANAGER = 'sdr_campaign_manager',
  MEMORY_KEEPER = 'memory_keeper',
  SYSTEM_MONITOR = 'system_monitor',
  PERSONALIZATION_ASSISTANT = 'personalization_assistant'
}

export enum PermissionLevel {
  READ_ONLY = 'read_only',
  READ_WRITE = 'read_write',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LEARNING = 'learning',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

export enum TriggerType {
  DEAL_STAGE_CHANGE = 'deal_stage_change',
  DEAL_AGING = 'deal_aging',
  LEAD_CREATION = 'lead_creation',
  CUSTOMER_ENGAGEMENT = 'customer_engagement',
  TIME_BASED = 'time_based',
  METRIC_THRESHOLD = 'metric_threshold',
  MANUAL = 'manual'
}

export interface AgentPermissions {
  level: PermissionLevel;
  allowedEntities: string[]; // ['contacts', 'deals', 'companies']
  restrictedActions: string[]; // ['delete', 'export']
  dataScope: 'all' | 'owned' | 'team' | 'custom';
  rateLimits: {
    actionsPerHour: number;
    apiCallsPerMinute: number;
  };
  allowedTriggers: TriggerType[];
}

export interface AgentPersonality {
  tone: 'professional' | 'casual' | 'enthusiastic' | 'analytical' | 'cautious' | 'motivational' | 'wise' | 'alert' | 'helpful' | 'organized' | 'creative' | 'friendly' | 'strategic' | 'methodical' | 'insightful';
  communicationStyle: 'concise' | 'detailed' | 'conversational' | 'encouraging' | 'reflective' | 'friendly';
  initiativeLevel: 'reactive' | 'proactive' | 'autonomous';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'low';
  responseLength: 'brief' | 'normal' | 'detailed';
}

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  functionName: string; // Maps to AIFunctionOrchestrator function
  triggers: TriggerCondition[];
  cooldown: number; // minutes between executions
  priority: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  successRate?: number; // Learning metric
}

export interface TriggerCondition {
  type: TriggerType;
  conditions: Record<string, any>;
  cooldown?: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface AgentConfiguration {
  autoStart: boolean;
  workingHours: {
    enabled: boolean;
    timezone: string;
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    daysOfWeek: number[]; // 0-6, Sunday = 0
  };
  notificationPreferences: {
    email: boolean;
    inApp: boolean;
    slack?: string; // webhook URL
    teams?: string; // webhook URL
  };
  performanceTargets: {
    responseTime: number; // seconds
    successRate: number; // percentage
    dailyActions: number;
  };
}

export interface AgentMetrics {
  totalInteractions: number;
  successfulActions: number;
  failedActions: number;
  averageResponseTime: number;
  userSatisfaction: number; // 1-5 scale
  costEfficiency: number; // actions per dollar
  learningProgress: number; // 0-100
  lastActive: Date;
  uptime: number; // percentage
}

export interface ConversationContext {
  id: string;
  userId: string;
  agentId: string;
  messages: ConversationMessage[];
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'archived';
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    functionCalled?: string;
    actionTaken?: string;
    confidence?: number;
    tokens?: number;
    processingTime?: number;
  };
}

export interface AgentMemory {
  shortTerm: ConversationContext[];
  longTerm: LearnedPattern[];
  userPreferences: UserPreference[];
  successPatterns: SuccessPattern[];
  failurePatterns: FailurePattern[];
}

export interface LearnedPattern {
  id: string;
  pattern: string;
  confidence: number;
  successfulOutcomes: number;
  totalOccurrences: number;
  lastUsed: Date;
  category: string;
}

export interface UserPreference {
  key: string;
  value: any;
  confidence: number;
  lastUpdated: Date;
  source: 'explicit' | 'inferred';
}

export interface SuccessPattern {
  trigger: TriggerCondition;
  action: string;
  outcome: string;
  confidence: number;
  occurrences: number;
}

export interface FailurePattern {
  trigger: TriggerCondition;
  action: string;
  error: string;
  lesson: string;
  occurrences: number;
}

export interface AIAgent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  avatar?: string;
  capabilities: AgentCapability[];
  personality: AgentPersonality;
  permissions: AgentPermissions;
  configuration: AgentConfiguration;
  status: AgentStatus;
  metrics: AgentMetrics;
  memory: AgentMemory;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  creatorId: string;
}

export interface AgentExecutionContext {
  agentId: string;
  userId: string;
  sessionId: string;
  trigger: TriggerEvent;
  conversationId?: string;
  permissions: AgentPermissions;
  userPreferences: Record<string, any>;
}

export interface TriggerEvent {
  type: TriggerType;
  entityType?: 'contact' | 'deal' | 'company';
  entityId?: string;
  data: Record<string, any>;
  timestamp: Date;
  source: 'system' | 'user' | 'schedule' | 'api';
}

export interface AgentActionResult {
  success: boolean;
  action: string;
  result: any;
  confidence: number;
  executionTime: number;
  cost?: number;
  tokens?: number;
  error?: string;
  suggestions?: string[];
  nextActions?: AgentAction[];
  metadata: Record<string, any>;
}

export interface AgentAction {
  type: 'function_call' | 'notification' | 'email' | 'task_creation' | 'data_update';
  functionName?: string;
  parameters?: Record<string, any>;
  message?: string;
  priority: 'low' | 'medium' | 'high';
  delay?: number; // milliseconds
  requiresConfirmation?: boolean;
}

export interface AgentCollaboration {
  id: string;
  name: string;
  description: string;
  primaryAgent: string;
  supportingAgents: string[];
  collaborationMode: 'sequential' | 'parallel' | 'hierarchical';
  handoffConditions: HandoffRule[];
  status: 'active' | 'inactive' | 'completed';
  createdAt: Date;
}

export interface HandoffRule {
  fromAgent: string;
  toAgent: string;
  condition: string; // JavaScript expression
  priority: 'low' | 'medium' | 'high';
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  type: AgentType;
  baseConfiguration: Partial<AIAgent>;
  customizationOptions: TemplateCustomization[];
  version: string;
  author: string;
  tags: string[];
  rating: number;
  usageCount: number;
}

export interface TemplateCustomization {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
  defaultValue: any;
  options?: any[];
  validation?: (value: any) => boolean;
  description?: string;
}

// API Response Types
export interface AgentAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  requestId: string;
}

export interface AgentStatusResponse {
  agentId: string;
  status: AgentStatus;
  lastActive: Date;
  currentTask?: string;
  queueLength: number;
  metrics: AgentMetrics;
}

export interface AgentChatResponse {
  messageId: string;
  agentId: string;
  response: string;
  actions?: AgentAction[];
  confidence: number;
  processingTime: number;
}

export interface AgentHistoryResponse {
  conversationId: string;
  messages: ConversationMessage[];
  summary: string;
  duration: number;
  actionCount: number;
}

// WebSocket Event Types
export interface AgentWebSocketEvent {
  type: 'agent:thinking' | 'agent:action' | 'agent:response' | 'agent:error' | 'agent:status';
  agentId: string;
  data: any;
  timestamp: Date;
}

// Learning and Adaptation Types
export interface AgentLearningData {
  interactionId: string;
  input: string;
  output: string;
  outcome: 'success' | 'failure' | 'partial';
  feedback?: number; // 1-5 user rating
  confidence?: number; // AI confidence score
  context: Record<string, any>;
  timestamp: Date;
}

export interface AgentModelUpdate {
  agentId: string;
  modelVersion: string;
  trainingData: AgentLearningData[];
  performanceImprovement: number;
  appliedAt: Date;
}

// Error and Logging Types
export interface AgentError {
  id: string;
  agentId: string;
  errorType: 'execution' | 'permission' | 'rate_limit' | 'network' | 'validation';
  message: string;
  stack?: string;
  context: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolution?: string;
}

export interface AgentAuditLog {
  id: string;
  agentId: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  parameters: Record<string, any>;
  result: 'success' | 'failure';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}