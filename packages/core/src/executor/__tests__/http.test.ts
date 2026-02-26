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

  it("does not include body property on GET requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
      headers: { get: () => "application/json" },
    } as unknown as Response);

    await executeHttpTool(searchTool, { q: "shoes" }, mockFetch);

    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(fetchOptions).not.toHaveProperty("body");
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

  it("skips null args in GET query params", async () => {
    const toolWithMultipleParams: ToolDefinition = {
      ...searchTool,
      httpConfig: {
        url: "https://api.example.com/search",
        method: "GET",
        paramMapping: { q: "q", filter: "filter" },
      },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
      headers: { get: () => "application/json" },
    } as unknown as Response);

    await executeHttpTool(toolWithMultipleParams, { q: "shoes", filter: null }, mockFetch);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe("https://api.example.com/search?q=shoes");
    expect(calledUrl).not.toContain("filter");
    expect(calledUrl).not.toContain("null");
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

  it("sends correct method and JSON body for DELETE requests", async () => {
    const deleteTool: ToolDefinition = {
      ...searchTool,
      httpConfig: {
        url: "https://api.example.com/items",
        method: "DELETE",
        paramMapping: { id: "id" },
      },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true }),
      headers: { get: () => "application/json" },
    } as unknown as Response);

    await executeHttpTool(deleteTool, { id: "abc123" }, mockFetch);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/items",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ id: "abc123" }),
      })
    );
  });

  it("returns plain text when content-type is not application/json", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "plain text result",
      headers: { get: () => "text/plain" },
    } as unknown as Response);

    const result = await executeHttpTool(searchTool, { q: "shoes" }, mockFetch);

    expect(result).toBe("plain text result");
  });

  it("throws when tool has no httpConfig", async () => {
    const badTool: ToolDefinition = { ...searchTool, httpConfig: undefined };
    await expect(executeHttpTool(badTool, {}, vi.fn())).rejects.toThrow('Tool "search" has no httpConfig');
  });

  it("throws a descriptive error for relative/invalid httpConfig.url", async () => {
    const relativeTool: ToolDefinition = {
      ...searchTool,
      httpConfig: {
        url: "/relative",
        method: "GET",
        paramMapping: { q: "q" },
      },
    };
    await expect(executeHttpTool(relativeTool, { q: "test" }, vi.fn())).rejects.toThrow(
      "invalid httpConfig.url"
    );
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
