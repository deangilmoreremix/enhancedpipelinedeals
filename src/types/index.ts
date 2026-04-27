export interface Deal {
  id: string;
  title?: string; // Optional title field for deal naming
  company: string;
  contact: string;
  contactId?: string;
  assignedToId?: string; // Links to team member's contact ID
  assignedTo?: string; // Team member's name for display
  value: number;
  stage: 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability: number;
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  contactAvatar?: string;
  companyAvatar?: string;
  lastActivity?: string;
  tags?: string[];

  // AI and enhanced features
  isFavorite?: boolean;
  customFields?: Record<string, string | number | boolean>;
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    website?: string;
  };
  lastEnrichment?: {
    confidence: number;
    aiProvider?: string;
    timestamp?: Date;
  };
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: string;
  }>;
  links?: Array<{
    title: string;
    url: string;
    type?: string;
    createdAt?: string;
  }>;
  nextFollowUp?: string;
  aiScore?: number;

  // Phase 3 enhancements
  healthScore?: number; // 0-100 health indicator
  healthFactors?: HealthFactor[];
  winProbability?: number; // Advanced probability calculation
  probabilityFactors?: ProbabilityFactor[];
  templateId?: string; // Reference to applied template
  timeline?: DealActivity[];
  lastHealthUpdate?: Date;
  lastProbabilityUpdate?: Date;
}

export interface PipelineColumn {
  id: string;
  title: string;
  dealIds: string[];
  color: string;
}

export interface PipelineStats {
  totalValue: number;
  totalDeals: number;
  averageDealSize: number;
  conversionRate: number;
  stageValues: Record<string, number>;
}

export interface AIInsight {
  dealId: string;
  score: number;
  recommendations: string[];
  riskFactors: string[];
  nextBestActions: string[];
  probability: number;
}

// Phase 3: Deal Management Enhancements
export interface HealthFactor {
  id: string;
  name: string;
  category: 'activity' | 'engagement' | 'progress' | 'timeline' | 'value';
  score: number; // 0-100
  weight: number; // Importance weight for overall health calculation
  description: string;
  isPositive: boolean; // true for positive factors, false for negative
  timestamp: Date;
}

export interface ProbabilityFactor {
  id: string;
  name: string;
  category: 'historical' | 'engagement' | 'competition' | 'market' | 'internal';
  impact: number; // -100 to +100 (negative reduces probability, positive increases)
  confidence: number; // 0-100 confidence in this factor
  description: string;
  data: Record<string, any>; // Supporting data for the factor
  timestamp: Date;
}

export interface DealActivity {
  id: string;
  dealId: string;
  type: 'created' | 'updated' | 'stage_changed' | 'contact_added' | 'note_added' | 'email_sent' | 'meeting_scheduled' | 'task_completed' | 'attachment_added' | 'link_added' | 'probability_updated' | 'health_updated' | 'bulk_action';
  title: string;
  description: string;
  metadata?: Record<string, any>;
  createdBy?: string; // User ID who performed the action
  createdAt: Date;
}

export interface DealTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  templateData: Partial<Deal>;
  isPublic: boolean;
  usageCount: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkDealAction {
  id: string;
  name: string;
  description: string;
  actionType: 'update_field' | 'change_stage' | 'assign_owner' | 'add_tag' | 'remove_tag' | 'add_note' | 'schedule_followup' | 'archive' | 'delete';
  fieldName?: string; // For update_field actions
  fieldValue?: any; // For update_field actions
  targetStage?: string; // For change_stage actions
  targetOwnerId?: string; // For assign_owner actions
  tagsToAdd?: string[]; // For add_tag actions
  tagsToRemove?: string[]; // For remove_tag actions
  noteText?: string; // For add_note actions
  followupDate?: Date; // For schedule_followup actions
  isDestructive: boolean; // Whether this action can cause data loss
}

export interface BulkActionResult {
  dealId: string;
  success: boolean;
  error?: string;
  oldValue?: any;
  newValue?: any;
}

// Phase 7: AI Enhancements Types
export interface DealScoring {
  dealId: string;
  overallScore: number; // 0-100
  qualificationLevel: 'cold' | 'warm' | 'hot' | 'qualified' | 'sales_ready';
  scoringFactors: ScoringFactor[];
  confidence: number; // 0-100 AI confidence in scoring
  lastUpdated: Date;
  aiProvider: string;
  modelVersion: string;
}

