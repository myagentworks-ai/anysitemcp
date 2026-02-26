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

  it("does not produce double ? when url already contains query params", async () => {
    const toolWithQuery: ToolDefinition = {
      ...searchTool,
      httpConfig: {
        url: "https://api.example.com/search?version=2",
        method: "GET",
        paramMapping: { q: "q" },
      },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
      headers: { get: () => "application/json" },
    } as unknown as Response);

    await executeHttpTool(toolWithQuery, { q: "shoes" }, mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://api.example.com/search?version=2&q=shoes");
    expect(calledUrl.split("?").length - 1).toBe(1);
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

  it("preserves original types in POST body (no String() coercion)", async () => {
    const postTool: ToolDefinition = {
      ...searchTool,
      httpConfig: {
        url: "https://api.example.com/submit",
        method: "POST",
        paramMapping: { flag: "flag", count: "count", tags: "tags" },
      },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      headers: { get: () => "application/json" },
    } as unknown as Response);

    await executeHttpTool(postTool, { flag: true, count: 42, tags: [1, 2] }, mockFetch);

    const calledBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(calledBody).toEqual({ flag: true, count: 42, tags: [1, 2] });
  });

  it("throws when tool has no httpConfig", async () => {
    const badTool: ToolDefinition = { ...searchTool, httpConfig: undefined };
    await expect(executeHttpTool(badTool, {}, vi.fn())).rejects.toThrow("no httpConfig");
  });

  it("throws with HTTP status message when response is not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => null },
    } as unknown as Response);

    await expect(
      executeHttpTool(searchTool, { q: "shoes" }, mockFetch)
    ).rejects.toThrow("HTTP 404");
  });
});
