// SDR Autopilot Runner Engine
// Main orchestration for SDR campaigns (OpenAI Responses API via the server-side gateway)

import { callAI } from '../../services/aiClient';
import { getSdrModel, buildSdrMessages } from './sdrAgentDefinition';
import { sdrTools } from './sdrTools';
import { getOrCreateThreadForLead } from './sdrStateHelpers';
import {
  getLeadContextFromSmartCRM,
  sendSdrEmail,
  createTaskInSmartCRM,
  updateDealStageInSmartCRM,
  scheduleMeetingForLead,
  saveAutopilotStateWrapper
} from './sdrToolImplementations';

// Main SDR Autopilot execution function
export async function runSdrAutopilot(params: {
  leadId: string;
  goal: string;
  mailboxKey: string;
}) {
  const { leadId, goal, mailboxKey } = params;

  try {
    // Get or create thread for this lead
    const threadId = await getOrCreateThreadForLead(leadId);

    // Get lead context
    const leadContext = await getLeadContextFromSmartCRM(leadId);
    const contextString = JSON.stringify(leadContext, null, 2);

    // Build messages: system guidance -> `instructions`, the rest -> `input`
    const messages: any[] = buildSdrMessages(contextString, goal);
    const instructions = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const input = messages.filter(m => m.role !== 'system');

    // Responses API uses flat function tools: { type, name, description, parameters }
    const tools = (sdrTools as any[]).map(t => (t.function ? { type: 'function', ...t.function } : t));
    const tier = getSdrModel("autopilot");

    let response = await callAI('chat', {
      instructions,
      input,
      tools,
      toolChoice: 'auto',
      tier,
      maxOutputTokens: 4096,
      store: true,
    });
    const initialText = response.text;
    const toolResults: any[] = [];

    // Tool loop: run requested tools, send function_call_output items back with previous_response_id
    for (let turn = 0; turn < 6 && response.tool_calls?.length; turn++) {
      const outputs = await handleToolCalls(response.tool_calls, { leadId, mailboxKey });
      toolResults.push(...outputs);
      response = await callAI('chat', {
        instructions,
        input: outputs.map(o => ({ type: 'function_call_output', call_id: o.call_id, output: o.output })),
        previousResponseId: response.id,
        tools,
        tier,
        maxOutputTokens: 2048,
      });
    }

    if (toolResults.length > 0) {
      return {
        threadId,
        initialResponse: initialText,
        toolResults,
        finalResponse: response.text,
        success: true
      };
    }

    return {
      threadId,
      response: response.text,
      success: true
    };

  } catch (error) {
    console.error('SDR Autopilot error:', error);
    return {
      error: 'SDR Autopilot failed',
      details: (error as Error).message,
      success: false
    };
  }
}

// Handle tool calls from the model
async function handleToolCalls(
  toolCalls: Array<{ call_id: string; name: string; arguments: any }>,
  context: { leadId: string; mailboxKey: string }
) {
  const toolResults: Array<{ call_id: string; name: string; output: string }> = [];

  for (const toolCall of toolCalls) {
    const { call_id: callId, name } = toolCall;

    try {
      const args = toolCall.arguments || {};
      let result: any = {};

      // Dispatch to appropriate tool implementation
      switch (name) {
        case "get_lead_context":
          result = await getLeadContextFromSmartCRM(args.lead_id || context.leadId);
          break;

        case "send_sdr_email":
result = await sendSdrEmail({
            ...args,
            mailbox_key: args.mailbox_key || context.mailboxKey
          });
          break;

        case "create_followup_task":
          result = await createTaskInSmartCRM(args);
          break;

        case "update_pipeline_stage":
          result = await updateDealStageInSmartCRM(args);
          break;

        case "schedule_meeting":
          result = await scheduleMeetingForLead(args);
          break;

        case "log_autopilot_state":
          result = await saveAutopilotStateWrapper(args);
          break;

        default:
          result = { error: `Unknown tool: ${name}` };
      }

      toolResults.push({ call_id: callId, name, output: JSON.stringify(result) });

    } catch (error) {
      console.error(`Tool call error for ${name}:`, error);
      toolResults.push({
        call_id: callId,
        name,
        output: JSON.stringify({ error: `Tool execution failed: ${(error as Error).message}` })
      });
    }
  }

  return toolResults;
}