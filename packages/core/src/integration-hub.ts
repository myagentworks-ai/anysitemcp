import { discover, type DiscoverOptions } from "./discovery/pipeline.js";
import { executeHttpTool } from "./executor/http.js";
import { executeBrowserTool } from "./executor/browser.js";
import type { ToolDefinition } from "./types.js";

export interface IntegrationConfig {
  name: string;
  url: string;
  description?: string;
  skipLlm?: boolean;
}

export interface IntegrationEntry {
  config: IntegrationConfig;
  tools: ToolDefinition[];
  connectedAt: string; // ISO timestamp
  status: "connected" | "error";
  error?: string;
}

export class IntegrationHub {
  private integrations = new Map<string, IntegrationEntry>();

  /** Connect to a site and discover its tools. */
  async connect(config: IntegrationConfig, options?: Pick<DiscoverOptions, "onProgress">): Promise<IntegrationEntry> {
    try {
      const result = await discover(config.url, {
        skipLlm: config.skipLlm,
        onProgress: options?.onProgress,
      });
      const entry: IntegrationEntry = {
        config,
        tools: result.tools,
        connectedAt: new Date().toISOString(),
        status: "connected",
      };
      this.integrations.set(config.name, entry);
      return entry;
    } catch (err) {
      const entry: IntegrationEntry = {
        config,
        tools: [],
        connectedAt: new Date().toISOString(),
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
      this.integrations.set(config.name, entry);
      return entry;
    }
  }

  /** Connect to multiple sites in parallel. */
  async connectAll(configs: IntegrationConfig[]): Promise<void> {
    await Promise.all(configs.map((c) => this.connect(c)));
  }

  /** Call a named tool on a connected integration. */
  async call(
    integrationName: string,
    toolName: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const entry = this.integrations.get(integrationName);
    if (!entry) {
      const names = Array.from(this.integrations.keys()).join(", ") || "none";
      throw new Error(`No integration named "${integrationName}". Connected: ${names}`);
    }
    const tool = entry.tools.find((t) => t.name === toolName);
    if (!tool) {
      const names = entry.tools.map((t) => t.name).join(", ") || "none";
      throw new Error(`Tool "${toolName}" not found in "${integrationName}". Available: ${names}`);
    }
    if (tool.transport === "http") {
      return executeHttpTool(tool, params);
    } else {
      return executeBrowserTool(tool, params);
    }
  }

  /** Remove a connected integration. */
  disconnect(name: string): boolean {
    return this.integrations.delete(name);
  }

  /** Get all connected integrations (without tools detail for listing). */
  getAll(): IntegrationEntry[] {
    return Array.from(this.integrations.values());
  }

  /** Get a single integration entry. */
  get(name: string): IntegrationEntry | undefined {
    return this.integrations.get(name);
  }

  /** Get tools for a connected integration. */
  getTools(name: string): ToolDefinition[] {
    return this.integrations.get(name)?.tools ?? [];
  }
}
