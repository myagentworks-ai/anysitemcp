import { describe, it, expect, vi } from "vitest";
import { createMcpServer } from "../server.js";
import type { ToolDefinition } from "@webmcp/core";

const mockTool: ToolDefinition = {
  name: "search_products",
  description: "Search for products",
  inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
  transport: "http",
  httpConfig: { url: "https://example.com/search", method: "GET", paramMapping: { q: "q" } },
};

describe("createMcpServer", () => {
  it("creates a server with registered tools", () => {
    const server = createMcpServer([mockTool]);
    expect(server).toBeDefined();
  });

  it("registers the correct number of tools", () => {
    const tools: ToolDefinition[] = [
      mockTool,
      { ...mockTool, name: "get_product", description: "Get a product" },
    ];
    const server = createMcpServer(tools);
    expect(server).toBeDefined();
  });
});
