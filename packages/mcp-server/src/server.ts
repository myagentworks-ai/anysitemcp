import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeHttpTool, executeBrowserTool } from "@webmcp/core";
import type { ToolDefinition } from "@webmcp/core";
import { z } from "zod";

function jsonSchemaToZod(schema: ToolDefinition["inputSchema"]): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const isRequired = schema.required?.includes(key) ?? false;
    let zodType: z.ZodTypeAny;
    switch (prop.type) {
      case "number":
        zodType = z.number();
        break;
      case "integer":
        zodType = z.number().int();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      default:
        zodType = z.string();
    }
    if (prop.description) zodType = zodType.describe(prop.description);
    shape[key] = isRequired ? zodType : zodType.optional();
  }
  return shape;
}

export function createMcpServer(tools: ToolDefinition[]): McpServer {
  const server = new McpServer({
    name: "webmcp",
    version: "0.0.1",
  });

  for (const tool of tools) {
    const shape = jsonSchemaToZod(tool.inputSchema);

    server.tool(
      tool.name,
      tool.description,
      shape,
      async (args) => {
        try {
          let result: unknown;
          switch (tool.transport) {
            case "http":
              result = await executeHttpTool(tool, args as Record<string, unknown>);
              break;
            case "browser":
              result = await executeBrowserTool(tool, args as Record<string, unknown>);
              break;
            default: {
              const _exhaustive: never = tool.transport;
              throw new Error(`Unknown transport: ${_exhaustive}`);
            }
          }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
