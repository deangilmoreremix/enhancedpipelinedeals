// Re-export types from the main types file
export type {
  Deal,
  DealActivity,
  HealthFactor,
  ProbabilityFactor,
} from '../../../src/types';

// Security & Compliance types (defined here since they don't exist in main types)
export type PermissionLevel = 'none' | 'read' | 'write' | 'delete' | 'admin';
export type PermissionScope = 'global' | 'workspace' | 'object' | 'field' | 'record';

export interface Permission {
  id: string;
  resource: string;
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
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
}

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
  retentionPeriod: number;
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

export interface ExportRequest {
  id: string;
  userId: string;
  workspaceId: string;
  entityType: 'deals' | 'contacts' | 'activities' | 'audit_logs';
  filters: any[];
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
  maxFileSize: number;
  allowedFormats: string[];
  requiresApproval: boolean;
  approvalRoles: string[];
  retentionPeriod: number;
  rateLimit: {
    requests: number;
    period: number;
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

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
  condition: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
  value: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityAction {
  type: 'alert' | 'block' | 'log' | 'notify' | 'revoke_permissions';
  parameters: Record<string, any>;
}

// Backend-specific types
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string; // Updated to support custom roles
  workspaceId: string;
  permissions?: Permission[];
}

export interface RequestContext {
  user?: AuthenticatedUser;
  workspaceId?: string;
}