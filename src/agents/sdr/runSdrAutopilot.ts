// SDR Autopilot Runner Engine
// Main orchestration for GPT-5.2 SDR campaigns

import { openai } from '../../lib/core/openaiClient';
import { getSdrModel, buildSdrMessages } from './sdrAgentDefinition';
import { sdrTools } from './sdrTools';
import { getOrCreateThreadForLead } from './sdrStateHelpers';
import {
  getLeadContextFromSmartCRM,
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

    // Build messages
    const messages: any[] = buildSdrMessages(contextString, goal);

    // Start the conversation with GPT-5.2
    const completion = await openai.chat.completions.create({
      model: getSdrModel("autopilot"),
      messages: messages as any,
      tools: sdrTools as any,
      tool_choice: "auto",
      max_tokens: 4096,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message;
    if (!response) {
      throw new Error("No response from GPT-5.2");
    }

    // Handle tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolResults = await handleToolCalls(response.tool_calls, { leadId, mailboxKey });

      // Continue conversation with tool results
      const followUpMessages: any[] = [
        ...messages,
        response,
        ...toolResults
      ];

      const followUpCompletion = await openai.chat.completions.create({
        model: getSdrModel("autopilot"),
        messages: followUpMessages as any,
        max_tokens: 2048,
        temperature: 0.7
      });

      return {
        threadId,
        initialResponse: response.content,
        toolResults,
        finalResponse: followUpCompletion.choices[0]?.message?.content,
        success: true
      };
    }

    return {
      threadId,
      response: response.content,
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

// Handle tool calls from GPT-5.2
async function handleToolCalls(toolCalls: any[], context: { leadId: string; mailboxKey: string }) {
  const toolResults = [];

  for (const toolCall of toolCalls) {
    const { id: callId, function: func } = toolCall;
    const { name, arguments: argsString } = func;

    try {
      const args = JSON.parse(argsString || "{}");
      let result: any = {};

      // Dispatch to appropriate tool implementation
      switch (name) {
        case "get_lead_context":
          result = await getLeadContextFromSmartCRM(args.lead_id || context.leadId);
          break;

        case "send_sdr_email":
          result = await getLeadContextFromSmartCRM(args.lead_id || context.leadId); // TODO: implement sendSdrEmail
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

      toolResults.push({
        role: "tool",
        tool_call_id: callId,
        content: JSON.stringify(result)
      });

    } catch (error) {
      console.error(`Tool call error for ${name}:`, error);
      toolResults.push({
        role: "tool",
        tool_call_id: callId,
        content: JSON.stringify({
          error: `Tool execution failed: ${(error as Error).message}`
        })
      });
    }
  }

  return toolResults;
}