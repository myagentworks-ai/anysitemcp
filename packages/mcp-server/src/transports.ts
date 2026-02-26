import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function connectStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AnySiteMCP server running on stdio");
}

const BODY_SIZE_LIMIT = 1_048_576; // 1 MB

export async function connectHttp(server: McpServer, port: number): Promise<void> {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  const httpServer = createServer(async (req, res) => {
    if (req.url === "/mcp") {
      let body = "";
      let byteLength = 0;
      req.on("data", (chunk: Buffer) => {
        byteLength += chunk.length;
        if (byteLength > BODY_SIZE_LIMIT) {
          res.writeHead(413, { "Content-Type": "application/json" }).end(
            JSON.stringify({ error: "Request body too large" })
          );
          req.destroy();
          return;
        }
        body += chunk.toString();
      });
      req.on("end", async () => {
        if (res.writableEnded) return;
        let parsed: unknown;
        if (body) {
          try {
            parsed = JSON.parse(body);
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" }).end(
              JSON.stringify({ error: "Invalid JSON" })
            );
            return;
          }
        }
        await transport.handleRequest(req, res, parsed);
      });
    } else {
      res.writeHead(404).end();
    }
  });

  await server.connect(transport);
  httpServer.listen(port, () => {
    console.error(`AnySiteMCP server running at http://localhost:${port}/mcp`);
  });
}
