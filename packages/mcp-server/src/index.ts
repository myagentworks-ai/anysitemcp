import { discover } from "@webmcp/core";
import { createMcpServer } from "./server.js";
import { connectStdio, connectHttp } from "./transports.js";

export { createMcpServer } from "./server.js";
export { connectStdio, connectHttp } from "./transports.js";

export interface StartServerOptions {
  url: string;
  transport?: "stdio" | "http";
  port?: number;
  skipLlm?: boolean;
  onProgress?: (stage: 1 | 2 | 3, message: string) => void;
}

export async function startServer(options: StartServerOptions): Promise<void> {
  const { url, transport = "stdio", port = 4000, skipLlm = false, onProgress } = options;

  onProgress?.(1, "Detecting API spec...");
  onProgress?.(2, "Analyzing HTML...");
  onProgress?.(3, "Enriching with LLM...");

  const result = await discover(url, { skipLlm });

  console.error(`Discovered ${result.tools.length} tools via ${result.discoveredVia}`);

  const server = createMcpServer(result.tools);

  if (transport === "http") {
    await connectHttp(server, port);
  } else {
    await connectStdio(server);
  }
}
