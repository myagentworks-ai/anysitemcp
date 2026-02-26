import { ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export interface ServerInstance {
  id: string;
  url: string;
  port: number;
  status: "starting" | "running" | "stopped";
  connectionString: string;
  logs: string[];
  process?: ChildProcess;
}

// In-memory store (resets on server restart — acceptable for v1)
const instances = new Map<string, ServerInstance>();

export function getAll(): ServerInstance[] {
  return Array.from(instances.values()).map(({ process: _, ...rest }) => rest);
}

export function getById(id: string): ServerInstance | undefined {
  return instances.get(id);
}

export function createInstance(url: string, port: number): ServerInstance {
  const id = randomUUID();
  const instance: ServerInstance = {
    id,
    url,
    port,
    status: "starting",
    connectionString: `http://localhost:${port}/mcp`,
    logs: [],
  };
  instances.set(id, instance);
  return instance;
}

export function stopInstance(id: string): boolean {
  const instance = instances.get(id);
  if (!instance) return false;
  instance.process?.kill();
  instance.status = "stopped";
  return true;
}

/**
 * Spawn the mcp-server child process for the given instance and wait briefly
 * for startup. Kept here (rather than in the API route) so that Turbopack's
 * static analysis of the route file does not attempt to resolve the
 * mcp-server path as a JavaScript module.
 *
 * The server path is constructed using an indirection that Turbopack's static
 * analysis cannot follow at build time: the path segments are stored in an
 * array and joined at runtime, so Turbopack never sees a resolvable path
 * string literal.
 */
export async function spawnForInstance(instance: ServerInstance): Promise<void> {
  // Build the path from individual segments so Turbopack cannot statically
  // resolve the result as a module import.  The MCP_SERVER_PATH env var
  // allows overriding this at runtime (e.g., in production deploys).
  const segments: string[] = [process.cwd(), "..", "mcp-server", "dist", "index.js"];
  // Fix 6: Remove redundant cast — process.env["MCP_SERVER_PATH"] is already string | undefined
  const serverPath: string =
    process.env["MCP_SERVER_PATH"] ??
    join(...(segments as [string, ...string[]]));

  const args: string[] = [
    "serve",
    instance.url,
    "--transport",
    "http",
    "--port",
    String(instance.port),
  ];

  // Fix 4: stdout set to "ignore" — it is not consumed, only stderr is used
  const child = spawn("node", [serverPath, ...args], {
    env: { ...process.env },
    stdio: ["ignore", "ignore", "pipe"],
  });

  // Assign the handle immediately so stopInstance() can kill it even if it is
  // called between this point and the orphan guard below.
  instance.process = child;

  // Fix 5: Guard against orphaned process if instance was stopped before spawn completed
  if (instance.status === "stopped") {
    child.kill();
    return;
  }

  child.stderr?.on("data", (data: Buffer) => {
    instance.logs.push(data.toString());
    if (data.toString().includes("running at")) {
      instance.status = "running";
    }
  });

  child.on("exit", () => {
    instance.status = "stopped";
  });

  // Wait briefly for startup
  await new Promise((r) => setTimeout(r, 2000));
}
