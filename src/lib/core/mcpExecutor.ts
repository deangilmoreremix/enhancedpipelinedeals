import { toolMap } from "../mcp/toolMappings";

export async function executeTool(toolName: string, args: any) {
  const mapping = toolMap[toolName];

  if (!mapping) throw new Error(`MCP tool not found: ${toolName}`);

  const { server, method } = mapping;

  const response = await fetch(`http://localhost:3002/mcp/${server}/${method}`, {
    method: "POST",
    body: JSON.stringify(args),
    headers: { "Content-Type": "application/json" }
  });

  return await response.json();
}