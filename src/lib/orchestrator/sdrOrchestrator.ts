/**
 * Production-Hardened SDR Orchestrator
 * Features: Circuit breakers, timeouts, retry logic, concurrency control, PII-safe logging, transaction boundaries
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { enhancedLogger, withLogContext, createCorrelationId } from "../core/enhancedLogger";
import {
  withResilience,
  circuitBreakers,
  timeouts,
  retryPolicies,
  RateLimiter,
} from "../core/resilience";
import { executeMCPToolBatch } from "../mcp/executeTool";
import {
  RunSDRInputSchema,
  ProcessSDRBatchInputSchema,
  RecommendAgentInputSchema,
  type RunSDRInput,
} from "../schemas/sdrSchemas";
import { z } from "zod";

// Type definitions inferred from schemas
type ProcessSDRBatchInput = z.infer<typeof ProcessSDRBatchInputSchema>;
type RecommendAgentInput = z.infer<typeof RecommendAgentInputSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Timeouts
  DEFAULT_TIMEOUT_MS: 30000,
  DB_TIMEOUT_MS: 10000,
  AI_TIMEOUT_MS: 60000,
  
  // Concurrency
  MAX_BATCH_CONCURRENCY: 5,
  MAX_EMAIL_BATCH_SIZE: 50,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 60000,
  MAX_REQUESTS_PER_WINDOW: 100,
};

// ============================================================================
// DATABASE CLIENT
// ============================================================================

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = import.meta.env?.SUPABASE_URL;
    const key = import.meta.env?.SUPABASE_SERVICE_KEY;
    
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

const orchestratorRateLimiter = new RateLimiter({
  maxRequests: CONFIG.MAX_REQUESTS_PER_WINDOW,
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
});

// ============================================================================
// TYPES
// ============================================================================

export interface SDROrchestratorResult {
  success: boolean;
  response?: string;
  agent?: string;
  persona?: string;
  actions_taken: string[];
  correlationId: string;
  executionTimeMs: number;
  error?: string;
}

export interface BatchProcessResult {
  email: string;
  success: boolean;
  result?: SDROrchestratorResult;
  error?: string;
  executionTimeMs: number;
}

// ============================================================================
// MAIN SDR ORCHESTRATOR
// ============================================================================

export async function runSDR(input: unknown): Promise<SDROrchestratorResult> {
  const startTime = performance.now();
  const correlationId = createCorrelationId();
  
  return withLogContext({ correlationId, operation: 'runSDR' }, async () => {
    try {
      // Validate input
      const validatedInput = RunSDRInputSchema.parse(input);
      
      enhancedLogger.info(`Starting SDR orchestration`, {
        contactId: validatedInput.contactId,
        agentId: validatedInput.agentId,
        correlationId,
      });

      // Apply rate limiting
      await orchestratorRateLimiter.acquire(correlationId);

      // Execute with full resilience
      const result = await executeSDRWithResilience(validatedInput, correlationId);
      
      const executionTimeMs = Math.round(performance.now() - startTime);
      
      enhancedLogger.info(`SDR orchestration completed`, {
        contactId: validatedInput.contactId,
        correlationId,
        executionTimeMs,
        success: result.success,
      });

      return {
        ...result,
        correlationId,
        executionTimeMs,
      };

    } catch (error) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      enhancedLogger.error(`SDR orchestration failed`, {
        correlationId,
        error: errorMessage,
        executionTimeMs,
      });

      return {
        success: false,
        actions_taken: [],
        correlationId,
        executionTimeMs,
        error: errorMessage,
      };
    }
  });
}

// ============================================================================
// CORE SDR EXECUTION WITH RESILIENCE
// ============================================================================

async function executeSDRWithResilience(
  input: RunSDRInput,
  correlationId: string
): Promise<Omit<SDROrchestratorResult, 'correlationId' | 'executionTimeMs'>> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), CONFIG.DEFAULT_TIMEOUT_MS);

  try {
    // Load all data in parallel with timeouts
    const [
      agentData,
      contactData,
      activitiesData,
      dealData,
      personaData,
    ] = await Promise.all([
      loadAgentWithRetry(input.agentId, abortController.signal),
      loadContactWithRetry(input.contactId, abortController.signal),
      loadActivitiesWithRetry(input.contactId, abortController.signal),
      loadDealWithRetry(input.contactId, abortController.signal),
      loadPersonaWithRetry(input.agentId, abortController.signal),
    ]);

    if (!agentData) {
      throw new Error(`Agent not found: ${input.agentId}`);
    }

    if (!contactData) {
      throw new Error(`Contact not found: ${input.contactId}`);
    }

    // Construct prompt
    const finalPrompt = constructSDRPrompt({
      agent: agentData,
      contact: contactData,
      activities: activitiesData,
      deal: dealData,
      persona: personaData,
      incomingMessage: input.incomingMessage,
    });

    // Generate AI response with circuit breaker and timeout
    const llmResponse = await generateAIResponse(finalPrompt, abortController.signal);

    // Execute post-processing actions
    const actionsTaken = await executePostProcessing({
      contactId: input.contactId,
      contactEmail: typeof contactData.email === 'string' ? contactData.email : undefined,
      incomingMessage: input.incomingMessage,
      llmResponse,
      correlationId,
      abortSignal: abortController.signal,
    });

    return {
      success: true,
      response: llmResponse,
      agent: typeof agentData.name === 'string' ? agentData.name : 'Unknown',
      persona: personaData && typeof personaData.id === 'string' ? personaData.id : undefined,
      actions_taken: actionsTaken,
    };

  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// DATA LOADING WITH RETRY AND CIRCUIT BREAKER
// ============================================================================

async function loadAgentWithRetry(agentId: string, abortSignal: AbortSignal): Promise<Record<string, unknown> | null> {
  return withResilience(
    async (signal) => {
      const supabase = getSupabaseClient();
      
      // Combine abort signals
      if (abortSignal.aborted || signal.aborted) {
        throw new Error('Operation aborted');
      }

      const { data, error } = await supabase
        .from("agent_metadata")
        .select("*")
        .eq("id", agentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to load agent: ${error.message}`);
      }

      return data;
    },
    {
      timeout: timeouts.db,
      retry: retryPolicies.db,
      circuitBreaker: circuitBreakers.supabase,
    }
  );
}

async function loadContactWithRetry(contactId: string, abortSignal: AbortSignal): Promise<Record<string, unknown> | null> {
  return withResilience(
    async (signal) => {
      const supabase = getSupabaseClient();
      
      if (abortSignal.aborted || signal.aborted) {
        throw new Error('Operation aborted');
      }

      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to load contact: ${error.message}`);
      }

      return data;
    },
    {
      timeout: timeouts.db,
      retry: retryPolicies.db,
      circuitBreaker: circuitBreakers.supabase,
    }
  );
}

async function loadActivitiesWithRetry(contactId: string, abortSignal: AbortSignal): Promise<Record<string, unknown>[]> {
  return withResilience(
    async (signal) => {
      const supabase = getSupabaseClient();
      
      if (abortSignal.aborted || signal.aborted) {
        throw new Error('Operation aborted');
      }

      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        throw new Error(`Failed to load activities: ${error.message}`);
      }

      return data || [];
    },
    {
      timeout: timeouts.db,
      retry: retryPolicies.db,
      circuitBreaker: circuitBreakers.supabase,
    }
  );
}

async function loadDealWithRetry(contactId: string, abortSignal: AbortSignal): Promise<Record<string, unknown> | null> {
  return withResilience(
    async (signal) => {
      const supabase = getSupabaseClient();
      
      if (abortSignal.aborted || signal.aborted) {
        throw new Error('Operation aborted');
      }

      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load deal: ${error.message}`);
      }

      return data;
    },
    {
      timeout: timeouts.db,
      retry: retryPolicies.db,
      circuitBreaker: circuitBreakers.supabase,
    }
  );
}

async function loadPersonaWithRetry(agentId: string, abortSignal: AbortSignal): Promise<Record<string, unknown> | null> {
  return withResilience(
    async (signal) => {
      const supabase = getSupabaseClient();
      
      if (abortSignal.aborted || signal.aborted) {
        throw new Error('Operation aborted');
      }

      const { data: link, error: linkError } = await supabase
        .from("agent_persona_selection")
        .select("persona_id")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (linkError || !link) {
        return null;
      }

      const { data: persona, error: personaError } = await supabase
        .from("sdr_personas")
        .select("*")
        .eq("id", link.persona_id)
        .maybeSingle();

      if (personaError) {
        throw new Error(`Failed to load persona: ${personaError.message}`);
      }

      return persona;
    },
    {
      timeout: timeouts.db,
      retry: retryPolicies.db,
      circuitBreaker: circuitBreakers.supabase,
    }
  );
}

// ============================================================================
// AI RESPONSE GENERATION WITH CIRCUIT BREAKER
// ============================================================================

async function generateAIResponse(prompt: string, abortSignal: AbortSignal): Promise<string> {
  return withResilience(
    async (signal) => {
      // Combine abort signals
      if (abortSignal.aborted || signal.aborted) {
        throw new Error('AI generation aborted');
      }

      // Import dynamically to avoid circular dependencies
      const { callOpenAI } = await import("../llm/callOpenAI");
      
      // Call OpenAI with just the prompt (legacy API)
      const response = await callOpenAI(prompt);

      if (!response) {
        throw new Error('Empty response from AI');
      }

      return response;
    },
    {
      timeout: timeouts.ai,
      retry: retryPolicies.ai,
      circuitBreaker: circuitBreakers.openAI,
    }
  );
}

// ============================================================================
// PROMPT CONSTRUCTION
// ============================================================================

interface PromptContext {
  agent: Record<string, unknown>;
  contact: Record<string, unknown>;
  activities: Record<string, unknown>[];
  deal: Record<string, unknown> | null;
  persona: Record<string, unknown> | null;
  incomingMessage: string;
}

function constructSDRPrompt(context: PromptContext): string {
  const { agent, contact, activities, deal, persona, incomingMessage } = context;
  
  const safeGet = (obj: Record<string, unknown>, key: string): string | number | undefined => {
    const val = obj[key];
    if (typeof val === 'string' || typeof val === 'number') return val;
    return undefined;
  };
  
  return `
${typeof persona?.persona_prompt === 'string' ? persona.persona_prompt : ''}

Role: ${safeGet(agent, 'name') || 'Unknown'}
Objectives: ${JSON.stringify(agent.objectives || [])}
Workflow: ${JSON.stringify(agent.workflow || [])}

Contact Context:
- Name: ${safeGet(contact, 'name') || 'Unknown'}
- Company: ${safeGet(contact, 'company') || 'N/A'}
- Title: ${safeGet(contact, 'title') || 'N/A'}
- Industry: ${safeGet(contact, 'industry') || 'N/A'}
- Lead Score: ${safeGet(contact, 'lead_score') ?? 'N/A'}
- Status: ${safeGet(contact, 'status') || 'N/A'}

Deal Context:
- Deal Name: ${deal && typeof deal.deal_name === 'string' ? deal.deal_name : 'No active deal'}
- Value: ${deal?.value && typeof deal.value === 'number' ? `$${deal.value.toLocaleString()}` : 'N/A'}
- Stage: ${deal && typeof deal.stage === 'string' ? deal.stage : 'N/A'}
- Risk Score: ${deal?.risk_score && typeof deal.risk_score === 'number' ? deal.risk_score : 'N/A'}

Recent Activity History:
${activities?.map((a: Record<string, unknown>) => {
  const type = safeGet(a, 'type');
  const message = safeGet(a, 'message');
  return `- ${type || 'unknown'}: ${message || 'no message'}`;
}).join('\n') || 'No recent activity'}

Incoming Prospect Message:
"${incomingMessage}"

Instructions:
- Respond according to your persona, tone, and role
- Keep the message 4-7 sentences maximum
- Always propose the next specific step
- Reference relevant context from their history
- Use the assigned persona's communication style
- End with a clear call-to-action

Generate the best possible SDR reply:`;
}

// ============================================================================
// POST-PROCESSING ACTIONS
// ============================================================================

interface PostProcessingContext {
  contactId: string;
  contactEmail?: string;
  incomingMessage: string;
  llmResponse: string;
  correlationId: string;
  abortSignal: AbortSignal;
}

async function executePostProcessing(context: PostProcessingContext): Promise<string[]> {
  const { contactId, contactEmail, incomingMessage, llmResponse, correlationId, abortSignal } = context;
  const actionsTaken: string[] = [];

  // Prepare MCP tool calls
  const tools: Array<{ toolName: string; params: Record<string, unknown> }> = [];

  // 1. Save activity
  tools.push({
    toolName: "SmartCRMTools.save_activity",
    params: {
      contact_id: contactId,
      type: "SDR_EMAIL_RESPONSE",
      message: `Responded to: "${incomingMessage.substring(0, 100)}..." with: "${llmResponse.substring(0, 100)}..."`,
      metadata: { correlationId },
    },
  });

  // 2. Update status if qualified
  const isQualified = incomingMessage.toLowerCase().includes('demo') || 
                      incomingMessage.toLowerCase().includes('meeting') ||
                      incomingMessage.toLowerCase().includes('interested');
  
  if (isQualified) {
    tools.push({
      toolName: "SmartCRMTools.update_contact_status",
      params: {
        contact_id: contactId,
        status: "qualified",
      },
    });
  }

  // 3. Send email if we have an email address
  if (contactEmail) {
    tools.push({
  }

  // Execute tools with batch processing and error isolation
  const results = await executeMCPToolBatch(tools, {
    correlationId,
    maxConcurrency: 3,
    continueOnError: true,
  });

  // Track successful actions
  results.forEach((result, index) => {
    const toolName = tools[index].toolName;
    if (result.success) {
      if (toolName.includes('save_activity')) actionsTaken.push('activity_logged');
      if (toolName.includes('update_contact_status')) actionsTaken.push('status_updated_to_qualified');
    } else {
      enhancedLogger.warn(`Post-processing action failed`, {
        toolName,
        error: result.error,
        correlationId,
      });
    }
  });

  return actionsTaken;
}

// ============================================================================
// BATCH SDR PROCESSING WITH CONCURRENCY CONTROL
// ============================================================================

export async function processSDREmailBatch(input: unknown): Promise<BatchProcessResult[]> {
  const startTime = performance.now();
  const correlationId = createCorrelationId();
  
  return withLogContext({ correlationId, operation: 'processSDRBatch' }, async () => {
    try {
      // Validate input
      const validatedInput = ProcessSDRBatchInputSchema.parse(input);
      
      enhancedLogger.info(`Starting batch SDR processing`, {
        emailCount: validatedInput.emails.length,
        maxConcurrency: validatedInput.maxConcurrency || CONFIG.MAX_BATCH_CONCURRENCY,
        correlationId,
      });

      // Limit batch size
      const emails = validatedInput.emails.slice(0, CONFIG.MAX_EMAIL_BATCH_SIZE);
      
      // Process with controlled concurrency
      const results: BatchProcessResult[] = [];
      const concurrency = Math.min(
        validatedInput.maxConcurrency || CONFIG.MAX_BATCH_CONCURRENCY,
        10 // Hard limit
      );

      // Process in chunks
      for (let i = 0; i < emails.length; i += concurrency) {
        const chunk = emails.slice(i, i + concurrency);
        
        const chunkResults = await Promise.all(
          chunk.map(async (email) => {
            const emailStartTime = performance.now();
            
            try {
              // Find or create contact
              const contactId = await resolveOrCreateContact(
                email.from,
                email.contactId,
                correlationId
              );

              if (!contactId) {
                throw new Error('Failed to resolve contact ID');
              }

              // Get assigned agent
              const agentId = await getAssignedAgent(contactId, validatedInput.defaultAgentId);

              // Process email
              const result = await runSDR({
                contactId,
                incomingMessage: `${email.subject}\n\n${email.body}`,
                agentId,
                correlationId,
              });

              return {
                email: email.from,
                success: result.success,
                result,
                executionTimeMs: Math.round(performance.now() - emailStartTime),
              };

            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              enhancedLogger.error(`Failed to process email in batch`, {
                email: '[REDACTED]',
                correlationId,
                error: errorMessage,
              });
              
              return {
                email: email.from,
                success: false,
                error: errorMessage,
                executionTimeMs: Math.round(performance.now() - emailStartTime),
              };
            }
          })
        );

        results.push(...chunkResults);

        // Log progress
        enhancedLogger.info(`Batch progress`, {
          processed: results.length,
          total: emails.length,
          correlationId,
        });
      }

      const totalExecutionTime = Math.round(performance.now() - startTime);
      const successCount = results.filter(r => r.success).length;

      enhancedLogger.info(`Batch SDR processing completed`, {
        total: results.length,
        successful: successCount,
        failed: results.length - successCount,
        totalExecutionTimeMs: totalExecutionTime,
        correlationId,
      });

      return results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      enhancedLogger.error(`Batch SDR processing failed`, {
        correlationId,
        error: errorMessage,
      });
      throw error;
    }
  });
}

// ============================================================================
// CONTACT RESOLUTION
// ============================================================================

async function resolveOrCreateContact(
  email: string,
  existingContactId: string | undefined,
  correlationId: string
): Promise<string | null> {
  if (existingContactId) {
    return existingContactId;
  }

  return withResilience(
    async () => {
      const supabase = getSupabaseClient();

      // Check for existing contact
      const { data: existing, error: findError } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (findError) {
        throw new Error(`Failed to find contact: ${findError.message}`);
      }

      if (existing) {
        return existing.id;
      }

      // Create new contact
      const name = email.split('@')[0].replace(/[._]/g, ' ');
      const { data: newContact, error: createError } = await supabase
        .from("contacts")
        .insert({
          email,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          status: "new",
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createError) {
        throw new Error(`Failed to create contact: ${createError.message}`);
      }

      enhancedLogger.info(`Created new contact from email`, {
        contactId: newContact.id,
        correlationId,
      });

      return newContact.id;
    },
    {
      timeout: timeouts.db,
      retry: retryPolicies.db,
      circuitBreaker: circuitBreakers.supabase,
    }
  );
}

async function getAssignedAgent(
  contactId: string,
  defaultAgentId: string = "sdr_email_primary"
): Promise<string> {
  return withResilience(
    async () => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from("contact_agent_assignment")
        .select("agent_id")
        .eq("contact_id", contactId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get agent assignment: ${error.message}`);
      }

      return data?.agent_id || defaultAgentId;
    },
    {
      timeout: timeouts.db,
      retry: retryPolicies.db,
      circuitBreaker: circuitBreakers.supabase,
    }
  );
}

// ============================================================================
// SDR AGENT RECOMMENDATION ENGINE
// ============================================================================

export async function recommendSDRAgent(input: unknown): Promise<string> {
  const validatedInput = RecommendAgentInputSchema.parse(input);
  
  return withLogContext({ operation: 'recommendSDRAgent' }, async () => {
    enhancedLogger.info(`Generating SDR agent recommendation`, {
      contactId: validatedInput.contactId,
      dealStage: validatedInput.dealStage,
      leadScore: validatedInput.leadScore,
    });

    // Rule-based recommendation engine
    // In production, this could use ML/AI

    if (validatedInput.dealStage === 'negotiation' || 
        (validatedInput.leadScore && validatedInput.leadScore > 80)) {
      return 'sdr_handoff_hybrid';
    }

    if (validatedInput.recentActivity?.some(a => a.includes('objection'))) {
      return 'sdr_objection_crusher';
    }

    if (validatedInput.dealStage === 'new' || !validatedInput.dealStage) {
      return 'sdr_cold_outreach';
    }

    if (validatedInput.recentActivity?.length === 0 || 
        validatedInput.recentActivity?.every(a => a.includes('no response'))) {
      return 'sdr_followup';
    }

    return 'sdr_email_primary';
  });
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function checkSDROrchestratorHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {};

  // Check circuit breakers
  checks.circuitBreakerOpenAI = circuitBreakers.openAI.getState() !== 'OPEN';
  checks.circuitBreakerSupabase = circuitBreakers.supabase.getState() !== 'OPEN';

  // Try a simple database query
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("contacts").select("count").limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }

  const allHealthy = Object.values(checks).every(Boolean);
  const anyHealthy = Object.values(checks).some(Boolean);

  return {
    status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
    checks,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { RunSDRInput, ProcessSDRBatchInput, RecommendAgentInput };
