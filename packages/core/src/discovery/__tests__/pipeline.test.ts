import { describe, it, expect, vi } from "vitest";
import { discover } from "../pipeline.js";

vi.mock("../spec-detector.js", () => ({ detectApiSpec: vi.fn().mockResolvedValue(null) }));
vi.mock("../html-analyzer.js", () => ({
  analyzeHtml: vi.fn().mockReturnValue([
    { formAction: "https://example.com/search", method: "GET", fields: [{ name: "q", type: "text" }] }
  ])
}));
vi.mock("../llm-enricher.js", () => ({
  enrichWithLlm: vi.fn().mockResolvedValue([
    {
      name: "search",
      description: "Search",
      inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
      transport: "http",
      httpConfig: { url: "https://example.com/search", method: "GET", paramMapping: { q: "q" } }
    }
  ])
}));

describe("discover", () => {
  it("falls back to HTML + LLM when no API spec found", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html><form action='/search'><input name='q' /></form></html>",
    } as unknown as Response);

    const result = await discover("https://example.com", { fetchFn: mockFetch });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("search");
    expect(result.discoveredVia).toBe("hybrid");
  });

  it("returns api-spec tools when OpenAPI spec is detected", async () => {
    const { detectApiSpec } = await import("../spec-detector.js");
    vi.mocked(detectApiSpec).mockResolvedValueOnce({
      openapi: "3.0.0",
      paths: {
        "/items": {
          get: {
            operationId: "listItems",
            summary: "List items",
            parameters: [],
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof detectApiSpec>>);
    const mockFetch = vi.fn();

    const result = await discover("https://example.com", { fetchFn: mockFetch });

    expect(result.discoveredVia).toBe("api-spec");
    expect(result.tools.length).toBeGreaterThan(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns html-only tools when skipLlm is true", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "<html></html>",
    } as unknown as Response);

    const result = await discover("https://example.com", { fetchFn: mockFetch, skipLlm: true });

    expect(result.discoveredVia).toBe("html");
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("search"); // from mocked analyzeHtml → "https://example.com/search"
  });

  it("returns empty tools when page fetch returns non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    } as unknown as Response);

    const result = await discover("https://example.com", { fetchFn: mockFetch });

    expect(result.tools).toEqual([]);
    expect(result.discoveredVia).toBe("html");
  });
});
