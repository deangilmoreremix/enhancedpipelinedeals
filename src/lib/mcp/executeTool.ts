/**
 * Production-Hardened MCP Tool Executor for SmartCRM
 * Features: SQL injection prevention, Zod validation, timeouts, circuit breakers, rate limiting
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { enhancedLogger, withLogContext, createCorrelationId } from "../core/enhancedLogger";
import {
  withResilience,
  withRetry,
  withTimeout,
  circuitBreakers,
  timeouts,
  retryPolicies,
  CircuitBreaker,
  RateLimiter,
  TimeoutError,
} from "../core/resilience";
import {
  MCPToolNameSchema,
  SaveActivityInputSchema,
  UpdateContactStatusInputSchema,
  WriteLeadScoreInputSchema,
  CreateFollowupInputSchema,
  ScheduleStepInputSchema,
  TriggerEventInputSchema,
  SupabaseQueryInputSchema,
  SupabaseUpdateInputSchema,
  BrowserSearchInputSchema,
  type MCPToolName,
} from "../schemas/sdrSchemas";

// ============================================================================
// DATABASE CLIENT WITH CONNECTION POOLING
// ============================================================================

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured");
    }
    
    supabaseInstance = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: 'public' },
    });
  }
  return supabaseInstance;
}

// ============================================================================
// RATE LIMITERS
// ============================================================================

const rateLimiters = {
  supabase: new RateLimiter({ maxRequests: 1000, windowMs: 60000 }),
  browser: new RateLimiter({ maxRequests: 50, windowMs: 60000 }),
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ToolContext {
  correlationId: string;
  toolName: string;
  abortSignal: AbortSignal;
}

type ToolExecutor<TInput, TOutput> = (params: TInput, context: ToolContext) => Promise<TOutput>;

// ============================================================================
// MAIN TOOL EXECUTOR WITH FULL RESILIENCE
// ============================================================================

export async function executeMCPTool(
  toolName: string,
  params: unknown,
  options: {
    correlationId?: string;
    timeoutMs?: number;
    skipValidation?: boolean;
  } = {}
): Promise<unknown> {
  const correlationId = options.correlationId || createCorrelationId();
  const abortController = new AbortController();
  
  // Set default timeout
  const timeoutMs = options.timeoutMs || 30000;
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  return withLogContext({ correlationId, operation: `mcp-${toolName}` }, async () => {
    try {
      enhancedLogger.info(`Executing MCP tool`, { toolName, timeoutMs });

      // Validate tool name
      let validatedToolName: MCPToolName;
      try {
        validatedToolName = MCPToolNameSchema.parse(toolName);
      } catch (validationError) {
        throw new MCPToolValidationError(
          `Invalid tool name: ${toolName}`,
          { toolName, error: (validationError as Error).message }
        );
      }

      // Validate params if not skipped
      let validatedParams: unknown;
      if (!options.skipValidation) {
        validatedParams = validateToolParams(validatedToolName, params);
      } else {
        validatedParams = params;
      }

      const context: ToolContext = {
        correlationId,
        toolName: validatedToolName,
        abortSignal: abortController.signal,
      };

      // Execute tool with circuit breaker and retry
      const result = await executeWithResilience(validatedToolName, validatedParams, context);

      enhancedLogger.info(`MCP tool executed successfully`, { toolName, correlationId });
      return result;

    } catch (error) {
      enhancedLogger.error(`MCP tool execution failed`, {
        toolName,
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

// ============================================================================
// TOOL PARAMETER VALIDATION
// ============================================================================

function validateToolParams(toolName: MCPToolName, params: unknown): unknown {
  switch (toolName) {
    case 'SmartCRMTools.save_activity':
      return SaveActivityInputSchema.parse(params);
    case 'SmartCRMTools.update_contact_status':
      return UpdateContactStatusInputSchema.parse(params);
    case 'SmartCRMTools.write_score':
      return WriteLeadScoreInputSchema.parse(params);
    case 'SmartCRMTools.create_followup':
      return CreateFollowupInputSchema.parse(params);
    case 'SmartCRMTools.schedule_step':
      return ScheduleStepInputSchema.parse(params);
    case 'SmartCRMTools.trigger_event':
      return TriggerEventInputSchema.parse(params);
    case 'Supabase.query':
      return SupabaseQueryInputSchema.parse(params);
    case 'Supabase.update':
      return SupabaseUpdateInputSchema.parse(params);
    case 'Browser.search':
      return BrowserSearchInputSchema.parse(params);
    default:
      throw new MCPToolValidationError(`Unknown tool: ${toolName}`);
  }
}

class MCPToolValidationError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'MCPToolValidationError';
  }
}

// ============================================================================
// RESILIENCE WRAPPER
// ============================================================================

async function executeWithResilience(
  toolName: MCPToolName,
  params: unknown,
  context: ToolContext
): Promise<unknown> {
  // Determine resilience strategy based on tool type
  if (toolName.startsWith('SmartCRMTools.') || toolName.startsWith('Supabase.')) {
    return withResilience(
      async (signal) => {
        await rateLimiters.supabase.acquire(context.correlationId);
        return executeToolByName(toolName, params, { ...context, abortSignal: signal });
      },
      {
        timeout: timeouts.db,
        retry: retryPolicies.db,
        circuitBreaker: circuitBreakers.supabase,
      }
    );
  }

  if (toolName.startsWith('Browser.')) {
    return withResilience(
      async (signal) => {
        await rateLimiters.browser.acquire(context.correlationId);
        return executeToolByName(toolName, params, { ...context, abortSignal: signal });
      },
      {
        timeout: timeouts.default,
        retry: retryPolicies.api,
      }
    );
  }

  return executeToolByName(toolName, params, context);
}

// ============================================================================
// TOOL ROUTER
// ============================================================================

async function executeToolByName(
  toolName: MCPToolName,
  params: unknown,
  context: ToolContext
): Promise<unknown> {
  switch (toolName) {
    case 'SmartCRMTools.save_activity':
      return await executeSaveActivity(params as { contact_id: string; type: string; message: string; metadata?: Record<string, unknown> }, context);
    case 'SmartCRMTools.update_contact_status':
      return await executeUpdateContactStatus(params as { contact_id: string; status: string }, context);
    case 'SmartCRMTools.write_score':
      return await executeWriteLeadScore(params as { contact_id: string; score: number }, context);
    case 'SmartCRMTools.create_followup':
      return await executeCreateFollowup(params as { contact_id: string; due_date?: string; note?: string; priority?: string }, context);
    case 'SmartCRMTools.schedule_step':
      return await executeScheduleStep(params as { contact_id: string; step_name: string; delay_hours: number }, context);
    case 'SmartCRMTools.trigger_event':
      return await executeTriggerEvent(params as { contact_id: string; event_name: string; payload?: Record<string, unknown> }, context);
    case 'Supabase.query':
      return await executeSupabaseQuery(params as { table: string; filters?: Record<string, string | number | boolean>; select?: string; limit?: number; orderBy?: { column: string; ascending?: boolean } }, context);
    case 'Supabase.update':
      return await executeSupabaseUpdate(params as { table: string; id: string; updates: Record<string, unknown> }, context);
    case 'Browser.search':
      return await executeBrowserSearch(params as { query: string; maxResults?: number }, context);
    default:
      throw new MCPToolValidationError(`Tool not implemented: ${toolName}`);
  }
}

// ============================================================================
// SMARTCRM TOOLS
// ============================================================================

async function executeSaveActivity(
  params: { contact_id: string; type: string; message: string; metadata?: Record<string, unknown> },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();

  enhancedLogger.info(`Saving activity`, {
    correlationId: context.correlationId,
    contactId: params.contact_id,
    type: params.type,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  const { data, error } = await supabase
    .from("activities")
    .insert({
      contact_id: params.contact_id,
      type: params.type,
      message: params.message,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    enhancedLogger.error(`Failed to save activity`, {
      correlationId: context.correlationId,
      error: error.message,
    });
    throw new Error(`Failed to save activity: ${error.message}`);
  }

  enhancedLogger.info(`Activity saved successfully`, {
    correlationId: context.correlationId,
    activityId: data.id,
  });

  return { success: true, activityId: data.id };
}

async function executeUpdateContactStatus(
  params: { contact_id: string; status: string },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();

  enhancedLogger.info(`Updating contact status`, {
    correlationId: context.correlationId,
    contactId: params.contact_id,
    status: params.status,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  const { data, error } = await supabase
    .from("contacts")
    .update({ 
      status: params.status, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", params.contact_id)
    .select()
    .single();

  if (error) {
    enhancedLogger.error(`Failed to update contact status`, {
      correlationId: context.correlationId,
      error: error.message,
    });
    throw new Error(`Failed to update contact status: ${error.message}`);
  }

  return { success: true, contact: data };
}

async function executeWriteLeadScore(
  params: { contact_id: string; score: number },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();

  enhancedLogger.info(`Updating lead score`, {
    correlationId: context.correlationId,
    contactId: params.contact_id,
    score: params.score,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  const { data, error } = await supabase
    .from("contacts")
    .update({
      lead_score: params.score,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.contact_id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update lead score: ${error.message}`);
  }

  return { success: true, contact: data };
}

async function executeCreateFollowup(
  params: { contact_id: string; due_date?: string; note?: string; priority?: string },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();

  enhancedLogger.info(`Creating follow-up`, {
    correlationId: context.correlationId,
    contactId: params.contact_id,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  const { data, error } = await supabase
    .from("activities")
    .insert({
      contact_id: params.contact_id,
      type: "followup_created",
      message: `Follow-up scheduled${params.note ? `: ${params.note}` : ''}${params.due_date ? ` (Due: ${params.due_date})` : ''}`,
      metadata: { priority: params.priority || 'medium', due_date: params.due_date },
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create follow-up: ${error.message}`);
  }

  return { success: true, followupId: data.id };
}

async function executeScheduleStep(
  params: { contact_id: string; step_name: string; delay_hours: number },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();
  const scheduledTime = new Date(Date.now() + (params.delay_hours * 60 * 60 * 1000));

  enhancedLogger.info(`Scheduling automation step`, {
    correlationId: context.correlationId,
    contactId: params.contact_id,
    stepName: params.step_name,
    scheduledTime: scheduledTime.toISOString(),
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  const { data, error } = await supabase
    .from("activities")
    .insert({
      contact_id: params.contact_id,
      type: "automation_scheduled",
      message: `Automation step '${params.step_name}' scheduled for ${scheduledTime.toISOString()}`,
      metadata: { step_name: params.step_name, delay_hours: params.delay_hours },
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to schedule step: ${error.message}`);
  }

  return { success: true, scheduledId: data.id, scheduledTime };
}

async function executeTriggerEvent(
  params: { contact_id: string; event_name: string; payload?: Record<string, unknown> },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();

  enhancedLogger.info(`Triggering journey event`, {
    correlationId: context.correlationId,
    contactId: params.contact_id,
    eventName: params.event_name,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  const { data, error } = await supabase
    .from("activities")
    .insert({
      contact_id: params.contact_id,
      type: "journey_event",
      message: `Journey event triggered: ${params.event_name}`,
      metadata: { event_name: params.event_name, payload: params.payload },
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to trigger event: ${error.message}`);
  }

  return { success: true, eventId: data.id };
}

// ============================================================================
// SUPABASE TOOLS (SQL INJECTION SAFE)
// ============================================================================

// Whitelist of allowed tables for queries
const ALLOWED_TABLES = new Set([
  'contacts', 'deals', 'activities', 'agent_metrics',
  'agent_metadata', 'sdr_personas', 'contact_agent_assignment'
]);

// Whitelist of allowed columns
const ALLOWED_COLUMNS = new Set([
  'id', 'name', 'email', 'company', 'title', 'status', 'lead_score',
  'deal_name', 'value', 'stage', 'contact_id', 'type', 'message',
  'agent_id', 'persona_id', 'created_at', 'updated_at', 'description',
  'risk_score', 'active_deal_id'
]);

async function executeSupabaseQuery(
  params: { table: string; filters?: Record<string, string | number | boolean>; select?: string; limit?: number; orderBy?: { column: string; ascending?: boolean } },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();

  // Validate table name against whitelist (prevents SQL injection via table name)
  if (!ALLOWED_TABLES.has(params.table)) {
    throw new MCPToolValidationError(
      `Table '${params.table}' is not in the allowed list`,
      { allowedTables: Array.from(ALLOWED_TABLES) }
    );
  }

  // Validate column selection (prevents SQL injection via column names)
  const selectColumns = params.select || '*';
  if (selectColumns !== '*') {
    const columns = selectColumns.split(',').map(c => c.trim().split('(')[0]);
    const invalidColumns = columns.filter(c => !ALLOWED_COLUMNS.has(c) && !c.includes('*'));
    if (invalidColumns.length > 0) {
      throw new MCPToolValidationError(
        `Invalid columns in select: ${invalidColumns.join(', ')}`,
        { allowedColumns: Array.from(ALLOWED_COLUMNS) }
      );
    }
  }

  enhancedLogger.info(`Executing Supabase query`, {
    correlationId: context.correlationId,
    table: params.table,
    select: selectColumns,
    filterCount: Object.keys(params.filters || {}).length,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  // Build query using Supabase's parameterized query builder (SQL injection safe)
  let query = supabase.from(params.table).select(selectColumns);

  // Apply filters safely using Supabase's eq() method
  // This uses parameterized queries under the hood, preventing SQL injection
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      // Validate filter key is not malicious
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new MCPToolValidationError(
          `Invalid filter key: ${key}`,
          { key }
        );
      }
      query = query.eq(key, value);
    }
  }

  // Apply limit
  if (params.limit) {
    query = query.limit(Math.min(params.limit, 1000));
  }

  // Apply ordering
  if (params.orderBy) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(params.orderBy.column)) {
      throw new MCPToolValidationError(
        `Invalid order column: ${params.orderBy.column}`
      );
    }
    query = query.order(params.orderBy.column, {
      ascending: params.orderBy.ascending ?? false
    });
  }

  const { data, error } = await query;

  if (error) {
    enhancedLogger.error(`Supabase query failed`, {
      correlationId: context.correlationId,
      error: error.message,
      code: error.code,
    });
    throw new Error(`Database query failed: ${error.message}`);
  }

  enhancedLogger.info(`Supabase query executed successfully`, {
    correlationId: context.correlationId,
    table: params.table,
    count: data?.length || 0,
  });

  return { data: data || [], count: data?.length || 0 };
}

async function executeSupabaseUpdate(
  params: { table: string; id: string; updates: Record<string, unknown> },
  context: ToolContext
): Promise<unknown> {
  const supabase = getSupabaseClient();

  // Validate table name
  if (!ALLOWED_TABLES.has(params.table)) {
    throw new MCPToolValidationError(
      `Table '${params.table}' is not in the allowed list`
    );
  }

  // Prevent updates to sensitive fields
  const sensitiveFields = ['password', 'secret', 'token', 'api_key', 'private_key'];
  const updateKeys = Object.keys(params.updates).map(k => k.toLowerCase());
  const hasSensitive = updateKeys.some(key => 
    sensitiveFields.some(sensitive => key.includes(sensitive))
  );
  
  if (hasSensitive) {
    throw new MCPToolValidationError(
      'Updates contain sensitive fields that cannot be modified'
    );
  }

  enhancedLogger.info(`Executing Supabase update`, {
    correlationId: context.correlationId,
    table: params.table,
    id: params.id,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  const { data, error } = await supabase
    .from(params.table)
    .update({
      ...params.updates,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }

  return { success: true, data };
}

// ============================================================================
// BROWSER TOOLS
// ============================================================================

async function executeBrowserSearch(
  params: { query: string; maxResults?: number },
  context: ToolContext
): Promise<unknown> {
  enhancedLogger.info(`Executing browser search`, {
    correlationId: context.correlationId,
    queryLength: params.query.length,
    maxResults: params.maxResults || 10,
  });

  if (context.abortSignal.aborted) {
    throw new Error('Operation was aborted');
  }

  // In production, this would use a real browser automation tool
  // with proper rate limiting and security controls

  return {
    results: [
      {
        title: "Sample Search Result",
        url: "https://example.com",
        snippet: "This is a simulated search result"
      }
    ],
    count: 1,
    query: params.query.slice(0, 100), // Log-safe query
  };
}

// ============================================================================
// BATCH EXECUTION
// ============================================================================

export async function executeMCPToolBatch(
  tools: Array<{ toolName: string; params: unknown }>,
  options: {
    correlationId?: string;
    maxConcurrency?: number;
    continueOnError?: boolean;
  } = {}
): Promise<Array<{ toolName: string; success: boolean; result?: unknown; error?: string }>> {
  const correlationId = options.correlationId || createCorrelationId();
  const maxConcurrency = options.maxConcurrency || 5;
  const continueOnError = options.continueOnError ?? true;

  enhancedLogger.info(`Executing MCP tool batch`, {
    correlationId,
    toolCount: tools.length,
    maxConcurrency,
    continueOnError,
  });

  const results: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }> = [];
  
  // Process in chunks to limit concurrency
  for (let i = 0; i < tools.length; i += maxConcurrency) {
    const chunk = tools.slice(i, i + maxConcurrency);
    
    const chunkResults = await Promise.all(
      chunk.map(async ({ toolName, params }) => {
        try {
          const result = await executeMCPTool(toolName, params, { correlationId });
          return { toolName, success: true, result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!continueOnError) {
            throw error;
          }
          return { toolName, success: false, error: errorMessage };
        }
      })
    );
    
    results.push(...chunkResults);
  }

  const successCount = results.filter(r => r.success).length;
  enhancedLogger.info(`MCP tool batch completed`, {
    correlationId,
    total: tools.length,
    successful: successCount,
    failed: tools.length - successCount,
  });

  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MCPToolValidationError };
export type { ToolContext };