export interface ScoringFactor {
  id: string;
  name: string;
  category: 'contact' | 'company' | 'engagement' | 'timeline' | 'competition' | 'market';
  score: number; // 0-100
  weight: number; // Importance multiplier
  evidence: string[];
  reasoning: string;
  confidence: number; // 0-100
}

export interface CompetitorAnalysis {
  dealId: string;
  primaryCompetitors: Competitor[];
  competitivePosition: 'leading' | 'competitive' | 'challenged' | 'losing';
  threats: CompetitiveThreat[];
  opportunities: CompetitiveOpportunity[];
  recommendations: string[];
  lastUpdated: Date;
  confidence: number;
}

export interface Competitor {
  id: string;
  name: string;
  strength: number; // 0-100
  marketShare?: number;
  keyAdvantages: string[];
  keyDisadvantages: string[];
  recentActivity: string[];
  pricingStrategy?: string;
  targetSegments: string[];
}

export interface CompetitiveThreat {
  id: string;
  type: 'pricing' | 'feature' | 'timing' | 'relationship' | 'capability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigationStrategies: string[];
  probability: number; // 0-100
}

export interface CompetitiveOpportunity {
  id: string;
  type: 'gap' | 'weakness' | 'timing' | 'partnership' | 'innovation';
  potential: 'low' | 'medium' | 'high';
  description: string;
  exploitationStrategy: string[];
  expectedValue: number;
}

export interface DealInsights {
  dealId: string;
  progressionInsights: ProgressionInsight[];
  riskAssessments: RiskAssessment[];
  actionRecommendations: ActionRecommendation[];
  predictiveMetrics: PredictiveMetric[];
  communicationSuggestions: CommunicationSuggestion[];
  generatedAt: Date;
  confidence: number;
}

export interface ProgressionInsight {
  id: string;
  insight: string;
  type: 'positive' | 'neutral' | 'concerning';
  category: 'engagement' | 'timeline' | 'stakeholder' | 'competition' | 'market';
  confidence: number;
  supportingEvidence: string[];
  actionable: boolean;
}

export interface RiskAssessment {
  id: string;
  risk: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-100
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategies: string[];
  monitoringRequired: boolean;
}

export interface ActionRecommendation {
  id: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timeframe: 'immediate' | 'this_week' | 'this_month' | 'next_quarter';
  expectedOutcome: string;
  requiredResources: string[];
  successMetrics: string[];
}

export interface PredictiveMetric {
  id: string;
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number; // 0-100
  timeframe: string; // "30 days", "90 days", etc.
  trend: 'increasing' | 'stable' | 'decreasing';
  factors: string[];
}

export interface CommunicationSuggestion {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'follow_up' | 'escalation';
  recipient: string;
  timing: string;
  subject?: string;
  keyPoints: string[];
  tone: 'professional' | 'urgent' | 'casual' | 'motivational';
  expectedResponse: string;
}

export interface AutomatedNote {
  id: string;
  dealId: string;
  contactId: string;
  communicationId: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  actionItems: ActionItem[];
  followUps: FollowUp[];
  tags: string[];
  generatedAt: Date;
  confidence: number;
  aiProvider: string;
}

export interface ActionItem {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface FollowUp {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'task';
  description: string;
  timing: string; // "tomorrow", "next week", etc.
  priority: 'low' | 'medium' | 'high';
}

export interface AIChatbotSession {
  id: string;
  userId: string;
  context: ChatbotContext;
  messages: ChatbotMessage[];
  currentPage?: PageContext;
  activeEntities: ActiveEntity[];
  sessionState: 'active' | 'completed' | 'expired';
  createdAt: Date;
  lastActivity: Date;
  preferences: ChatbotPreferences;
}

export interface ChatbotContext {
  workspaceId: string;
  userRole: string;
  recentActivity: RecentActivity[];
  activeWorkflows: string[];
  availableActions: string[];
  dataScope: Record<string, any>;
}

export interface RecentActivity {
  id: string;
  type: 'deal_created' | 'contact_updated' | 'email_sent' | 'meeting_scheduled';
  entityId: string;
  entityType: string;
  description: string;
  timestamp: Date;
}

export interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    confidence?: number;
    entities?: IdentifiedEntity[];
    actions?: SuggestedAction[];
    dataQueries?: DataQuery[];
  };
}

