/**
 * Zod Schemas for SDR Orchestrator System
 * Runtime type validation for all data boundaries
 */

import { z } from 'zod';

// ============================================================================
// PRIMITIVE SCHEMAS
// ============================================================================

export const EmailSchema = z.string().email().max(254);
export const UUIDSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const NonEmptyStringSchema = z.string().min(1).max(10000);

// ============================================================================
// CONTACT SCHEMAS
// ============================================================================

export const ContactStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
  'nurture',
]);

export const ContactSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(255).optional(),
  email: EmailSchema.optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  status: ContactStatusSchema.optional(),
  lead_score: z.number().int().min(0).max(100).optional(),
  active_deal_id: UUIDSchema.optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

export const CreateContactInputSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  status: z.literal('new').optional(),
});

// ============================================================================
// DEAL SCHEMAS
// ============================================================================

export const DealStageSchema = z.enum([
  'new',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

export const DealSchema = z.object({
  id: UUIDSchema,
  deal_name: z.string().max(255).optional(),
  value: z.number().min(0).optional(),
  stage: DealStageSchema.optional(),
  description: z.string().max(5000).optional(),
  risk_score: z.number().min(0).max(100).optional(),
  contact_id: UUIDSchema.optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

// ============================================================================
// AGENT SCHEMAS
// ============================================================================

export const AgentWorkflowStepSchema = z.object({
  step: z.number().int().min(0),
  action: z.string().max(255),
  condition: z.string().max(1000).optional(),
  delay_hours: z.number().int().min(0).optional(),
});

export const AgentSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  objectives: z.array(z.string().max(500)).max(50),
  workflow: z.array(AgentWorkflowStepSchema).max(100),
  status: z.enum(['active', 'inactive', 'paused']).optional(),
  version: z.string().max(50).optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

export const AgentPersonaSchema = z.object({
  id: UUIDSchema,
  persona_prompt: z.string().min(1).max(10000),
  tone: z.enum(['professional', 'casual', 'friendly', 'formal', 'enthusiastic']).optional(),
  style: z.string().max(255).optional(),
  created_at: TimestampSchema.optional(),
});

// ============================================================================
// ACTIVITY SCHEMAS
// ============================================================================

export const ActivityTypeSchema = z.enum([
  'SDR_EMAIL_RESPONSE',
  'SDR_CALL_MADE',
  'SDR_MEETING_SCHEDULED',
  'SDR_FOLLOWUP_SENT',
  'followup_created',
  'automation_scheduled',
  'journey_event',
  'status_change',
  'note_added',
  'email_received',
  'email_sent',
]);

export const ActivitySchema = z.object({
  id: UUIDSchema.optional(),
  contact_id: UUIDSchema,
  type: ActivityTypeSchema,
  message: z.string().max(10000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  created_at: TimestampSchema.optional(),
  updated_at: TimestampSchema.optional(),
});

// ============================================================================
// EMAIL SCHEMAS
// ============================================================================

export const IncomingEmailSchema = z.object({
  from: z.string().email().max(254),
  subject: z.string().max(1000),
  body: z.string().max(50000),
  contactId: UUIDSchema.optional(),
  messageId: z.string().max(500).optional(),
  receivedAt: TimestampSchema.optional(),
});

export const EmailBatchSchema = z.object({
  emails: z.array(IncomingEmailSchema).min(1).max(100),
  defaultAgentId: z.string().max(255).optional(),
});

export const EmailDataSchema = z.object({
  to: EmailSchema,
  subject: z.string().min(1).max(1000),
  body: z.string().min(1).max(50000),
  cc: z.array(EmailSchema).max(50).optional(),
  bcc: z.array(EmailSchema).max(50).optional(),
  replyTo: EmailSchema.optional(),
});

// ============================================================================
// SDR ORCHESTRATOR INPUT SCHEMAS
// ============================================================================

export const RunSDRInputSchema = z.object({
  contactId: UUIDSchema,
  incomingMessage: z.string().min(1).max(10000),
  agentId: UUIDSchema,
  correlationId: z.string().max(100).optional(),
});

export const ProcessSDRBatchInputSchema = z.object({
  emails: z.array(IncomingEmailSchema).min(1).max(50),
  defaultAgentId: z.string().max(255).optional(),
  maxConcurrency: z.number().int().min(1).max(20).optional(),
});

export const RecommendAgentInputSchema = z.object({
  contactId: UUIDSchema,
  dealStage: DealStageSchema.optional(),
  leadScore: z.number().int().min(0).max(100).optional(),
  recentActivity: z.array(z.string().max(1000)).max(100).optional(),
});

// ============================================================================
// MCP TOOL INPUT SCHEMAS
// ============================================================================

export const SaveActivityInputSchema = z.object({
  contact_id: UUIDSchema,
  type: ActivityTypeSchema,
  message: z.string().min(1).max(10000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateContactStatusInputSchema = z.object({
  contact_id: UUIDSchema,
  status: ContactStatusSchema,
});

export const WriteLeadScoreInputSchema = z.object({
  contact_id: UUIDSchema,
  score: z.number().int().min(0).max(100),
});

export const CreateFollowupInputSchema = z.object({
  contact_id: UUIDSchema,
  due_date: TimestampSchema.optional(),
  note: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

export const ScheduleStepInputSchema = z.object({
  contact_id: UUIDSchema,
  step_name: z.string().min(1).max(255),
  delay_hours: z.number().int().min(0).max(8760),
});

export const TriggerEventInputSchema = z.object({
  contact_id: UUIDSchema,
  event_name: z.string().min(1).max(255),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// Safe supabase query parameters with allowed tables and columns
const ALLOWED_TABLES = new Set([
  'contacts', 'deals', 'activities', 'agent_metrics',
  'agent_metadata', 'sdr_personas', 'contact_agent_assignment'
]);

const ALLOWED_COLUMNS = new Set([
  'id', 'name', 'email', 'company', 'title', 'status', 'lead_score',
  'deal_name', 'value', 'stage', 'contact_id', 'type', 'message',
  'agent_id', 'persona_id', 'created_at', 'updated_at'
]);

export const SupabaseQueryInputSchema = z.object({
  table: z.string().superRefine((val, ctx) => {
    if (!ALLOWED_TABLES.has(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Table '${val}' is not in the allowed list`,
      });
    }
  }),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  select: z.string().superRefine((val, ctx) => {
    if (val !== '*') {
      const columns = val.split(',').map(c => c.trim());
      const invalid = columns.filter(c => !ALLOWED_COLUMNS.has(c) && !c.includes('(') && !c.includes('.'));
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid columns: ${invalid.join(', ')}`,
        });
      }
    }
  }).default('*'),
  limit: z.number().int().min(1).max(1000).optional(),
  orderBy: z.object({
    column: z.string(),
    ascending: z.boolean().optional(),
  }).optional(),
});

export const SupabaseUpdateInputSchema = z.object({
  table: z.string().superRefine((val, ctx) => {
    if (!ALLOWED_TABLES.has(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Table '${val}' is not in the allowed list`,
      });
    }
  }),
  id: UUIDSchema,
  updates: z.record(z.string(), z.unknown()).superRefine((updates, ctx) => {
    const sensitiveFields = ['password', 'secret', 'token', 'api_key'];
    const keys = Object.keys(updates);
    const hasSensitive = keys.some(key => 
      sensitiveFields.some(sensitive => key.toLowerCase().includes(sensitive))
    );
    if (hasSensitive) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Updates contain sensitive fields that cannot be modified',
      });
    }
  }),
});

export const BrowserSearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  maxResults: z.number().int().min(1).max(100).optional(),
});

// ============================================================================
// SDR CONTEXT AND RESULT SCHEMAS
// ============================================================================

export const SDRContactSchema = z.object({
  id: UUIDSchema,
  name: z.string().max(255),
  email: EmailSchema,
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  status: z.string().max(50).optional(),
  lead_score: z.number().int().min(0).max(100).optional(),
  active_deal_id: UUIDSchema.optional(),
});

export const SDRDealSchema = z.object({
  id: UUIDSchema,
  deal_name: z.string().max(255).optional(),
  value: z.number().min(0).optional(),
  stage: z.string().max(50).optional(),
  description: z.string().max(5000).optional(),
  risk_score: z.number().min(0).max(100).optional(),
  contact_id: UUIDSchema.optional(),
});

export const SDRContextSchema = z.object({
  contactId: UUIDSchema.optional(),
  dealId: UUIDSchema.optional(),
  contact: SDRContactSchema.optional(),
  deal: SDRDealSchema.optional(),
  customPrompts: z.record(z.string(), z.string().max(10000)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SDRAgentResultSchema = z.object({
  success: z.boolean(),
  action: z.string().max(255),
  message: z.string().max(50000).optional(),
  emailData: EmailDataSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  error: z.string().max(5000).optional(),
});

export const SDRMetricsSchema = z.object({
  totalRuns: z.number().int().min(0),
  successfulRuns: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  averageResponseTime: z.number().min(0),
  lastRunAt: z.date().optional(),
  errorRate: z.number().min(0).max(1),
});

// ============================================================================
// MCP TOOL NAME SCHEMA
// ============================================================================

export const MCPToolNameSchema = z.enum([
  'SmartCRMTools.save_activity',
  'SmartCRMTools.update_contact_status',
  'SmartCRMTools.write_score',
  'SmartCRMTools.create_followup',
  'SmartCRMTools.schedule_step',
  'SmartCRMTools.trigger_event',
  'Supabase.query',
  'Supabase.update',
  'Browser.search',
]);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Contact = z.infer<typeof ContactSchema>;
export type Deal = z.infer<typeof DealSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type IncomingEmail = z.infer<typeof IncomingEmailSchema>;
export type EmailData = z.infer<typeof EmailDataSchema>;
export type RunSDRInput = z.infer<typeof RunSDRInputSchema>;
export type SDRContext = z.infer<typeof SDRContextSchema>;
export type SDRAgentResult = z.infer<typeof SDRAgentResultSchema>;
export type MCPToolName = z.infer<typeof MCPToolNameSchema>;
export type ContactStatus = z.infer<typeof ContactStatusSchema>;
export type DealStage = z.infer<typeof DealStageSchema>;
export type ActivityType = z.infer<typeof ActivityTypeSchema>;
