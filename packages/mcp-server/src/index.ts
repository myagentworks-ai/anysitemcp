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

  const result = await discover(url, { skipLlm, onProgress });

  console.error(`Discovered ${result.tools.length} tools via ${result.discoveredVia}`);

  const server = createMcpServer(result.tools);

  switch (transport) {
    case "http":
      await connectHttp(server, port);
      break;
    case "stdio":
      await connectStdio(server);
      break;
    default: {
      const _exhaustive: never = transport;
      throw new Error(`Unknown transport: ${_exhaustive}`);
    }
  }
}