export interface PageContext {
  route: string;
  entityId?: string;
  entityType?: string;
  viewMode?: string;
  filters?: Record<string, any>;
  selectedItems?: string[];
}

export interface ActiveEntity {
  id: string;
  type: 'deal' | 'contact' | 'company';
  name: string;
  relevance: number; // 0-100
  lastReferenced: Date;
}

export interface ChatbotPreferences {
  responseStyle: 'concise' | 'detailed' | 'conversational';
  dataFormat: 'table' | 'cards' | 'summary';
  notificationLevel: 'minimal' | 'standard' | 'verbose';
  autoActions: boolean;
  language: string;
}

export interface IdentifiedEntity {
  id: string;
  type: string;
  name: string;
  confidence: number;
}

export interface SuggestedAction {
  id: string;
  type: 'create' | 'update' | 'delete' | 'query' | 'navigate' | 'execute_workflow';
  description: string;
  priority: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

export interface DataQuery {
  id: string;
  type: 'count' | 'list' | 'aggregate' | 'search' | 'filter';
  entityType: string;
  filters: Record<string, any>;
  fields: string[];
  limit?: number;
}

export interface NaturalLanguageQuery {
  id: string;
  userId: string;
  query: string;
  parsedIntent: QueryIntent;
  context: QueryContext;
  results: QueryResult[];
  executedAt: Date;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface QueryIntent {
  action: 'find' | 'count' | 'analyze' | 'compare' | 'predict' | 'summarize' | 'create' | 'update' | 'delete';
  entityType: string;
  filters: Record<string, any>;
  aggregations?: string[];
  sorting?: Record<string, 'asc' | 'desc'>;
  limit?: number;
}

export interface QueryContext {
  currentPage?: PageContext;
  activeEntities: ActiveEntity[];
  userPreferences: Record<string, any>;
  recentQueries: string[];
  sessionHistory: QueryHistory[];
}

export interface QueryHistory {
  query: string;
  timestamp: Date;
  success: boolean;
  resultCount: number;
}

export interface QueryResult {
  type: 'data' | 'insight' | 'action' | 'navigation';
  data?: any;
  insight?: string;
  action?: SuggestedAction;
  navigation?: NavigationTarget;
  confidence: number;
}

export interface NavigationTarget {
  route: string;
  params?: Record<string, any>;
  highlightEntity?: string;
}

export interface DataEnrichment {
  id: string;
  entityId: string;
  entityType: 'contact' | 'company' | 'deal';
  enrichmentType: 'social' | 'firmographic' | 'technographic' | 'intent' | 'news';
  source: string;
  data: Record<string, any>;
  confidence: number; // 0-100
  lastUpdated: Date;
  aiProvider: string;
  cost?: number;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

export interface RecordClassification {
  id: string;
  entityId: string;
  entityType: 'contact' | 'company' | 'deal';
  classifications: Classification[];
  primaryCategory: string;
  secondaryCategories: string[];
  confidence: number;
  classifiedAt: Date;
  classifierVersion: string;
}

export interface Classification {
  category: string;
  subcategory?: string;
  confidence: number; // 0-100
  reasoning: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface SummaryGeneration {
  id: string;
  entityId: string;
  entityType: 'contact' | 'company' | 'deal';
  summaryType: 'executive' | 'detailed' | 'bullet_points' | 'timeline' | 'risk_analysis';
  content: string;
  keyInsights: string[];
  recommendations: string[];
  generatedAt: Date;
  aiProvider: string;
  modelVersion: string;
  confidence: number;
  wordCount: number;
}

export interface CustomAIPrompt {
  id: string;
  name: string;
  description: string;
  category: 'scoring' | 'analysis' | 'communication' | 'classification' | 'enrichment' | 'general';
  promptTemplate: string;
  variables: PromptVariable[];
  model: string;
  temperature: number;
  maxTokens: number;
  systemMessage?: string;
  examples?: PromptExample[];
  version: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  performanceMetrics: PromptPerformance;
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: string; // Regex or validation rule
}

export interface PromptExample {
  input: Record<string, any>;
  output: string;
  explanation?: string;
}

export interface PromptPerformance {
  averageResponseTime: number;
  successRate: number;
  averageConfidence: number;
  totalExecutions: number;
  lastExecuted: Date;
  qualityScore: number; // 1-5 based on user feedback
}

// Phase 8: Views & Reporting Types
export type ViewType = 'kanban' | 'table' | 'calendar' | 'timeline' | 'dashboard';

export interface ViewFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface ViewSort {
  field: string;
  direction: 'asc' | 'desc';
  priority: number; // For multi-field sorting
}

export interface ViewColumn {
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean' | 'select' | 'custom';
  width?: number;
  sortable: boolean;
  filterable: boolean;
  visible: boolean;
  format?: string; // For date/number formatting
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  viewType: ViewType;
  filters: ViewFilter[];
  sorting: ViewSort[];
  columns: ViewColumn[];
  groupBy?: string[];
  isDefault: boolean;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  tags?: string[];
}

export interface CustomMetric {
  id: string;
  name: string;
  description: string;
  formula: string; // Mathematical expression or SQL-like query
  parameters: Record<string, any>;
  dataType: 'number' | 'percentage' | 'currency' | 'duration';
  category: 'sales' | 'performance' | 'efficiency' | 'quality' | 'custom';
  visualization: 'number' | 'chart' | 'gauge' | 'progress_bar';
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricValue {
  metricId: string;
  value: number;
  timestamp: Date;
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'kanban' | 'calendar' | 'timeline';
  title: string;
  description?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: Record<string, any>;
  dataSource: {
    type: 'deals' | 'contacts' | 'metrics' | 'custom';
    filters?: ViewFilter[];
    sorting?: ViewSort[];
    limit?: number;
  };
  refreshInterval?: number; // in minutes
  isVisible: boolean;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: 'grid' | 'masonry' | 'freeform';
  theme?: string;
  isDefault: boolean;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  format: 'csv' | 'json' | 'xlsx' | 'pdf' | 'xml';
  fields: string[];
  filters?: ViewFilter[];
  sorting?: ViewSort[];
  includeHeaders: boolean;
  customFormatting?: Record<string, any>;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdvancedFilterGroup {
  id: string;
  name: string;
  filters: ViewFilter[];
  logicalOperator: 'AND' | 'OR';
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface TableViewConfig {
  columns: ViewColumn[];
  pagination: {
    pageSize: number;
    currentPage: number;
  };
  selection: {
    mode: 'single' | 'multiple' | 'none';
    selectedIds: string[];
  };
  grouping?: {
    field: string;
    collapsedGroups: string[];
  };
  density: 'compact' | 'comfortable' | 'spacious';
}

export interface KanbanViewConfig {
  columns: Array<{
    id: string;
    title: string;
    field: string;
    color: string;
    limit?: number;
    wipLimit?: number; // Work in Progress limit
  }>;
  swimlanes?: {
    field: string;
    collapsedLanes: string[];
  };
  cardTemplate: {
    showFields: string[];
    layout: 'compact' | 'detailed';
  };
}

export interface CalendarViewConfig {
  dateField: string;
  viewMode: 'month' | 'week' | 'day' | 'agenda';
  eventTemplate: {
    titleField: string;
    descriptionField?: string;
    colorField?: string;
    startTimeField?: string;
    endTimeField?: string;
  };
  filters: ViewFilter[];
}

export interface ReportConfig {
  id: string;
  name: string;
  description?: string;
  type: 'summary' | 'detailed' | 'comparative' | 'trend' | 'custom';
  dataSource: {
    entity: 'deals' | 'contacts' | 'activities';
    filters: ViewFilter[];
    groupBy?: string[];
    aggregations?: Array<{
      field: string;
      function: 'count' | 'sum' | 'avg' | 'min' | 'max';
      alias?: string;
    }>;
  };
  visualization: {
    type: 'table' | 'chart' | 'dashboard';
    config: Record<string, any>;
  };
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    format: 'email' | 'pdf' | 'excel';
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Phase 10: Security & Compliance Types

// Permissions and RBAC
export type PermissionLevel = 'none' | 'read' | 'write' | 'delete' | 'admin';
export type PermissionScope = 'global' | 'workspace' | 'object' | 'field' | 'record';

export interface Permission {
  id: string;
  resource: string; // 'deals', 'contacts', 'reports', etc.
  scope: PermissionScope;
  level: PermissionLevel;
  conditions?: PermissionCondition[];
  restrictions?: PermissionRestriction[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'regex';
  value: any;
}

export interface PermissionRestriction {
  type: 'field_mask' | 'record_filter' | 'time_limit' | 'ip_restriction';
  value: any;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean;
  workspaceId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  workspaceId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
}

// Audit Trails
export type AuditEventType =
  | 'user_login'
  | 'user_logout'
  | 'data_access'
  | 'data_modify'
  | 'data_delete'
  | 'permission_change'
  | 'role_change'
  | 'export_request'
  | 'export_complete'
  | 'gdpr_request'
  | 'security_alert'
  | 'system_config_change';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  userId?: string;
  workspaceId: string;
  resource: string;
  resourceId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  sessionId?: string;
  complianceFlags?: string[];
}

export interface AuditLog {
  id: string;
  events: AuditEvent[];
  retentionPeriod: number; // days
  compressed: boolean;
  createdAt: Date;
}

// SSO Integration
export interface SSOConfig {
  id: string;
  workspaceId: string;
  provider: 'saml' | 'oidc' | 'google' | 'microsoft' | 'okta';
  config: SAMLConfig | OIDCConfig;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
  logoutUrl?: string;
  nameIdFormat?: string;
  attributeMapping: Record<string, string>;
}

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  attributeMapping: Record<string, string>;
}

// GDPR Compliance
export interface GDPRRequest {
  id: string;
  userId: string;
  workspaceId: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  data?: any;
  requestedAt: Date;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
}

export interface DataRetentionPolicy {
  id: string;
  name: string;
  description: string;
  entityType: 'deals' | 'contacts' | 'activities' | 'audit_logs';
  retentionPeriod: number; // days
  deletionMethod: 'hard_delete' | 'soft_delete' | 'anonymize';
  conditions?: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataProcessingRecord {
  id: string;
  purpose: string;
  legalBasis: 'consent' | 'contract' | 'legitimate_interest' | 'legal_obligation' | 'public_task' | 'vital_interest';
  dataCategories: string[];
  recipients: string[];
  retentionPeriod: number;
  securityMeasures: string[];
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Data Export Controls
export interface ExportRequest {
  id: string;
  userId: string;
  workspaceId: string;
  entityType: 'deals' | 'contacts' | 'activities' | 'audit_logs';
  filters: ViewFilter[];
  fields: string[];
  format: 'csv' | 'json' | 'xlsx' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  expiresAt?: Date;
  requestedAt: Date;
  completedAt?: Date;
  recordCount?: number;
  fileSize?: number;
}

export interface ExportPolicy {
  id: string;
  name: string;
  description: string;
  entityType: string;
  maxRecords: number;
  maxFileSize: number; // MB
  allowedFormats: string[];
  requiresApproval: boolean;
  approvalRoles: string[];
  retentionPeriod: number; // hours
  rateLimit: {
    requests: number;
    period: number; // minutes
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Security Monitoring
export interface SecurityAlert {
  id: string;
  type: 'suspicious_login' | 'unusual_activity' | 'data_breach_attempt' | 'permission_violation' | 'export_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  workspaceId: string;
  userId?: string;
  details: Record<string, any>;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  actions: string[];
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  actions: SecurityAction[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityRule {
  condition: string; // Expression or condition
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityAction {
  type: 'alert' | 'block' | 'log' | 'notify' | 'revoke_permissions';
  parameters: Record<string, any>;
}

// Data Governance
export interface DataClassification {
  id: string;
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  name: string;
  description: string;
  handlingRequirements: string[];
  retentionPeriod: number;
  encryptionRequired: boolean;
  accessRequirements: string[];
}

export interface DataLineage {
  id: string;
  entityId: string;
  entityType: string;
  source: string;
  transformations: DataTransformation[];
  destinations: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataTransformation {
  type: 'enrichment' | 'normalization' | 'aggregation' | 'filtering' | 'anonymization';
  description: string;
  parameters: Record<string, any>;
  timestamp: Date;
  performedBy: string;
}