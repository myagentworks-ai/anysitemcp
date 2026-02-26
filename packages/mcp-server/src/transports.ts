import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function connectStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WebMCP server running on stdio");
}

export async function connectHttp(server: McpServer, port: number): Promise<void> {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  const httpServer = createServer(async (req, res) => {
    if (req.url === "/mcp") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", async () => {
        const parsed = body ? JSON.parse(body) : undefined;
        await transport.handleRequest(req, res, parsed);
      });
    } else {
      res.writeHead(404).end();
    }
  });

  await server.connect(transport);
  httpServer.listen(port, () => {
    console.error(`WebMCP server running at http://localhost:${port}/mcp`);
  });
}
