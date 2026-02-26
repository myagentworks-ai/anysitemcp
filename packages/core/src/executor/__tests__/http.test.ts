import { describe, it, expect, vi } from "vitest";
import { executeHttpTool } from "../http.js";
import type { ToolDefinition } from "../../types.js";

const searchTool: ToolDefinition = {
  name: "search",
  description: "Search",
  inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
  transport: "http",
  httpConfig: { url: "https://api.example.com/search", method: "GET", paramMapping: { q: "q" } },
};

describe("executeHttpTool", () => {
  it("appends params as query string for GET requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: ["shoe"] }),
      headers: { get: () => "application/json" },
    } as unknown as Response);

    const result = await executeHttpTool(searchTool, { q: "shoes" }, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/search?q=shoes",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual({ results: ["shoe"] });
  });

  it("sends params as JSON body for POST requests", async () => {
    const postTool: ToolDefinition = {
      ...searchTool,
      httpConfig: { url: "https://api.example.com/submit", method: "POST", paramMapping: { q: "query" } },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      headers: { get: () => "application/json" },
    } as unknown as Response);

    await executeHttpTool(postTool, { q: "test" }, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/submit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "test" }),
      })
    );
  });

  it("throws when tool has no httpConfig", async () => {
    const badTool: ToolDefinition = { ...searchTool, httpConfig: undefined };
    await expect(executeHttpTool(badTool, {}, vi.fn())).rejects.toThrow("no httpConfig");
  });
});
